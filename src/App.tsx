import React, { useEffect, useState } from 'react';
import {
  Clock,
  Database,
  Landmark,
  LayoutDashboard,
  PieChart,
  PlusCircle,
  Receipt as ReceiptIcon,
  Sliders,
  UploadCloud,
} from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  AlertBanner,
  AppHeader,
  AppShell,
  BottomNav,
  Button,
  LoadingState,
  PwaUpdateBanner,
  SessionExpiredBanner,
  clearBrowserCaches,
  isSessionExpiredError,
  usePwaUpdate,
} from '@yggdrasil-lab/ui';
import { AccountView } from './components/AccountView';
import { MidasTab } from './components/BottomNav';
import { CategorySpendingBreakdown } from './components/CategorySpendingBreakdown';
import { DataManagementModal } from './components/DataManagementModal';
import { QuickLogModal } from './components/QuickLogModal';
import { ReceiptsHubModal } from './components/ReceiptsHubModal';
import { RunwayClock } from './components/RunwayClock';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { StatementDropzone } from './components/StatementDropzone';
import { WeeklyBurnTracker } from './components/WeeklyBurnTracker';
import { fetchRunway } from './services/api';
import { RunwayData } from './types';

const DESKTOP_TABS = [
  { id: 'overview', label: 'Full Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'accounts', label: 'Accounts', icon: <Landmark className="w-3.5 h-3.5" /> },
  { id: 'budgets', label: 'Spending & Budgets', icon: <PieChart className="w-3.5 h-3.5" /> },
  { id: 'simulator', label: 'Time Machine', icon: <Sliders className="w-3.5 h-3.5" /> },
  { id: 'statement', label: 'Statement Hub', icon: <UploadCloud className="w-3.5 h-3.5" /> },
];

const MOBILE_NAV_TABS = [
  { id: 'overview', label: 'Freedom', icon: <Clock className="w-4 h-4" /> },
  { id: 'accounts', label: 'Accounts', icon: <Landmark className="w-4 h-4" /> },
  { id: 'budgets', label: 'Budgets', icon: <PieChart className="w-4 h-4" /> },
  { id: 'simulator', label: 'Simulator', icon: <Sliders className="w-4 h-4" /> },
  { id: 'statement', label: 'Statement', icon: <UploadCloud className="w-4 h-4" /> },
];

/**
 * Root Midas application shell orchestrating runway telemetry, unified responsive
 * tab views, PWA update prompts, and global action modals.
 */
export const App: React.FC = () => {
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MidasTab>('overview');
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isReceiptsModalOpen, setIsReceiptsModalOpen] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [swNeedRefresh, setSwNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setSwRegistration(registration);
      }
    },
    onRegisterError(err) {
      console.error('Service worker registration error:', err);
    },
  });

  const { needRefresh, applyUpdate, dismissUpdate } = usePwaUpdate({
    externalNeedRefresh: swNeedRefresh,
    onExternalNeedRefreshChange: setSwNeedRefresh,
    updateServiceWorker,
    registration: swRegistration,
  });

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

  const handleRefresh = async () => {
    setLoading(true);
    await clearBrowserCaches();
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  const renderTabContent = (runway: RunwayData) => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start max-w-lg lg:max-w-none mx-auto pb-24 lg:pb-0">
            <div className="lg:col-span-7 space-y-4 lg:space-y-6">
              <RunwayClock data={runway} />
              <WeeklyBurnTracker data={runway} onQuickLogClick={() => setIsQuickLogOpen(true)} />
              <CategorySpendingBreakdown
                onRefreshRunway={loadData}
                onOpenReceiptsClick={() => setIsReceiptsModalOpen(true)}
              />
              <div className="hidden lg:block">
                <StatementDropzone onSuccess={loadData} />
              </div>
            </div>
            <div className="hidden lg:block lg:col-span-5 space-y-6 lg:sticky lg:top-20">
              <ScenarioSimulator baselineBurn={runway.breakdown.weekly_burn_rate} />
            </div>
          </div>
        );
      case 'accounts':
        return (
          <div className="max-w-lg lg:max-w-7xl mx-auto pb-24 lg:pb-0">
            <AccountView onRefreshRunway={loadData} />
          </div>
        );
      case 'budgets':
        return (
          <div className="max-w-lg lg:max-w-2xl mx-auto space-y-4 lg:space-y-6 pb-24 lg:pb-0">
            <WeeklyBurnTracker data={runway} onQuickLogClick={() => setIsQuickLogOpen(true)} />
            <CategorySpendingBreakdown
              onRefreshRunway={loadData}
              onOpenReceiptsClick={() => setIsReceiptsModalOpen(true)}
            />
          </div>
        );
      case 'simulator':
        return (
          <div className="max-w-lg lg:max-w-2xl mx-auto pb-24 lg:pb-0">
            <ScenarioSimulator baselineBurn={runway.breakdown.weekly_burn_rate} />
          </div>
        );
      case 'statement':
        return (
          <div className="max-w-lg lg:max-w-2xl mx-auto pb-24 lg:pb-0">
            <StatementDropzone onSuccess={loadData} />
          </div>
        );
    }
  };

  return (
    <AppShell
      header={
        <AppHeader
          className="!bg-card !border-border/80 shadow-md"
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
          tabs={DESKTOP_TABS}
          activeTab={activeTab}
          onChangeTab={(tabId) => setActiveTab(tabId as MidasTab)}
          onRefresh={handleRefresh}
          isRefreshing={loading}
          actions={
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ReceiptIcon className="w-3.5 h-3.5 text-amber-400" />}
                onClick={() => setIsReceiptsModalOpen(true)}
                title="Receipts & Product Longevity"
                data-testid="header-receipts-btn"
              >
                <span className="hidden sm:inline">Receipts</span>
              </Button>
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
          tabs={MOBILE_NAV_TABS}
          activeTab={activeTab}
          onChangeTab={(tabId) => setActiveTab(tabId as MidasTab)}
          className="!bg-card/95 !border-border"
        />
      }
    >
      {sessionExpired && (
        <div className="mb-6">
          <SessionExpiredBanner />
        </div>
      )}

      {needRefresh && (
        <PwaUpdateBanner
          onReload={() => void applyUpdate()}
          onDismiss={dismissUpdate}
          className="mb-6"
        />
      )}

      {error && !sessionExpired && (
        <AlertBanner
          variant="error"
          title="Failed to load financial metrics"
          className="mb-6 p-4 shadow-lg"
          action={
            <Button variant="rose" size="sm" onClick={handleRefresh} className="shrink-0">
              Retry
            </Button>
          }
        >
          {error}
        </AlertBanner>
      )}

      {loading && !data && (
        <LoadingState label="Loading runway metrics..." variant="amber" className="py-24" />
      )}

      {data && (
        <>
          {data.breakdown.total_liquid_balance === 0 && (
            <AlertBanner
              variant="warning"
              title="Clean Ledger Ready"
              className="mb-6 p-4 rounded-2xl shadow"
              action={
                <Button
                  variant="amber"
                  size="sm"
                  onClick={() => setIsDataModalOpen(true)}
                  className="shrink-0"
                >
                  Data Controls
                </Button>
              }
            >
              Your ledger has zero balances. Ingest bank statements below or seed test data to explore.
            </AlertBanner>
          )}
          {renderTabContent(data)}
        </>
      )}

      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onSuccess={loadData}
        categories={data?.categories}
      />

      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onSuccess={loadData}
      />

      <ReceiptsHubModal
        isOpen={isReceiptsModalOpen}
        onClose={() => setIsReceiptsModalOpen(false)}
        onReceiptLinked={loadData}
      />
    </AppShell>
  );
};
