import React, { useEffect, useState } from 'react';
import { Clock, Sliders, UploadCloud, RefreshCw } from 'lucide-react';
import { RunwayData } from './types';
import { fetchRunway } from './services/api';
import { RunwayClock } from './components/RunwayClock';
import { WeeklyBurnTracker } from './components/WeeklyBurnTracker';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { StatementDropzone } from './components/StatementDropzone';
import { QuickLogModal } from './components/QuickLogModal';

export const App: React.FC = () => {
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'simulator' | 'statement'>('overview');
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchRunway();
      setData(res);
    } catch (err) {
      console.error(err);
      // Fallback mock baseline for offline preview / fresh setup
      setData({
        as_of_date: new Date().toISOString().split('T')[0],
        primary_runway_weeks: 184,
        primary_runway_years: 3.5,
        is_perpetual: false,
        time_banked_this_week: 0.25,
        weekly_spend_this_week: 750,
        weekly_budget_target: 1000,
        breakdown: {
          cash_balance: 24000,
          growth_balance: 160000,
          locked_balance: 85000,
          total_liquid_balance: 184000,
          emergency_weeks: 24,
          growth_weeks: 184,
          is_perpetual: false,
          perpetual_threshold_weekly_income: 173,
          weekly_burn_rate: 1000,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col justify-between max-w-lg mx-auto border-x border-border/40 shadow-2xl">
      {/* Top App Bar */}
      <header className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center font-black text-slate-950 text-sm shadow">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-100">MIDAS</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Freedom Clock</p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-background/80 hover:bg-background border border-border text-slate-400 hover:text-slate-200 active:scale-95 transition-all"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </header>

      {/* Main Content Body */}
      <main className="p-4 space-y-4 flex-1">
        {data && (
          <>
            {activeTab === 'overview' && (
              <>
                <RunwayClock data={data} />
                <WeeklyBurnTracker data={data} onQuickLogClick={() => setIsQuickLogOpen(true)} />
              </>
            )}

            {activeTab === 'simulator' && (
              <ScenarioSimulator baselineBurn={data.breakdown.weekly_burn_rate} />
            )}

            {activeTab === 'statement' && (
              <StatementDropzone onSuccess={loadData} />
            )}
          </>
        )}
      </main>

      {/* Bottom Mobile Tab Bar */}
      <nav className="p-2 border-t border-border bg-card/80 backdrop-blur sticky bottom-0 z-40 pb-safe">
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${
              activeTab === 'overview'
                ? 'text-amber-400 bg-amber-500/10 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="text-[10px]">Freedom</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${
              activeTab === 'simulator'
                ? 'text-amber-400 bg-amber-500/10 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[10px]">Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('statement')}
            className={`py-2 px-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${
              activeTab === 'statement'
                ? 'text-amber-400 bg-amber-500/10 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span className="text-[10px]">Statement</span>
          </button>
        </div>
      </nav>

      {/* Quick Log Modal */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
