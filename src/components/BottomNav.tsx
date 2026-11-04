import React from 'react';
import { Clock, Sliders, UploadCloud } from 'lucide-react';

export type MidasTab = 'overview' | 'simulator' | 'statement';

interface BottomNavProps {
  activeTab: MidasTab;
  onChangeTab: (tab: MidasTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  return (
    <nav
      className="block lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border shadow-2xl pb-safe transform-gpu will-change-transform"
      style={{
        WebkitTransform: 'translate3d(0, 0, 0)',
        transform: 'translate3d(0, 0, 0)',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
      aria-label="Main Mobile Navigation"
    >
      <div className="max-w-lg mx-auto grid grid-cols-3 gap-1 p-2">
        <button
          onClick={() => onChangeTab('overview')}
          className={`py-2 px-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${
            activeTab === 'overview'
              ? 'text-amber-400 bg-amber-500/10 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Freedom Clock Overview"
        >
          <Clock className="w-4 h-4" />
          <span className="text-[10px]">Freedom</span>
        </button>

        <button
          onClick={() => onChangeTab('simulator')}
          className={`py-2 px-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${
            activeTab === 'simulator'
              ? 'text-amber-400 bg-amber-500/10 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Time Machine Simulator"
        >
          <Sliders className="w-4 h-4" />
          <span className="text-[10px]">Simulator</span>
        </button>

        <button
          onClick={() => onChangeTab('statement')}
          className={`py-2 px-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${
            activeTab === 'statement'
              ? 'text-amber-400 bg-amber-500/10 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Statement Ingestion Hub"
        >
          <UploadCloud className="w-4 h-4" />
          <span className="text-[10px]">Statement</span>
        </button>
      </div>
    </nav>
  );
};
