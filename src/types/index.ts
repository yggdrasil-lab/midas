export interface Account {
  id: number;
  name: string;
  account_type: 'checking' | 'savings' | 'brokerage' | 'kiwisaver' | 'crypto' | 'credit_card';
  tier: 'cash' | 'growth' | 'locked';
  institution: string;
  currency: string;
  expected_annual_return: number;
  is_active: boolean;
}

export interface AssetSnapshot {
  id: number;
  snapshot_date: string;
  account_id: number;
  balance: number;
  currency: string;
  exchange_rate: number;
  balance_nzd: number;
  source: string;
  notes?: string | null;
  created_at?: string;
}

export interface AssetSnapshotCreatePayload {
  snapshot_date: string;
  account_id: number;
  balance: number;
  currency?: string;
  exchange_rate?: number;
  source?: string;
  notes?: string | null;
}

export interface RunwayTierBreakdown {
  cash_balance: number;
  growth_balance: number;
  locked_balance: number;
  total_liquid_balance: number;
  emergency_weeks: number;
  growth_weeks: number | null;
  locked_weeks?: number | null;
  is_perpetual: boolean;
  perpetual_threshold_weekly_income: number;
  weekly_burn_rate: number;
  tier_labels?: Record<string, string>;
}

export interface RunwayData {
  as_of_date: string;
  primary_runway_weeks: number;
  primary_runway_years: number;
  is_perpetual: boolean;
  time_banked_this_week: number;
  weekly_spend_this_week: number;
  weekly_budget_target: number;
  breakdown: RunwayTierBreakdown;
  categories?: string[];
}

export interface RunwayScenarioResult {
  simulated_runway_weeks: number | null;
  simulated_runway_years: number | null;
  is_perpetual: boolean;
  delta_weeks_compared_to_baseline: number | null;
}

export interface RunwayAiSynthesisResult {
  headline: string;
  recommendations: string[];
  rationale: string;
  research_citation: string;
  impact_summary: string;
  is_llm_generated: boolean;
  simulated_runway_weeks?: number | null;
  simulated_runway_years?: number | null;
  is_perpetual: boolean;
  delta_weeks_compared_to_baseline?: number | null;
}

export interface ParsedTransaction {
  transaction_date: string;
  amount: number;
  merchant: string;
  raw_description: string;
  category: string;
}

export interface StatementParseResult {
  institution: string;
  account_number_masked?: string;
  account_name?: string;
  start_date?: string;
  end_date?: string;
  opening_balance?: number;
  closing_balance?: number;
  currency: string;
  transaction_count: number;
  transactions: ParsedTransaction[];
}

export interface InstitutionInfo {
  name: string;
  default_tier: 'cash' | 'growth' | 'locked';
  default_type: 'checking' | 'savings' | 'brokerage' | 'kiwisaver' | 'crypto' | 'credit_card';
  currency: string;
}

export interface Transaction {
  id: number;
  transaction_date: string;
  account_id: number;
  account_name?: string | null;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  raw_description?: string | null;
  notes?: string | null;
  raw_hash?: string;
  has_receipt?: boolean;
  receipt_id?: number | null;
  linked_transaction_id?: number | null;
  exchange_rate?: number | null;
  fee_amount?: number | null;
  created_at?: string;
}

export interface BudgetRule {
  id: number;
  category: string;
  weekly_limit: number;
  monthly_limit: number;
  is_active: boolean;
}

export interface CategorySpendingReport {
  category: string;
  total_spend: number;
  transaction_count: number;
  percentage: number;
  budget_limit?: number | null;
  percent_used?: number | null;
  is_over_budget: boolean;
  warning_level: 'normal' | 'warning' | 'danger';
  is_transfer?: boolean;
}

export interface SpendingBreakdownResponse {
  period: 'week' | 'month' | 'all';
  start_date?: string | null;
  end_date?: string | null;
  total_spend: number;
  total_income: number;
  total_transfers?: number;
  net_savings: number;
  categories: CategorySpendingReport[];
  over_budget_count: number;
}

export interface CategorizationRule {
  id: number;
  name: string;
  description_pattern: string;
  match_type: 'contains' | 'exact' | 'starts_with';
  amount_equals?: number | null;
  target_category: string;
  rename_merchant?: string | null;
  priority: number;
  is_active: boolean;
  match_count: number;
  created_at: string;
  updated_at: string;
}

export interface CategorizationRuleCreate {
  name: string;
  description_pattern: string;
  match_type?: 'contains' | 'exact' | 'starts_with';
  amount_equals?: number | null;
  target_category: string;
  rename_merchant?: string | null;
  priority?: number;
  is_active?: boolean;
  apply_retroactively?: boolean;
}

export interface ReceiptItem {
  id: number;
  receipt_id: number;
  product_id?: number | null;
  item_name: string;
  brand?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
  domain?: string | null;
  product_type?: string | null;
  tags?: string[];
  volume_ml?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Receipt {
  id: number;
  transaction_id?: number | null;
  receipt_date: string;
  merchant: string;
  total_amount: number;
  currency: string;
  tax_amount?: number | null;
  status: 'unlinked' | 'matched' | 'verified';
  image_path?: string | null;
  raw_text?: string | null;
  notes?: string | null;
  items: ReceiptItem[];
  created_at: string;
  updated_at: string;
}

export interface ProductStatisticItem {
  item_name: string;
  brand?: string | null;
  category: string;
  domain?: string | null;
  product_type?: string | null;
  volume_ml?: string | null;
  purchase_count: number;
  total_spent: number;
  unit_price_latest: number;
  first_purchased: string;
  last_purchased: string;
  avg_days_between_purchases?: number | null;
  estimated_depletion_date?: string | null;
}

export interface ProductStatisticsResponse {
  domain?: string | null;
  total_products: number;
  total_spend: number;
  products: ProductStatisticItem[];
}

export interface PricePoint {
  date: string;
  merchant: string;
  unit_price: number;
  total_price: number;
  quantity: number;
  receipt_id: number;
  receipt_item_id: number;
}

export interface Product {
  id: number;
  name: string;
  brand?: string | null;
  category: string;
  domain?: string | null;
  tags: string[];
  volume_ml?: string | null;
  notes?: string | null;
  rating?: number | null;
  is_favorite: boolean;
  purchase_count: number;
  total_spent: number;
  latest_price?: number | null;
  lowest_price?: number | null;
  highest_price?: number | null;
  average_price?: number | null;
  price_change_latest?: number | null;
  first_purchased?: string | null;
  last_purchased?: string | null;
  avg_days_between_purchases?: number | null;
  estimated_depletion_date?: string | null;
  price_history: PricePoint[];
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  total_count: number;
  all_tags: string[];
  products: Product[];
}

export interface ProductUpdatePayload {
  name?: string;
  brand?: string | null;
  category?: string;
  domain?: string | null;
  tags?: string[];
  volume_ml?: string | null;
  notes?: string | null;
  rating?: number | null;
  is_favorite?: boolean;
}



