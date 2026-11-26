import type { LoanItem, LoanPaymentItem, RecurringCommitmentItem } from '../types';

export interface EnrichedRecurringCommitment {
  commitment: RecurringCommitmentItem;
  linkedLoan: LoanItem | null;
}

export interface ReconciledFixedBurn {
  commitments: EnrichedRecurringCommitment[];
  pendingLoans: LoanItem[];
  totalItemCount: number;
}

/** Keep only active borrowed loans with a positive scheduled monthly payment. */
export function filterActiveBorrowedLoans(loans: LoanItem[]): LoanItem[] {
  return loans.filter(
    (loan) => loan.is_active && loan.loan_type !== 'lent' && loan.monthly_payment > 0
  );
}

function isMatchingRepayment(
  entry: LoanPaymentItem,
  commitment: RecurringCommitmentItem
): boolean {
  if (entry.entry_type === 'disbursement') return false;
  if (entry.id !== commitment.transaction_id) return false;
  return entry.split_id == null || entry.category === commitment.category;
}

function findLinkedLoan(
  commitment: RecurringCommitmentItem,
  eligibleLoans: LoanItem[]
): LoanItem | null {
  return (
    eligibleLoans.find((loan) =>
      (loan.linked_payments ?? []).some((entry) => isMatchingRepayment(entry, commitment))
    ) ?? null
  );
}

/**
 * Deduplicate active borrowed loans against recurring commitments that already
 * represent a linked repayment transaction, leaving only unlinked loans as pending.
 */
export function reconcileFixedBurn(
  commitments: RecurringCommitmentItem[],
  loans: LoanItem[]
): ReconciledFixedBurn {
  const eligibleLoans = filterActiveBorrowedLoans(loans);
  const matchedLoanIds = new Set<number>();

  const enriched = commitments.map((commitment) => {
    const linkedLoan = findLinkedLoan(commitment, eligibleLoans);
    if (linkedLoan !== null) {
      matchedLoanIds.add(linkedLoan.id);
    }
    return { commitment, linkedLoan };
  });

  const pendingLoans = eligibleLoans.filter((loan) => !matchedLoanIds.has(loan.id));

  return {
    commitments: enriched,
    pendingLoans,
    totalItemCount: enriched.length + pendingLoans.length,
  };
}
