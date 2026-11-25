import React, { useEffect, useState } from 'react';
import { ArrowRight, UploadCloud } from 'lucide-react';
import { AlertBanner, Button, FileDropzone, GlassCard, SectionHeader, SelectInput } from '@yggdrasil-lab/ui';
import {
  fetchAccounts,
  fetchInstitutions,
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
function resolveParsedAccountMetadata(
  res: StatementParseResult,
  institutionsList: InstitutionInfo[]
) {
  const detected = res.institution && res.institution !== 'Unknown' ? res.institution : '';
  const match = detected
    ? institutionsList.find((i) => i.name.toLowerCase() === detected.toLowerCase())
    : undefined;
  const tier: Account['tier'] = match ? match.default_tier : 'cash';
  const accountType = match ? match.default_type : 'checking';
  const currency =
    res.currency?.trim().toUpperCase() || match?.currency || 'NZD';
  const typeLabel = accountType.charAt(0).toUpperCase() + accountType.slice(1);
  const accountName = res.account_name
    ? detected
      ? `${detected} ${res.account_name}`
      : res.account_name
    : detected
      ? `${detected} ${typeLabel}`
      : 'Bank Checking';

  return {
    detected,
    tier,
    accountType,
    currency,
    accountName,
    closingBalanceInput:
      res.closing_balance !== null && res.closing_balance !== undefined
        ? String(res.closing_balance)
        : '',
  };
}

function useStatementDropzoneState(onSuccess: () => void) {
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
      const meta = resolveParsedAccountMetadata(res, institutionsList);
      setParseResult(res);
      setInstitution(meta.detected);
      setTier(meta.tier);
      setAccountType(meta.accountType);
      setCurrency(meta.currency);
      setClosingBalanceInput(meta.closingBalanceInput);
      setAccountName(meta.accountName);
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
        file, targetInst, true, selectedAccountId, balanceToCommit,
        tier, accountType, accountName.trim() || undefined, currency.trim() || undefined
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

  return {
    file, setFile, institution, accounts, institutionsList, selectedAccountId, setSelectedAccountId,
    tier, setTier, accountType, setAccountType, accountName, setAccountName, currency, setCurrency,
    loading, error, parseResult, closingBalanceInput, setClosingBalanceInput, committed,
    handleInstitutionChange, handleParse, handleConfirmAndSync, handleReset,
  };
}

/**
 * Bank and brokerage statement dropzone with dry-run inspection,
 * institution auto-detection, and ledger anchoring.
 */
export const StatementDropzone: React.FC<StatementDropzoneProps> = ({ onSuccess }) => {
  const s = useStatementDropzoneState(onSuccess);

  return (
    <GlassCard className="space-y-4">
      <SectionHeader
        title="Statement Ingestion Hub"
        subtitle="Drop bank or brokerage PDF/CSV to auto-detect and sync"
        icon={<UploadCloud className="w-4 h-4" />}
        variant="emerald"
        actions={
          s.accounts.length > 0 ? (
            <SelectInput
              value={s.selectedAccountId !== undefined ? String(s.selectedAccountId) : ''}
              onChange={(e) => {
                const val = e.target.value;
                s.setSelectedAccountId(val ? Number(val) : undefined);
              }}
              variant="amber"
              containerClassName="w-auto"
              className="min-h-[38px] py-1.5 text-xs text-slate-300"
              aria-label="Target statement account"
            >
              <option value="">Auto-detect / Create New Account</option>
              {s.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Link to: {acc.name} ({acc.institution})
                </option>
              ))}
            </SelectInput>
          ) : undefined
        }
      />

      {s.error && <AlertBanner variant="error">{s.error}</AlertBanner>}

      {!s.parseResult ? (
        <FileDropzone
          file={s.file}
          onFileChange={s.setFile}
          acceptedFormats=".pdf,.csv"
          title="Drop your PDF/CSV statement here, or browse"
          description="Extracts official closing balances and deduplicated transactions with automatic institution detection"
          variant="amber"
        >
          {s.file && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={s.loading}
                loadingText="Parsing Statement..."
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
                onClick={s.handleParse}
              >
                Inspect Statement
              </Button>
            </div>
          )}
        </FileDropzone>
      ) : (
        <StatementPreviewCard
          fileName={s.file?.name}
          parseResult={s.parseResult}
          selectedAccountId={s.selectedAccountId}
          institution={s.institution}
          accountName={s.accountName}
          accountType={s.accountType}
          currency={s.currency}
          tier={s.tier}
          closingBalanceInput={s.closingBalanceInput}
          loading={s.loading}
          committed={s.committed}
          institutionsList={s.institutionsList}
          accounts={s.accounts}
          onInstitutionChange={s.handleInstitutionChange}
          onAccountNameChange={s.setAccountName}
          onAccountTypeChange={s.setAccountType}
          onCurrencyChange={s.setCurrency}
          onTierChange={s.setTier}
          onClosingBalanceChange={s.setClosingBalanceInput}
          onConfirmAndSync={s.handleConfirmAndSync}
          onReset={s.handleReset}
        />
      )}
    </GlassCard>
  );
};
