export interface MockCategoryRecord {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  is_system: boolean;
  is_active: boolean;
  amortize_period: 'annual' | null;
  sort_order: number;
  transaction_count: number;
  rule_count: number;
  child_count: number;
  has_budget_rule: boolean;
  budget_period: 'weekly' | 'monthly' | 'annual' | null;
  weekly_limit: number | null;
  monthly_limit: number | null;
  annual_limit: number | null;
}

export interface MockAccountRecord {
  id: number;
  name: string;
  account_type: string;
  tier: string;
  institution: string;
  currency: string;
  expected_annual_return: number;
  is_active: boolean;
}

export interface MockBudgetRuleRecord {
  id: number;
  category: string;
  weekly_limit: number;
  monthly_limit: number;
  annual_limit: number;
  budget_period: 'weekly' | 'monthly' | 'annual';
  is_active: boolean;
}

export interface MockSplitRecord {
  id: number;
  transaction_id: number;
  amount: number;
  category: string;
  tags: string[];
  loan_id?: number | null;
  loan_name?: string | null;
  loan_type?: 'borrowed' | 'lent' | null;
  notes?: string | null;
}

export interface MockTransactionRecord {
  id: number;
  transaction_date: string;
  account_id: number;
  account_name: string;
  amount: number;
  currency: string;
  merchant: string;
  raw_description?: string | null;
  category: string;
  tags?: string[];
  recurrence?: string | null;
  has_receipt?: boolean;
  receipt_id?: number | null;
  receipt_document_type?: 'receipt' | 'payslip' | null;
  linked_transaction_id?: number | null;
  linked_account_name?: string | null;
  linked_amount?: number | null;
  linked_currency?: string | null;
  counterpart_account_id?: number | null;
  counterpart_account_name?: string | null;
  loan_id?: number | null;
  loan_name?: string | null;
  loan_type?: 'borrowed' | 'lent' | null;
  loan_payment_amount?: number | null;
  exchange_rate?: number | null;
  fee_amount?: number | null;
  is_amortized_commitment?: boolean;
  amortized_period_amount_nzd?: number | null;
  amortized_cadence?: string;
  splits?: MockSplitRecord[];
  is_split?: boolean;
}

export interface MockLoanRecord {
  id: number;
  name: string;
  lender: string;
  loan_type: 'borrowed' | 'lent';
  principal_amount: number;
  annual_interest_rate: number;
  term_months: number;
  monthly_payment: number;
  start_date: string;
  asset_value: number | null;
  currency: string;
  is_active: boolean;
  payments_made: number;
  payments_remaining: number;
  payoff_date: string | null;
  next_payment_date: string | null;
  remaining_principal: number;
  principal_paid: number;
  remaining_interest: number;
  weekly_payment_equivalent: number;
  net_worth_impact: number;
  total_paid_amount: number;
  interest_paid: number;
  last_payment_date: string | null;
  is_payment_due: boolean;
  linked_payments: unknown[];
  disbursements: unknown[];
}

export interface LoanLinkedEntry {
  tx: MockTransactionRecord;
  appliedAmt: number;
  signedAmt: number;
  loanPaymentAmount: number | null;
  splitId: number | null;
  notes: string | null;
  category: string;
}

export interface MockRuleRecord {
  id: number;
  name: string;
  description_pattern: string;
  match_type: 'contains' | 'exact' | 'starts_with';
  amount_equals: number | null;
  min_amount: number | null;
  max_amount: number | null;
  direction: 'outflow' | 'inflow' | null;
  target_category: string;
  target_tags: string[];
  target_recurrence: string | null;
  rename_merchant: string | null;
  counterpart_account_id: number | null;
  counterpart_account_name: string | null;
  loan_id: number | null;
  loan_name: string | null;
  loan_type: 'borrowed' | 'lent' | null;
  priority: number;
  is_active: boolean;
  match_count: number;
  created_at: string;
  updated_at: string;
}

export interface MockReceiptItemRecord {
  id: number;
  receipt_id: number;
  item_name: string;
  brand?: string | null;
  category: string;
  domain?: string | null;
  product_type?: string | null;
  volume_ml?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount?: number | null;
  total_price: number;
  inherited_tags?: string[];
  tags?: string[];
  created_at: string;
}

export interface MockReceiptRecord {
  id: number;
  document_type?: 'receipt' | 'payslip';
  merchant: string;
  receipt_date: string;
  total_amount: number;
  tax_amount?: number | null;
  currency: string;
  status: 'unlinked' | 'needs_review' | 'matched' | 'verified';
  transaction_id: number | null;
  order_number?: string | null;
  source_email_message_id?: string | null;
  has_image: boolean;
  is_processed: boolean;
  image_mime_type?: string | null;
  image_filename?: string | null;
  created_at: string;
  updated_at: string;
  items: MockReceiptItemRecord[];
}

export interface MockReceiptCandidateRecord {
  transaction_id: number;
  transaction_date: string;
  merchant: string | null;
  raw_description: string;
  amount: number;
  currency: string;
  account_id: number;
  account_name: string | null;
  original_amount?: number | null;
  original_currency?: string | null;
  estimated_receipt_amount?: number | null;
  confidence: number;
  match_reason: string;
}

export interface MockApiState {
  accounts: MockAccountRecord[];
  budgetRules: MockBudgetRuleRecord[];
  transactions: MockTransactionRecord[];
  amortizedUtilities: MockTransactionRecord[];
  loans: MockLoanRecord[];
  rules: MockRuleRecord[];
  receipts: MockReceiptRecord[];
  receiptCandidates: Record<number, MockReceiptCandidateRecord[]>;
  categories: MockCategoryRecord[];
  nextLoanId: number;
  nextSplitId: number;
  nextRuleId: number;
  nextCategoryId: number;
}
