import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal, TactileKeypad, NumberInputDisplay, ChipSelector } from '@yggdrasil-lab/ui';
import { quickLogExpense } from '../services/api';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = ['Food', 'Coffee', 'Groceries', 'Transport', 'Tech', 'Health', 'Leisure', 'Utilities'];

export const QuickLogModal: React.FC<QuickLogModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [amountStr, setAmountStr] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Food');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !merchant.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await quickLogExpense({
        amount: parsedAmount,
        merchant: merchant.trim(),
        category,
      });
      setAmountStr('');
      setMerchant('');
      setError(null);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to log expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Quick Expense">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
            {error}
          </div>
        )}
        {/* Amount Display */}
        <NumberInputDisplay
          label="Expense Amount"
          value={amountStr ? `$${amountStr}` : '$0'}
          unit="NZD"
          variant="amber"
        />

        {/* Merchant Name */}
        <div>
          <input
            type="text"
            placeholder="Merchant / Note (e.g. Cafe, BP, Pak n Save)"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            required
          />
        </div>

        {/* Category Chips */}
        <ChipSelector
          options={CATEGORIES}
          selected={category}
          onChange={setCategory}
          variant="amber"
        />

        {/* Numeric Keypad */}
        <TactileKeypad
          value={amountStr}
          onChange={setAmountStr}
          variant="amber"
          allowDecimals={true}
          maxDecimalPlaces={2}
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !amountStr || parseFloat(amountStr) <= 0 || !merchant.trim()}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 active:scale-[0.99] text-slate-950 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center space-x-2 transition-all"
        >
          <Check className="w-4 h-4" />
          <span>{loading ? 'Logging...' : 'Confirm & Log Expense'}</span>
        </button>
      </div>
    </Modal>
  );
};
