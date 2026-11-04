import React, { useEffect, useState } from 'react';
import { Clock, Sliders, UploadCloud, RefreshCw, PlusCircle, LayoutDashboard } from 'lucide-react';
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
    <div className="min-h-screen bg-background text-slate-100 flex flex-col justify-between w-full selection:bg-amber-500 selection:text-black">
      {/* Top App Bar (Responsive for Mobile and Desktop) */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-base shadow-md">
              M
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-tight text-slate-100">MIDAS</h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Freedom Clock
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase sm:hidden">
                Freedom Clock
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <nav className="hidden lg:flex items-center space-x-1 bg-background/80 p-1 rounded-xl border border-border/80">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'overview'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Full Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'simulator'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Time Machine</span>
            </button>

            <button
              onClick={() => setActiveTab('statement')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'statement'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Statement Hub</span>
            </button>
          </nav>

          {/* Right Action Icons: Quick Log + Subtle Refresh Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsQuickLogOpen(true)}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-semibold shadow transition-all duration-150"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>

            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-background/80 hover:bg-background border border-border text-slate-400 hover:text-slate-200 active:scale-95 transition-all"
              title="Refresh metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-8 flex-1">
        {data && (
          <>
            {/* Desktop Full Dashboard (lg: screens) */}
            <div className="hidden lg:block">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-12 gap-6 items-start">
                  {/* Left Column: Clock + Burn + Ingestion */}
                  <div className="col-span-7 space-y-6">
                    <RunwayClock data={data} />
                    <WeeklyBurnTracker data={data} onQuickLogClick={() => setIsQuickLogOpen(true)} />
                    <StatementDropzone onSuccess={loadData} />
                  </div>

                  {/* Right Column: Time Machine Simulator */}
                  <div className="col-span-5 space-y-6 sticky top-20">
                    <ScenarioSimulator baselineBurn={data.breakdown.weekly_burn_rate} />
                  </div>
                </div>
              )}

              {activeTab === 'simulator' && (
                <div className="max-w-2xl mx-auto">
                  <ScenarioSimulator baselineBurn={data.breakdown.weekly_burn_rate} />
                </div>
              )}

              {activeTab === 'statement' && (
                <div className="max-w-2xl mx-auto">
                  <StatementDropzone onSuccess={loadData} />
                </div>
              )}
            </div>

            {/* Mobile / Tablet View (< lg: screens) */}
            <div className="block lg:hidden space-y-4 max-w-lg mx-auto">
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
            </div>
          </>
        )}
      </main>

      {/* Bottom Mobile Tab Bar (Visible only on mobile/tablet screens < lg) */}
      <nav className="block lg:hidden p-2 border-t border-border bg-card/80 backdrop-blur sticky bottom-0 z-40 pb-safe">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-1">
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
