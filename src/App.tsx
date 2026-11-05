import React, { useEffect, useState } from 'react';
import { Sliders, UploadCloud, PlusCircle, LayoutDashboard, Clock, Database } from 'lucide-react';
import { AppShell, AppHeader, BottomNav, SessionExpiredBanner, isSessionExpiredError, Button } from '@yggdrasil-lab/ui';
import { RunwayData } from './types';
import { fetchRunway } from './services/api';
import { RunwayClock } from './components/RunwayClock';
import { WeeklyBurnTracker } from './components/WeeklyBurnTracker';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { StatementDropzone } from './components/StatementDropzone';
import { QuickLogModal } from './components/QuickLogModal';
import { DataManagementModal } from './components/DataManagementModal';
import { MidasTab } from './components/BottomNav';

export const App: React.FC = () => {
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MidasTab>('overview');
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRunway();
      setData(res);
      setSessionExpired(false);
    } catch (err) {
      console.error(err);
      if (isSessionExpiredError(err)) {
        setSessionExpired(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load runway metrics');
      }
      setData(null);
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
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Database className="w-3.5 h-3.5 text-amber-400" />}
                onClick={() => setIsDataModalOpen(true)}
                title="Data & Ledger Controls"
              >
                <span className="hidden sm:inline">Data</span>
              </Button>
              <Button
                variant="amber"
                size="sm"
                icon={<PlusCircle className="w-3.5 h-3.5" />}
                onClick={() => setIsQuickLogOpen(true)}
                className="hidden sm:inline-flex"
              >
                Log Expense
              </Button>
            </div>
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
      {sessionExpired && (
        <div className="mb-6">
          <SessionExpiredBanner />
        </div>
      )}

      {error && !sessionExpired && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl border border-rose-500/50 bg-rose-950/30 text-rose-200 shadow-lg flex items-center justify-between"
        >
          <div className="space-y-1">
            <h3 className="font-semibold text-rose-300">Failed to load financial metrics</h3>
            <p className="text-xs text-rose-400/90">{error}</p>
          </div>
          <Button
            variant="rose"
            size="sm"
            onClick={loadData}
            className="shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      )}

      {data && (
        <>
          {data.breakdown.total_liquid_balance === 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow">
              <div className="space-y-0.5">
                <div className="font-semibold text-amber-300">Clean Ledger Ready</div>
                <p className="text-amber-400/80">Your ledger has zero balances. Ingest bank statements below or seed test data to explore.</p>
              </div>
              <Button
                variant="amber"
                size="sm"
                onClick={() => setIsDataModalOpen(true)}
                className="shrink-0"
              >
                Data Controls
              </Button>
            </div>
          )}

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
        categories={data?.categories}
      />

      {/* Data Management Modal */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onSuccess={loadData}
      />
    </AppShell>
  );
};
