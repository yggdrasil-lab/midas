import React from 'react';
import {
  ArrowRightLeft,
  Bus,
  Car,
  Cloud,
  Cpu,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  HeartPulse,
  Home,
  Lamp,
  Landmark,
  Package,
  Pill,
  Plane,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Users,
  UtensilsCrossed,
  Wallet,
  Wine,
  Wrench,
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
    keywords: ['income', 'salary'],
    render: () => <Wallet className="w-3.5 h-3.5 text-emerald-400" />,
  },
  {
    keywords: ['alcohol', 'wine', 'beer', 'liquor'],
    render: () => <Wine className="w-3.5 h-3.5 text-rose-400" />,
  },
  {
    keywords: ['grocer', 'supermarket'],
    render: () => <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />,
  },
  {
    keywords: ['personal care', 'skincare', 'beauty', 'hair', 'groom'],
    render: () => <Sparkles className="w-3.5 h-3.5 text-pink-400" />,
  },
  {
    keywords: ['fuel', 'petrol'],
    render: () => <Fuel className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    keywords: ['transit', 'bus', 'train', 'ferry', 'uber'],
    render: () => <Bus className="w-3.5 h-3.5 text-sky-400" />,
  },
  {
    keywords: ['vehicle', 'mechanic', 'car', 'auto'],
    render: () => <Wrench className="w-3.5 h-3.5 text-sky-400" />,
  },
  {
    keywords: ['transport'],
    render: () => <Car className="w-3.5 h-3.5 text-sky-400" />,
  },
  {
    keywords: ['dining', 'food', 'cafe', 'restaurant', 'coffee'],
    render: () => <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    keywords: ['software', 'ai', 'cloud', 'saas'],
    render: () => <Cloud className="w-3.5 h-3.5 text-cyan-400" />,
  },
  {
    keywords: ['bills', 'telco', 'util', 'power', 'internet', 'phone'],
    render: () => <Zap className="w-3.5 h-3.5 text-yellow-400" />,
  },
  {
    keywords: ['supplement'],
    render: () => <Pill className="w-3.5 h-3.5 text-emerald-400" />,
  },
  {
    keywords: ['fitness', 'gym', 'workout'],
    render: () => <Dumbbell className="w-3.5 h-3.5 text-rose-400" />,
  },
  {
    keywords: ['medical', 'doctor', 'dental', 'pharmacy'],
    render: () => <Stethoscope className="w-3.5 h-3.5 text-rose-400" />,
  },
  {
    keywords: ['health'],
    render: () => <HeartPulse className="w-3.5 h-3.5 text-rose-400" />,
  },
  {
    keywords: ['clothing', 'apparel', 'fashion'],
    render: () => <Shirt className="w-3.5 h-3.5 text-indigo-400" />,
  },
  {
    keywords: ['tech', 'electronic'],
    render: () => <Cpu className="w-3.5 h-3.5 text-cyan-400" />,
  },
  {
    keywords: ['household', 'appliance'],
    render: () => <Lamp className="w-3.5 h-3.5 text-teal-400" />,
  },
  {
    keywords: ['housing', 'rent', 'mortgage'],
    render: () => <Home className="w-3.5 h-3.5 text-teal-400" />,
  },
  {
    keywords: ['shopping', 'retail'],
    render: () => <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    keywords: ['family', 'gift'],
    render: () => <Users className="w-3.5 h-3.5 text-violet-400" />,
  },
  {
    keywords: ['gaming', 'leisure', 'entertainment', 'movie', 'game'],
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
    keywords: ['debt', 'loan'],
    render: () => <CreditCard className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    keywords: ['fees', 'admin', 'finance'],
    render: () => <Landmark className="w-3.5 h-3.5 text-slate-300" />,
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
