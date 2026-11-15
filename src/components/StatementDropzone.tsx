import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, UploadCloud } from 'lucide-react';
import { AlertBanner, Button, FileDropzone, GlassCard } from '@yggdrasil-lab/ui';
import {
  fetchAccounts,
  fetchInstitutions,
  fetchSampleStatement,
  uploadStatement,
} from '../services/api';
import { Account, InstitutionInfo, StatementParseResult } from '../types';
import { StatementPreviewCard } from './statements/StatementPreviewCard';

interface StatementDropzoneProps {
  onSuccess: () => void;
}

/**
 * Bank and brokerage statement dropzone with dry-run inspection,
 * institution auto-detection, and ledger anchoring.
 */
export const StatementDropzone: React.FC<StatementDropzoneProps> = ({ onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [institution, setInstitution] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutionsList, setInstitutionsList] = useState<InstitutionInfo[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [tier, setTier] = useState<Account['tier']>('cash');
  const [accountType, setAccountType] = useState<string>('checking');
  const [accountName, setAccountName] = useState<string>('');
  const [currency, setCurrency] = useState<string>('NZD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [closingBalanceInput, setClosingBalanceInput] = useState<string>('');
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    Promise.all([fetchAccounts(), fetchInstitutions()])
      .then(([accs, insts]) => {
        setAccounts(accs);
        setInstitutionsList(insts);
      })
      .catch((err) => console.warn('Could not load accounts or institutions:', err));
  }, []);

  const handleLoadSampleStatement = async () => {
    setLoading(true);
    setError(null);
    try {
      const csvText = await fetchSampleStatement('ASB');
      const blob = new Blob([csvText], { type: 'text/csv' });
      const sampleFile = new File([blob], 'asb-sample-statement.csv', { type: 'text/csv' });
      setFile(sampleFile);
      setParseResult(null);
      setCommitted(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load sample statement from Plutus');
    } finally {
      setLoading(false);
    }
  };

  const handleInstitutionChange = (val: string) => {
    setInstitution(val);
    const match = institutionsList.find((i) => i.name.toLowerCase() === val.toLowerCase());
    if (match) {
      setTier(match.default_tier);
      setAccountType(match.default_type);
      if (match.currency) setCurrency(match.currency);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setCommitted(false);
    setError(null);
    try {
      const res = await uploadStatement(file, 'auto', false);
      setParseResult(res);

      const detected = res.institution && res.institution !== 'Unknown' ? res.institution : '';
      setInstitution(detected);

      let resolvedCur = 'NZD';
      let nextType = 'checking';
      if (detected) {
        const match = institutionsList.find((i) => i.name.toLowerCase() === detected.toLowerCase());
        if (match) {
          setTier(match.default_tier);
          nextType = match.default_type;
          setAccountType(match.default_type);
          if (match.currency) resolvedCur = match.currency;
        } else {
          setTier('cash');
          setAccountType('checking');
        }
      }

      if (res.currency && res.currency.trim()) {
        resolvedCur = res.currency.trim().toUpperCase();
      }
      setCurrency(resolvedCur);

      setClosingBalanceInput(
        res.closing_balance !== null && res.closing_balance !== undefined
          ? String(res.closing_balance)
          : ''
      );

      if (res.account_name) {
        setAccountName(detected ? `${detected} ${res.account_name}` : res.account_name);
      } else if (detected) {
        const typeLabel = nextType.charAt(0).toUpperCase() + nextType.slice(1);
        setAccountName(`${detected} ${typeLabel}`);
      } else {
        setAccountName('Bank Checking');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Statement parsing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndSync = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const balanceToCommit =
        closingBalanceInput.trim() !== '' ? parseFloat(closingBalanceInput) : undefined;
      const targetInst = institution.trim() || parseResult?.institution || 'Unknown';
      await uploadStatement(
        file,
        targetInst,
        true,
        selectedAccountId,
        balanceToCommit,
        tier,
        accountType,
        accountName.trim() || undefined,
        currency.trim() || undefined
      );
      setCommitted(true);
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to commit statement to ledger');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setInstitution('');
    setAccountName('');
    setCurrency('NZD');
    setClosingBalanceInput('');
    setCommitted(false);
    setError(null);
  };

  return (
    <GlassCard className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Statement Ingestion Hub</h3>
            <p className="text-xs text-slate-400">
              Drop bank or brokerage PDF/CSV to auto-detect and sync
            </p>
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedAccountId !== undefined ? selectedAccountId : ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAccountId(val ? Number(val) : undefined);
              }}
              className="bg-background border border-border text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none flex-1 sm:flex-none"
            >
              <option value="">Auto-detect / Create New Account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Link to: {acc.name} ({acc.institution})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {!parseResult ? (
        <FileDropzone
          file={file}
          onFileChange={setFile}
          acceptedFormats=".pdf,.csv"
          title="Drop your PDF/CSV statement here, or browse"
          description="Extracts official closing balances and deduplicated transactions with automatic institution detection"
          variant="amber"
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            {file ? (
              <Button
                variant="secondary"
                size="sm"
                loading={loading}
                loadingText="Parsing Statement..."
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
                onClick={handleParse}
              >
                Inspect Statement
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={loading}
                icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                onClick={handleLoadSampleStatement}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                Try Sample Statement
              </Button>
            )}
          </div>
        </FileDropzone>
      ) : (
        <StatementPreviewCard
          fileName={file?.name}
          parseResult={parseResult}
          selectedAccountId={selectedAccountId}
          institution={institution}
          accountName={accountName}
          accountType={accountType}
          currency={currency}
          tier={tier}
          closingBalanceInput={closingBalanceInput}
          loading={loading}
          committed={committed}
          institutionsList={institutionsList}
          accounts={accounts}
          onInstitutionChange={handleInstitutionChange}
          onAccountNameChange={setAccountName}
          onAccountTypeChange={setAccountType}
          onCurrencyChange={setCurrency}
          onTierChange={setTier}
          onClosingBalanceChange={setClosingBalanceInput}
          onConfirmAndSync={handleConfirmAndSync}
          onReset={handleReset}
        />
      )}
    </GlassCard>
  );
};
