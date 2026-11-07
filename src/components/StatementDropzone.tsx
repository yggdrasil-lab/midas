import React, { useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, ArrowRight, Sparkles, ShieldCheck, TrendingUp, Lock, X } from 'lucide-react';
import { FileDropzone, Button, StatCard, GlassCard, AlertBanner } from '@yggdrasil-lab/ui';
import { Account, InstitutionInfo, StatementParseResult } from '../types';
import { fetchAccounts, fetchInstitutions, fetchSampleStatement, uploadStatement } from '../services/api';

interface StatementDropzoneProps {
  onSuccess: () => void;
}

export const StatementDropzone: React.FC<StatementDropzoneProps> = ({ onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [institution, setInstitution] = useState('ASB');
  const [isCustomInstitution, setIsCustomInstitution] = useState(false);
  const [customInstitutionName, setCustomInstitutionName] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutionsList, setInstitutionsList] = useState<InstitutionInfo[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [tier, setTier] = useState<'cash' | 'growth' | 'locked'>('cash');
  const [accountType, setAccountType] = useState<string>('checking');
  const [accountName, setAccountName] = useState<string>('');
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
        if (accs.length > 0) {
          const matched = accs.find((a) => a.institution.toLowerCase().includes(institution.toLowerCase()));
          if (matched) {
            setSelectedAccountId(matched.id);
          }
        }
      })
      .catch((err) => console.warn('Could not load accounts or institutions:', err));
  }, []);

  const getEffectiveInstitution = (): string => {
    if (isCustomInstitution) {
      return customInstitutionName.trim() || 'Unknown';
    }
    return institution;
  };

  const handleInstitutionSelect = (val: string) => {
    if (val === '__custom__') {
      setIsCustomInstitution(true);
      setCustomInstitutionName('');
    } else {
      setIsCustomInstitution(false);
      setInstitution(val);
      const match = institutionsList.find((i) => i.name.toLowerCase() === val.toLowerCase());
      if (match) {
        setTier(match.default_tier);
        setAccountType(match.default_type);
        setAccountName(`${match.name} ${match.default_type.charAt(0).toUpperCase() + match.default_type.slice(1)}`);
      }
    }
  };

  const handleLoadSampleStatement = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeInst = getEffectiveInstitution();
      const csvText = await fetchSampleStatement(activeInst);
      const blob = new Blob([csvText], { type: 'text/csv' });
      const sampleFile = new File([blob], `${activeInst.toLowerCase()}-sample-statement.csv`, { type: 'text/csv' });
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
      const activeInst = getEffectiveInstitution();
      const res = await uploadStatement(file, activeInst, false);
      setParseResult(res);

      if (res.institution && res.institution !== 'Unknown' && res.institution !== activeInst) {
        const match = institutionsList.find((i) => i.name.toLowerCase() === res.institution.toLowerCase());
        if (match) {
          setInstitution(match.name);
          setIsCustomInstitution(false);
          setTier(match.default_tier);
          setAccountType(match.default_type);
        } else {
          setIsCustomInstitution(true);
          setCustomInstitutionName(res.institution);
        }
      }

      if (res.closing_balance !== null && res.closing_balance !== undefined) {
        setClosingBalanceInput(String(res.closing_balance));
      } else {
        setClosingBalanceInput('');
      }

      if (!accountName || accountName === `${activeInst} Checking` || accountName.endsWith('Checking') || accountName.endsWith('Account')) {
        const instLabel = res.institution && res.institution !== 'Unknown' ? res.institution : activeInst;
        if (res.account_name) {
          setAccountName(`${instLabel} ${res.account_name}`);
        } else {
          setAccountName(`${instLabel} Account`);
        }
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
      const balanceToCommit = closingBalanceInput.trim() !== '' ? parseFloat(closingBalanceInput) : undefined;
      const activeInst = getEffectiveInstitution();
      await uploadStatement(
        file,
        activeInst,
        true,
        selectedAccountId,
        balanceToCommit,
        tier,
        accountType,
        accountName.trim() || undefined
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
    setClosingBalanceInput('');
    setCommitted(false);
    setError(null);
  };

  // Distinct list of known institutions
  const combinedInstitutions = Array.from(
    new Set([
      ...institutionsList.map((i) => i.name),
      ...accounts.map((a) => a.institution),
    ])
  ).filter(Boolean);

  return (
    <GlassCard className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Statement Ingestion Hub</h3>
            <p className="text-xs text-slate-400">Upload bank or brokerage PDF/CSV to anchor balances</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Target Account Selector */}
          <select
            value={selectedAccountId !== undefined ? selectedAccountId : ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAccountId(val ? Number(val) : undefined);
            }}
            className="bg-background border border-border text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none flex-1 sm:flex-none"
          >
            <option value="">+ Create New Account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.institution})
              </option>
            ))}
          </select>

          {/* Institution Selector or Custom Input */}
          {!selectedAccountId && (
            <>
              {!isCustomInstitution ? (
                <select
                  value={institution}
                  onChange={(e) => handleInstitutionSelect(e.target.value)}
                  className="bg-background border border-border text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none flex-1 sm:flex-none"
                >
                  {combinedInstitutions.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                  <option value="__custom__">+ Custom Institution...</option>
                </select>
              ) : (
                <div className="flex items-center space-x-1 flex-1 sm:flex-none">
                  <input
                    type="text"
                    placeholder="Institution Name (e.g. Milford)"
                    value={customInstitutionName}
                    onChange={(e) => setCustomInstitutionName(e.target.value)}
                    className="bg-background border border-border text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 w-36 sm:w-40"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomInstitution(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-card/50"
                    title="Switch to known institutions"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <AlertBanner variant="error">
          {error}
        </AlertBanner>
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
                {`Try Sample ${getEffectiveInstitution()} Statement`}
              </Button>
            )}
          </div>
        </FileDropzone>
      ) : (
        /* Extraction Preview Drawer */
        <div className="bg-background rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
            <span className="text-slate-400 font-medium">
              Detected from {file?.name} ({parseResult.institution || getEffectiveInstitution()}
              {parseResult.account_name ? ` · ${parseResult.account_name}` : ''}
              {parseResult.account_number_masked ? ` · ${parseResult.account_number_masked}` : ''})
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleReset}
            >
              Upload Different
            </Button>
          </div>

          {/* New Account Details Form (shown when creating a new account) */}
          {!selectedAccountId && (
            <div className="p-3 bg-card/60 rounded-xl border border-border space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-slate-200">Account Configuration</span>
                <span className="text-[11px] text-amber-400">New Account Provisioning</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Account Display Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. ASB Everyday Checking"
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Account Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="checking">Checking (Everyday)</option>
                    <option value="savings">Savings (Interest / Cash Floor)</option>
                    <option value="brokerage">Brokerage (Equities / Growth)</option>
                    <option value="kiwisaver">KiwiSaver (Pension / Locked)</option>
                    <option value="crypto">Crypto</option>
                    <option value="credit_card">Credit Card</option>
                  </select>
                </div>
              </div>

              {/* Asset Tier Selection Pills */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Asset Tier (Telemetry Placement)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTier('cash')}
                    className={`flex items-center justify-center space-x-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      tier === 'cash'
                        ? 'bg-sky-500/10 border-sky-500/50 text-sky-400'
                        : 'bg-card border-border text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>Cash Floor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('growth')}
                    className={`flex items-center justify-center space-x-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      tier === 'growth'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        : 'bg-card border-border text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>Growth</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('locked')}
                    className={`flex items-center justify-center space-x-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      tier === 'locked'
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                        : 'bg-card border-border text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-3 h-3 shrink-0" />
                    <span>Locked</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Official Closing Balance"
              value={
                closingBalanceInput.trim() !== ''
                  ? `$${parseFloat(closingBalanceInput || '0').toLocaleString('en-NZ')} NZD`
                  : parseResult.closing_balance !== null && parseResult.closing_balance !== undefined
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

          <div className="p-3 bg-card/60 rounded-xl border border-border flex items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              <span className="font-medium text-slate-200">Account Closing Balance:</span>
              <p className="text-[11px] text-slate-400">
                {parseResult.closing_balance !== null && parseResult.closing_balance !== undefined
                  ? 'Detected from statement. Anchors your live balance in Plutus.'
                  : 'Enter ending statement balance to anchor in Plutus.'}
              </p>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className="text-xs text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingBalanceInput}
                onChange={(e) => setClosingBalanceInput(e.target.value)}
                className="w-28 px-2 py-1 bg-background border border-border rounded text-xs text-slate-100 font-mono text-right focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-400">NZD</span>
            </div>
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
    </GlassCard>
  );
};
