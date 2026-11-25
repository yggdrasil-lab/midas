import React, { useState } from 'react';
import { ChipSelector, NumericKeypadModal, TextInput } from '@yggdrasil-lab/ui';
import { QUICK_LOG_CATEGORIES } from '../constants/categories';
import { quickLogExpense } from '../services/api';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories?: string[];
}

/**
 * Tactile numeric keypad modal for rapidly logging an expense entry.
 */
export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
}) => {
  const activeCategories =
    categories && categories.length > 0 ? categories : QUICK_LOG_CATEGORIES;
  const [amountStr, setAmountStr] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState(activeCategories[0] || 'Food');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
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
    <NumericKeypadModal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Quick Expense"
      displayLabel="Expense Amount"
      value={amountStr}
      displayValue={amountStr ? `$${amountStr}` : '$0'}
      unit="NZD"
      onChange={setAmountStr}
      onSubmit={handleSubmit}
      submitLabel="Confirm & Log Expense"
      loading={loading}
      loadingText="Logging..."
      submitDisabled={!amountStr || parseFloat(amountStr) <= 0 || !merchant.trim()}
      allowDecimals
      maxDecimalPlaces={2}
      variant="amber"
      error={error}
    >
      <TextInput
        type="text"
        placeholder="Merchant / Note (e.g. Cafe, BP, Pak n Save)"
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
        variant="amber"
        required
      />

      <ChipSelector
        options={activeCategories}
        selected={category}
        onChange={setCategory}
        variant="amber"
      />
    </NumericKeypadModal>
  );
};
