import React, { useEffect, useState } from 'react';
import { Sliders, UploadCloud, PlusCircle, LayoutDashboard, Clock } from 'lucide-react';
import { AppShell, AppHeader, BottomNav } from '@yggdrasil-lab/ui';
import { RunwayData } from './types';
import { fetchRunway } from './services/api';
import { RunwayClock } from './components/RunwayClock';
import { WeeklyBurnTracker } from './components/WeeklyBurnTracker';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { StatementDropzone } from './components/StatementDropzone';
import { QuickLogModal } from './components/QuickLogModal';
import { MidasTab } from './components/BottomNav';

export const App: React.FC = () => {
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MidasTab>('overview');
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

  const desktopTabs = [
    { id: 'overview', label: 'Full Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'simulator', label: 'Time Machine', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'statement', label: 'Statement Hub', icon: <UploadCloud className="w-3.5 h-3.5" /> },
  ];

  const mobileNavTabs = [
    { id: 'overview', label: 'Freedom', icon: <Clock className="w-4 h-4" /> },
    { id: 'simulator', label: 'Simulator', icon: <Sliders className="w-4 h-4" /> },
    { id: 'statement', label: 'Statement', icon: <UploadCloud className="w-4 h-4" /> },
  ];

  return (
    <AppShell
      header={
        <AppHeader
          variant="amber"
          brandIcon={
            <img
              src="/favicon.svg"
              alt="Midas"
              className="w-full h-full object-contain rounded-xl"
            />
          }
          brandColor="overflow-hidden p-0 border border-amber-500/30"
          title="MIDAS"
          subtitle="Freedom Clock"
          tabs={desktopTabs}
          activeTab={activeTab}
          onChangeTab={(tabId) => setActiveTab(tabId as MidasTab)}
          onRefresh={loadData}
          isRefreshing={loading}
          actions={
            <button
              onClick={() => setIsQuickLogOpen(true)}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-semibold shadow transition-all duration-150"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>
          }
        />
      }
      bottomNav={
        <BottomNav
          variant="amber"
          hideOnDesktop
          tabs={mobileNavTabs}
          activeTab={activeTab}
          onChangeTab={(tabId) => setActiveTab(tabId as MidasTab)}
        />
      }
    >
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

      {/* Quick Log Modal */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onSuccess={loadData}
      />
    </AppShell>
  );
};
