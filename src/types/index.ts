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
