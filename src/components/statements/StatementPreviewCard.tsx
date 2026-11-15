import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button, StatCard } from '@yggdrasil-lab/ui';
import { Account, InstitutionInfo, StatementParseResult } from '../../types';
import { formatMoney } from '../../utils/format';
import { StatementConfigForm } from './StatementConfigForm';

interface StatementPreviewCardProps {
  fileName?: string;
  parseResult: StatementParseResult;
  selectedAccountId?: number;
  institution: string;
  accountName: string;
  accountType: string;
  currency: string;
  tier: Account['tier'];
  closingBalanceInput: string;
  loading: boolean;
  committed: boolean;
  institutionsList: InstitutionInfo[];
  accounts: Account[];
  onInstitutionChange: (val: string) => void;
  onAccountNameChange: (val: string) => void;
  onAccountTypeChange: (val: string) => void;
  onCurrencyChange: (val: string) => void;
  onTierChange: (tier: Account['tier']) => void;
  onClosingBalanceChange: (val: string) => void;
  onConfirmAndSync: () => void;
  onReset: () => void;
}

/**
 * Preview drawer displaying parsed statement metadata, account creation fields,
 * closing balance input, sample transactions, and commit trigger.
 */
export const StatementPreviewCard: React.FC<StatementPreviewCardProps> = ({
  fileName,
  parseResult,
  selectedAccountId,
  institution,
  accountName,
  accountType,
  currency,
  tier,
  closingBalanceInput,
  loading,
  committed,
  institutionsList,
  accounts,
  onInstitutionChange,
  onAccountNameChange,
  onAccountTypeChange,
  onCurrencyChange,
  onTierChange,
  onClosingBalanceChange,
  onConfirmAndSync,
  onReset,
}) => {
  const closingDisplay =
    closingBalanceInput.trim() !== ''
      ? `${formatMoney(parseFloat(closingBalanceInput || '0'), {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} ${currency}`
      : parseResult.closing_balance !== null && parseResult.closing_balance !== undefined
      ? `${formatMoney(parseResult.closing_balance, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} ${currency}`
      : 'N/A';

  return (
    <div className="bg-background rounded-xl p-4 border border-border space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
        <span className="text-slate-400 font-medium">
          Detected from {fileName} ({parseResult.institution || 'Unknown'}
          {parseResult.account_name ? ` · ${parseResult.account_name}` : ''}
          {parseResult.account_number_masked ? ` · ${parseResult.account_number_masked}` : ''})
        </span>
        <Button variant="ghost" size="xs" onClick={onReset}>
          Upload Different
        </Button>
      </div>

      {!selectedAccountId && (
        <StatementConfigForm
          detectedInstitution={parseResult.institution}
          institution={institution}
          accountName={accountName}
          accountType={accountType}
          currency={currency}
          tier={tier}
          institutionsList={institutionsList}
          accounts={accounts}
          onInstitutionChange={onInstitutionChange}
          onAccountNameChange={onAccountNameChange}
          onAccountTypeChange={onAccountTypeChange}
          onCurrencyChange={onCurrencyChange}
          onTierChange={onTierChange}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Official Closing Balance"
          value={closingDisplay}
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
            onChange={(e) => onClosingBalanceChange(e.target.value)}
            className="w-28 px-2 py-1 bg-background border border-border rounded text-xs text-slate-100 font-mono text-right focus:outline-none focus:border-amber-500"
          />
          <span className="text-[10px] text-slate-400 font-mono">{currency}</span>
        </div>
      </div>

      {parseResult.transactions.length > 0 && (
        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
          {parseResult.transactions.slice(0, 5).map((tx, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center text-xs py-1 px-2 rounded bg-card/50"
            >
              <span className="text-slate-300 truncate max-w-[200px]">{tx.merchant}</span>
              <span className={tx.amount < 0 ? 'text-slate-300' : 'text-emerald-400'}>
                {formatMoney(tx.amount, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {tx.currency || currency}
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
          onClick={onConfirmAndSync}
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
  );
};
