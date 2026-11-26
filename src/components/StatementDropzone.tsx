import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, UploadCloud } from 'lucide-react';
import { AlertBanner, Button, FileDropzone, GlassCard, SectionHeader, SelectInput } from '@yggdrasil-lab/ui';
import {
  fetchAccounts,
  fetchInstitutions,
  uploadStatement,
} from '../transport';
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

type StatementActionSetters = {
  setInstitution: (v: string) => void;
  setTier: (v: Account['tier']) => void;
  setAccountType: (v: string) => void;
  setAccountName: (v: string) => void;
  setCurrency: (v: string) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setParseResult: (v: StatementParseResult | null) => void;
  setClosingBalanceInput: (v: string) => void;
  setCommitted: (v: boolean) => void;
  setFile: (v: File | null) => void;
};

async function runStatementParse(file: File, institutionsList: InstitutionInfo[], setters: StatementActionSetters) {
  setters.setLoading(true); setters.setCommitted(false); setters.setError(null);
  try {
    const res = await uploadStatement(file, 'auto', false);
    const meta = resolveParsedAccountMetadata(res, institutionsList);
    setters.setParseResult(res); setters.setInstitution(meta.detected); setters.setTier(meta.tier);
    setters.setAccountType(meta.accountType); setters.setCurrency(meta.currency);
    setters.setClosingBalanceInput(meta.closingBalanceInput); setters.setAccountName(meta.accountName);
  } catch (err) {
    setters.setError(err instanceof Error ? err.message : 'Statement parsing failed');
  } finally { setters.setLoading(false); }
}

function useStatementDropzoneActions(opts: {
  file: File | null;
  institution: string;
  selectedAccountId: number | undefined;
  tier: Account['tier'];
  accountType: string;
  accountName: string;
  currency: string;
  closingBalanceInput: string;
  institutionsList: InstitutionInfo[];
  parseResult: StatementParseResult | null;
  onSuccess: () => void;
  setters: StatementActionSetters;
}) {
  const { setters } = opts;
  const handleInstitutionChange = (val: string) => {
    setters.setInstitution(val);
    const match = opts.institutionsList.find((i) => i.name.toLowerCase() === val.toLowerCase());
    if (match) {
      setters.setTier(match.default_tier); setters.setAccountType(match.default_type);
      if (match.currency) setters.setCurrency(match.currency);
    }
  };

  const handleConfirmAndSync = async () => {
    if (!opts.file) return;
    setters.setLoading(true); setters.setError(null);
    try {
      const balanceToCommit = opts.closingBalanceInput.trim() !== '' ? parseFloat(opts.closingBalanceInput) : undefined;
      const targetInst = opts.institution.trim() || opts.parseResult?.institution || 'Unknown';
      await uploadStatement(opts.file, targetInst, true, opts.selectedAccountId, balanceToCommit, opts.tier, opts.accountType, opts.accountName.trim() || undefined, opts.currency.trim() || undefined);
      setters.setCommitted(true); opts.onSuccess();
    } catch (err) {
      setters.setError(err instanceof Error ? err.message : 'Failed to commit statement to ledger');
    } finally { setters.setLoading(false); }
  };

  const handleReset = () => {
    setters.setFile(null); setters.setParseResult(null); setters.setInstitution('');
    setters.setAccountName(''); setters.setCurrency('NZD'); setters.setClosingBalanceInput('');
    setters.setCommitted(false); setters.setError(null);
  };

  return {
    handleInstitutionChange,
    handleParse: () => (opts.file ? runStatementParse(opts.file, opts.institutionsList, setters) : Promise.resolve()),
    handleConfirmAndSync,
    handleReset,
  };
}

function useStatementMetadata() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutionsList, setInstitutionsList] = useState<InstitutionInfo[]>([]);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const loadMetadata = useCallback(async () => {
    setMetadataError(null);
    try {
      const [accs, insts] = await Promise.all([fetchAccounts(), fetchInstitutions()]);
      setAccounts(accs);
      setInstitutionsList(insts);
    } catch (err) {
      console.error('Failed to load accounts or institutions:', err);
      setAccounts([]);
      setInstitutionsList([]);
      setMetadataError(err instanceof Error ? err.message : 'Failed to load accounts or institutions');
    }
  }, []);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  return { accounts, institutionsList, metadataError, retryMetadata: loadMetadata };
}

