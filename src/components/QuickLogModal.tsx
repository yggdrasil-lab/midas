import React, { useEffect, useState } from 'react';
import { AlertBanner, Button, ChipSelector, NumericKeypadModal, TextInput } from '@yggdrasil-lab/ui';
import { useCategories } from '../taxonomy';
import { quickLogExpense } from '../transport';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function useQuickLogState(onClose: () => void, onSuccess: () => void) {
  const { budgetCategoryNames, loading: categoriesLoading, error: categoriesError, refreshCategories } = useCategories();
  const [amountStr, setAmountStr] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (budgetCategoryNames.length === 0) { setCategory(''); return; }
    if (!category || !budgetCategoryNames.includes(category)) setCategory(budgetCategoryNames[0]);
  }, [budgetCategoryNames, category]);

  const parsedAmount = parseFloat(amountStr);
  const isSubmitDisabled =
    !amountStr || isNaN(parsedAmount) || parsedAmount <= 0 || !merchant.trim() ||
    !category || categoriesLoading || Boolean(categoriesError);

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;
    setLoading(true);
    setError(null);
    try {
      await quickLogExpense({ amount: parsedAmount, merchant: merchant.trim(), category });
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

  return {
    amountStr, setAmountStr, merchant, setMerchant, category, setCategory,
    budgetCategoryNames, categoriesLoading, categoriesError, refreshCategories,
    loading, error, isSubmitDisabled, handleSubmit,
  };
}

const QuickLogCategorySection: React.FC<{
  categories: string[];
  selected: string;
  loading: boolean;
  error: string | null;
  onSelect: (category: string) => void;
  onRetry: () => void;
}> = ({ categories, selected, loading, error, onSelect, onRetry }) => {
  if (error) {
    return (
      <AlertBanner
        variant="error"
        title="Failed to load categories"
        action={
          <Button variant="rose" size="xs" onClick={onRetry} data-testid="quick-log-retry-categories-btn">
            Retry
          </Button>
        }
      >
        {error}
      </AlertBanner>
    );
  }
  if (loading && categories.length === 0) {
    return <div className="text-xs text-slate-400 py-1">Loading categories...</div>;
  }
  return <ChipSelector options={categories} selected={selected} onChange={onSelect} variant="brand" />;
};

/**
 * Tactile numeric keypad modal for rapidly logging an expense entry.
 */
export const QuickLogModal: React.FC<QuickLogModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const s = useQuickLogState(onClose, onSuccess);
  return (
    <NumericKeypadModal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Quick Expense"
      displayLabel="Expense Amount"
      value={s.amountStr}
      displayValue={s.amountStr ? `$${s.amountStr}` : '$0'}
      unit="NZD"
      onChange={s.setAmountStr}
      onSubmit={s.handleSubmit}
      submitLabel="Confirm & Log Expense"
      loading={s.loading}
      loadingText="Logging..."
      submitDisabled={s.isSubmitDisabled}
      allowDecimals
      maxDecimalPlaces={2}
      variant="brand"
      error={s.error}
    >
      <TextInput
        type="text"
        placeholder="Merchant / Note (e.g. Cafe, BP, Pak n Save)"
        value={s.merchant}
        onChange={(e) => s.setMerchant(e.target.value)}
        variant="brand"
        required
      />
      <QuickLogCategorySection
        categories={s.budgetCategoryNames}
        selected={s.category}
        loading={s.categoriesLoading}
        error={s.categoriesError}
        onSelect={s.setCategory}
        onRetry={() => void s.refreshCategories()}
      />
    </NumericKeypadModal>
  );
};
