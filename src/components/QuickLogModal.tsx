import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '@yggdrasil-lab/ui';
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

  const handleKeyPress = (val: string) => {
    if (val === 'C') {
      setAmountStr('');
      return;
    }
    if (val === '.' && amountStr.includes('.')) return;
    if (amountStr.length >= 7) return;
    setAmountStr((prev) => prev + val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !merchant.trim()) return;

    setLoading(true);
    try {
      await quickLogExpense({
        amount: parsedAmount,
        merchant: merchant.trim(),
        category,
      });
      setAmountStr('');
      setMerchant('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Quick Expense">
      <div className="space-y-4">
        {/* Amount Display */}
        <div className="text-center py-3 bg-background rounded-2xl border border-border/80">
          <span className="text-xs text-slate-400 block mb-1">Expense Amount</span>
          <div className="text-4xl font-black text-amber-400">
            ${amountStr || '0'} <span className="text-sm font-normal text-slate-400">NZD</span>
          </div>
        </div>

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
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                category === cat
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-background text-slate-400 hover:text-slate-200 border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'C'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeyPress(k)}
              className="py-3 bg-background/80 hover:bg-background active:scale-95 border border-border/60 rounded-xl text-lg font-semibold text-slate-100 shadow-sm transition-all"
            >
              {k}
            </button>
          ))}
        </div>

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
