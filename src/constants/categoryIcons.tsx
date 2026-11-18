import React from 'react';
import {
  ArrowRightLeft,
  Car,
  Gamepad2,
  HeartPulse,
  Home,
  Package,
  Plane,
  ShieldCheck,
  ShoppingCart,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';

const CATEGORY_ICON_RULES: Array<{
  keywords: string[];
  render: () => React.ReactNode;
}> = [
  {
    keywords: ['transfer', 'wise'],
    render: () => <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />,
  },
  {
    keywords: ['grocer', 'supermarket'],
    render: () => <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />,
  },
  {
    keywords: ['transport', 'fuel', 'transit'],
    render: () => <Car className="w-3.5 h-3.5 text-sky-400" />,
  },
  {
    keywords: ['food', 'cafe', 'restaurant', 'dining'],
    render: () => <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    keywords: ['util', 'power', 'internet', 'phone'],
    render: () => <Zap className="w-3.5 h-3.5 text-yellow-400" />,
  },
  {
    keywords: ['health', 'medical', 'gym', 'fitness'],
    render: () => <HeartPulse className="w-3.5 h-3.5 text-rose-400" />,
  },
  {
    keywords: ['leisure', 'entertainment', 'movie', 'game'],
    render: () => <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />,
  },
  {
    keywords: ['insurance'],
    render: () => <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />,
  },
  {
    keywords: ['travel', 'flight', 'air'],
    render: () => <Plane className="w-3.5 h-3.5 text-cyan-400" />,
  },
  {
    keywords: ['housing', 'rent', 'mortgage'],
    render: () => <Home className="w-3.5 h-3.5 text-teal-400" />,
  },
];

/**
 * Resolve a themed Lucide icon for a spending category name.
 */
export function getCategoryIcon(category: string): React.ReactNode {
  const lower = (category || '').toLowerCase();
  const matched = CATEGORY_ICON_RULES.find((rule) =>
    rule.keywords.some((kw) => lower.includes(kw))
  );
  return matched ? matched.render() : <Package className="w-3.5 h-3.5 text-slate-400" />;
}
