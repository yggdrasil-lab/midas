import React, { useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { FileDropzone, Button, StatCard } from '@yggdrasil-lab/ui';
import { Account, StatementParseResult } from '../types';
import { fetchAccounts, fetchSampleStatement, uploadStatement } from '../services/api';

interface StatementDropzoneProps {
  onSuccess: () => void;
}

export const StatementDropzone: React.FC<StatementDropzoneProps> = ({ onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [institution, setInstitution] = useState('ASB');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    fetchAccounts()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length > 0) {
          const matched = accs.find((a) => a.institution.toLowerCase().includes(institution.toLowerCase()));
          setSelectedAccountId(matched ? matched.id : accs[0].id);
        }
      })
      .catch((err) => console.warn('Could not pre-load accounts:', err));
  }, [institution]);

  const handleLoadSampleStatement = async () => {
    setLoading(true);
    setError(null);
    try {
      const csvText = await fetchSampleStatement(institution);
      const blob = new Blob([csvText], { type: 'text/csv' });
      const sampleFile = new File([blob], `${institution.toLowerCase()}-sample-statement.csv`, { type: 'text/csv' });
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

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setCommitted(false);
    setError(null);
    try {
      const res = await uploadStatement(file, institution, false);
      setParseResult(res);
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
      await uploadStatement(file, institution, true, selectedAccountId);
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
    setCommitted(false);
    setError(null);
  };

  const availableInstitutions = Array.from(
    new Set([
      ...accounts.map((a) => a.institution),
      'ASB',
      'ANZ',
      'BNZ',
      'Sharesies',
      'Simplicity',
      'Kernel',
    ])
  ).filter(Boolean);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Statement Ingestion Hub</h3>
            <p className="text-xs text-slate-400">Upload bank or brokerage PDF/CSV to anchor balances</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {accounts.length > 0 && (
            <select
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(Number(e.target.value) || undefined)}
              className="bg-background border border-border text-xs text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.institution})
                </option>
              ))}
            </select>
          )}

          <select
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="bg-background border border-border text-xs text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
          >
            {availableInstitutions.map((inst) => (
              <option key={inst} value={inst}>
                {inst}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
          {error}
        </div>
      )}

      {!parseResult ? (
        <FileDropzone
          file={file}
          onFileChange={setFile}
          acceptedFormats=".pdf,.csv"
          title="Drop your PDF/CSV statement here, or browse"
          description="Extracts official closing balances and deduplicated transactions"
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
                {`Try Sample ${institution} Statement`}
              </Button>
            )}
          </div>
        </FileDropzone>
      ) : (
        /* Extraction Preview Drawer */
        <div className="bg-background rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
            <span className="text-slate-400 font-medium">Detected from {file?.name}</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleReset}
            >
              Upload Different
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Official Closing Balance"
              value={
                parseResult.closing_balance !== null && parseResult.closing_balance !== undefined
                  ? `$${parseResult.closing_balance.toLocaleString('en-NZ')} NZD`
                  : 'N/A'
              }
              variant="emerald"
            />
            <StatCard
              title="Transactions Found"
              value={`${parseResult.transaction_count} items`}
              variant="card"
            />
          </div>

          {parseResult.transactions.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {parseResult.transactions.slice(0, 5).map((tx, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-card/50">
                  <span className="text-slate-300 truncate max-w-[200px]">{tx.merchant}</span>
                  <span className={tx.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}>
                    ${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {parseResult.transactions.length > 5 && (
                <div className="text-center text-[10px] text-slate-500 pt-1">
                  +{parseResult.transactions.length - 5} more transactions
                </div>
              )}
            </div>
          )}

          {!committed ? (
            <Button
              variant="emerald"
              size="md"
              fullWidth
              loading={loading}
              loadingText="Synchronizing..."
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={handleConfirmAndSync}
            >
              Confirm & Anchor Balances in Plutus
            </Button>
          ) : (
            <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-400 py-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Statement Synchronized & Anchored!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
