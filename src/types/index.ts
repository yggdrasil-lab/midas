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
  is_perpetual: boolean;
  perpetual_threshold_weekly_income: number;
  weekly_burn_rate: number;
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
  start_date?: string;
  end_date?: string;
  opening_balance?: number;
  closing_balance?: number;
  currency: string;
  transaction_count: number;
  transactions: ParsedTransaction[];
}
