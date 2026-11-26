import { Account } from '../types';

export const TIER_ORDER = ['cash', 'growth', 'locked'] as const;

export type AccountTier = (typeof TIER_ORDER)[number];

export interface AccountTierMeta {
  shortLabel: string;
  sectionTitle: string;
  sectionDescription: string;
  cardVariant: 'blue' | 'emerald' | 'amber';
  badgeVariant: 'info' | 'success' | 'warning';
  statCardVariant: 'sky' | 'emerald' | 'amber';
  totalTextColor: string;
  iconBgClass: string;
}

/** Canonical metadata describing the three financial freedom tiers. */
export const ACCOUNT_TIER_META: Record<Account['tier'], AccountTierMeta> = {
  cash: {
    shortLabel: 'Cash Floor',
    sectionTitle: 'Tier 1: Cash Floor (Liquid Reserves)',
    sectionDescription: 'Checking accounts and emergency cash covering immediate living expenses',
    cardVariant: 'blue',
    badgeVariant: 'info',
    statCardVariant: 'sky',
    totalTextColor: 'text-sky-300',
    iconBgClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  growth: {
    shortLabel: 'Growth',
    sectionTitle: 'Tier 2: Growth Assets (Compounding Investments)',
    sectionDescription: 'Brokerage, index funds, stocks, and crypto generating compounding returns',
    cardVariant: 'emerald',
    badgeVariant: 'success',
    statCardVariant: 'emerald',
    totalTextColor: 'text-emerald-300',
    iconBgClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  locked: {
    shortLabel: 'Locked',
    sectionTitle: 'Tier 3: Locked Reserve (Preserved Capital)',
    sectionDescription: 'KiwiSaver, private notes, and restricted capital preserved until maturity',
    cardVariant: 'amber',
    badgeVariant: 'warning',
    statCardVariant: 'amber',
    totalTextColor: 'text-amber-300',
    iconBgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
};