function useStatementDropzoneState(onSuccess: () => void) {
  const meta = useStatementMetadata();
  const [file, setFile] = useState<File | null>(null);
  const [institution, setInstitution] = useState('');
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

  const actions = useStatementDropzoneActions({
    file, institution, selectedAccountId, tier, accountType, accountName,
    currency, closingBalanceInput, institutionsList: meta.institutionsList, parseResult, onSuccess,
    setters: {
      setInstitution, setTier, setAccountType, setAccountName, setCurrency,
      setLoading, setError, setParseResult, setClosingBalanceInput, setCommitted, setFile,
    },
  });

  return {
    ...meta, file, setFile, institution, selectedAccountId, setSelectedAccountId,
    tier, setTier, accountType, setAccountType, accountName, setAccountName, currency, setCurrency,
    loading, error, parseResult, closingBalanceInput, setClosingBalanceInput, committed, ...actions,
  };
}

const StatementTargetAccountSelect: React.FC<{
  accounts: Account[];
  selectedAccountId: number | undefined;
  onChange: (id: number | undefined) => void;
}> = ({ accounts, selectedAccountId, onChange }) => {
  if (accounts.length === 0) return null;
  return (
    <SelectInput
      value={selectedAccountId !== undefined ? String(selectedAccountId) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      variant="brand"
      containerClassName="w-auto"
      className="min-h-[38px] py-1.5 text-xs text-slate-300"
      aria-label="Target statement account"
    >
      <option value="">Auto-detect / Create New Account</option>
      {accounts.map((acc) => (
        <option key={acc.id} value={acc.id}>
          Link to: {acc.name} ({acc.institution})
        </option>
      ))}
    </SelectInput>
  );
};

const StatementErrorBanners: React.FC<{
  metadataError: string | null;
  error: string | null;
  onRetryMetadata: () => void;
}> = ({ metadataError, error, onRetryMetadata }) => (
  <>
    {metadataError && (
      <AlertBanner
        variant="error"
        title="Failed to load accounts or institutions"
        action={
          <Button variant="rose" size="xs" onClick={onRetryMetadata} data-testid="statement-retry-metadata-btn">
            Retry
          </Button>
        }
      >
        {metadataError}
      </AlertBanner>
    )}
    {error && <AlertBanner variant="error">{error}</AlertBanner>}
  </>
);

const StatementUploadDropzone: React.FC<{
  file: File | null;
  loading: boolean;
  onFileChange: (file: File | null) => void;
  onParse: () => void;
}> = ({ file, loading, onFileChange, onParse }) => (
  <FileDropzone
    file={file}
    onFileChange={onFileChange}
    acceptedFormats=".pdf,.csv"
    title="Drop your PDF/CSV statement here, or browse"
    description="Extracts official closing balances and deduplicated transactions with automatic institution detection"
    variant="brand"
  >
    {file && (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          loadingText="Parsing Statement..."
          icon={<ArrowRight className="w-3.5 h-3.5" />}
          iconPosition="right"
          onClick={onParse}
        >
          Inspect Statement
        </Button>
      </div>
    )}
  </FileDropzone>
);

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
        actions={<StatementTargetAccountSelect accounts={s.accounts} selectedAccountId={s.selectedAccountId} onChange={s.setSelectedAccountId} />}
      />
      <StatementErrorBanners metadataError={s.metadataError} error={s.error} onRetryMetadata={() => void s.retryMetadata()} />
      {!s.parseResult ? (
        <StatementUploadDropzone file={s.file} loading={s.loading} onFileChange={s.setFile} onParse={s.handleParse} />
      ) : (
        <StatementPreviewCard
          fileName={s.file?.name} parseResult={s.parseResult} selectedAccountId={s.selectedAccountId}
          institution={s.institution} accountName={s.accountName} accountType={s.accountType}
          currency={s.currency} tier={s.tier} closingBalanceInput={s.closingBalanceInput}
          loading={s.loading} committed={s.committed} institutionsList={s.institutionsList}
          accounts={s.accounts} onInstitutionChange={s.handleInstitutionChange}
          onAccountNameChange={s.setAccountName} onAccountTypeChange={s.setAccountType}
          onCurrencyChange={s.setCurrency} onTierChange={s.setTier}
          onClosingBalanceChange={s.setClosingBalanceInput} onConfirmAndSync={s.handleConfirmAndSync}
          onReset={s.handleReset}
        />
      )}
    </GlassCard>
  );
};
