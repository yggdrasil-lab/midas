import React, { useEffect, useState } from 'react';
import {
  Clock,
  Landmark,
  LayoutDashboard,
  PieChart,
  PlusCircle,
  Wrench,
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
import { TagSpendingBreakdown } from './components/TagSpendingBreakdown';
import { ToolsHubView } from './components/ToolsHubView';
import { WeeklyBurnTracker } from './components/WeeklyBurnTracker';
import { fetchReceipts, fetchRunway } from './transport';
import { useCategories } from './hooks/useCategories';
import { Receipt, RunwayData } from './types';
import { isReceiptPending } from './utils/receipts';

const DESKTOP_TABS = [
  { id: 'overview', label: 'Full Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'accounts', label: 'Accounts', icon: <Landmark className="w-3.5 h-3.5" /> },
  { id: 'budgets', label: 'Spending & Budgets', icon: <PieChart className="w-3.5 h-3.5" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="w-3.5 h-3.5" /> },
];

const MOBILE_NAV_TABS = [
  { id: 'overview', label: 'Freedom', icon: <Clock className="w-4 h-4" /> },
  { id: 'accounts', label: 'Accounts', icon: <Landmark className="w-4 h-4" /> },
  { id: 'budgets', label: 'Budgets', icon: <PieChart className="w-4 h-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
];

function useMidasAppState() {
  const { refreshCategories } = useCategories();
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MidasTab>('overview');
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isReceiptsModalOpen, setIsReceiptsModalOpen] = useState(false);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);
  const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0);
  const [needsReviewReceiptsCount, setNeedsReviewReceiptsCount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, receiptRows] = await Promise.all([
        fetchRunway(),
        fetchReceipts().catch((receiptErr) => {
          console.warn('Failed to fetch receipt attention counts:', receiptErr);
          return [] as Receipt[];
        }),
      ]);
      setData(res);
      setNeedsReviewReceiptsCount(receiptRows.filter((r) => r.status === 'needs_review').length);
      setPendingReceiptsCount(receiptRows.filter((r) => isReceiptPending(r)).length);
      setSessionExpired(false);
      setBudgetRefreshKey((prev) => prev + 1);
      void refreshCategories();
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
    void loadData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await clearBrowserCaches();
    await loadData();
  };

  return {
    data, loading, sessionExpired, error, activeTab, setActiveTab,
    isQuickLogOpen, setIsQuickLogOpen, isDataModalOpen, setIsDataModalOpen,
    isReceiptsModalOpen, setIsReceiptsModalOpen, budgetRefreshKey,
    pendingReceiptsCount, needsReviewReceiptsCount, loadData, handleRefresh,
  };
}

const MidasTabContent: React.FC<{
  activeTab: MidasTab;
  runway: RunwayData;
  budgetRefreshKey: number;
  pendingReceiptsCount: number;
  needsReviewReceiptsCount: number;
  onRefresh: () => void;
  onSelectTab: (tab: MidasTab) => void;
  onOpenQuickLog: () => void;
  onOpenReceipts: () => void;
  onOpenData: () => void;
}> = ({
  activeTab, runway, budgetRefreshKey, pendingReceiptsCount, needsReviewReceiptsCount,
  onRefresh, onSelectTab, onOpenQuickLog, onOpenReceipts, onOpenData,
}) => {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start max-w-lg lg:max-w-7xl mx-auto pb-24 lg:pb-0">
          <div className="lg:col-span-5 space-y-4 lg:space-y-6">
            <RunwayClock data={runway} />
            <WeeklyBurnTracker data={runway} onQuickLogClick={onOpenQuickLog} onBudgetChanged={onRefresh} />
          </div>
          <div className="lg:col-span-7 space-y-4 lg:space-y-6">
            <div className="hidden lg:block">
              <CategorySpendingBreakdown onRefreshRunway={onRefresh} />
            </div>
            <div className="lg:hidden">
              <CategorySpendingBreakdown compact onRefreshRunway={onRefresh} onViewAllBudgetsClick={() => onSelectTab('budgets')} />
            </div>
          </div>
        </div>
      );
    case 'accounts':
      return (
        <div className="max-w-lg lg:max-w-7xl mx-auto pb-24 lg:pb-0">
          <AccountView onRefreshRunway={onRefresh} />
        </div>
      );
    case 'budgets':
      return (
        <div className="max-w-lg lg:max-w-3xl mx-auto space-y-4 lg:space-y-6 pb-24 lg:pb-0">
          <WeeklyBurnTracker data={runway} onQuickLogClick={onOpenQuickLog} onBudgetChanged={onRefresh} />
          <CategorySpendingBreakdown onRefreshRunway={onRefresh} />
          <TagSpendingBreakdown onRefreshRunway={onRefresh} refreshKey={budgetRefreshKey} />
        </div>
      );
    case 'tools':
      return (
        <div className="max-w-lg lg:max-w-3xl mx-auto pb-24 lg:pb-0">
          <ToolsHubView
            baselineBurn={runway.breakdown.weekly_burn_rate}
            pendingReceiptsCount={pendingReceiptsCount}
            needsReviewReceiptsCount={needsReviewReceiptsCount}
            onRefreshRunway={onRefresh}
            onOpenReceiptsClick={onOpenReceipts}
            onOpenDataClick={onOpenData}
          />
        </div>
      );
  }
};

const MidasStatusBanners: React.FC<{
  sessionExpired: boolean;
  needRefresh: boolean;
  error: string | null;
  loading: boolean;
  hasData: boolean;
  onApplyUpdate: () => void;
  onDismissUpdate: () => void;
  onRefresh: () => void;
}> = ({ sessionExpired, needRefresh, error, loading, hasData, onApplyUpdate, onDismissUpdate, onRefresh }) => (
  <>
    {sessionExpired && <div className="mb-6"><SessionExpiredBanner /></div>}
    {needRefresh && <PwaUpdateBanner onReload={onApplyUpdate} onDismiss={onDismissUpdate} className="mb-6" />}
    {Boolean(error) && !sessionExpired && (
      <AlertBanner
        variant="error"
        title="Failed to load financial metrics"
        className="mb-6 p-4 shadow-lg"
        action={<Button variant="rose" size="sm" onClick={onRefresh} className="shrink-0">Retry</Button>}
      >
        {error}
      </AlertBanner>
    )}
    {loading && !hasData && <LoadingState label="Loading runway metrics..." variant="brand" className="py-24" />}
  </>
);

function useMidasSwUpdate() {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { needRefresh: [swNeedRefresh, setSwNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) { if (registration) setSwRegistration(registration); },
    onRegisterError(err) { console.error('Service worker registration error:', err); },
  });
  return usePwaUpdate({
    externalNeedRefresh: swNeedRefresh,
    onExternalNeedRefreshChange: setSwNeedRefresh,
    updateServiceWorker,
    registration: swRegistration,
  });
}

/**
 * Root Midas application shell orchestrating runway telemetry, unified responsive
 * tab views, PWA update prompts, and global action modals.
 */
export const App: React.FC = () => {
  const s = useMidasAppState();
  const { needRefresh, applyUpdate, dismissUpdate } = useMidasSwUpdate();

  return (
    <AppShell
      header={
        <AppHeader
          className="!bg-card !border-border/80 shadow-md"
          variant="brand"
          brandIcon={<img src="/favicon.svg" alt="Midas" className="w-full h-full object-contain rounded-xl" />}
          brandColor="overflow-hidden p-0 border border-accent/30"
          title="MIDAS"
          subtitle="Freedom Clock"
          tabs={DESKTOP_TABS}
          activeTab={s.activeTab}
          onChangeTab={(tabId) => s.setActiveTab(tabId as MidasTab)}
          onRefresh={() => void s.handleRefresh()}
          isRefreshing={s.loading}
          actions={
            <Button variant="brand" size="sm" icon={<PlusCircle className="w-3.5 h-3.5" />} onClick={() => s.setIsQuickLogOpen(true)} className="hidden sm:inline-flex">
              Log Expense
            </Button>
          }
        />
      }
      bottomNav={
        <BottomNav variant="brand" hideOnDesktop tabs={MOBILE_NAV_TABS} activeTab={s.activeTab} onChangeTab={(tabId) => s.setActiveTab(tabId as MidasTab)} className="!bg-card/95 !border-border" />
      }
    >
      <MidasStatusBanners
        sessionExpired={s.sessionExpired}
        needRefresh={needRefresh}
        error={s.error}
        loading={s.loading}
        hasData={Boolean(s.data)}
        onApplyUpdate={() => void applyUpdate()}
        onDismissUpdate={dismissUpdate}
        onRefresh={() => void s.handleRefresh()}
      />
      {s.data && (
        <>
          {s.data.breakdown.total_liquid_balance === 0 && (
            <AlertBanner
              variant="warning"
              title="Clean Ledger Ready"
              className="mb-6 p-4 rounded-2xl shadow"
              action={<Button variant="brand" size="sm" onClick={() => s.setActiveTab('tools')} className="shrink-0">Open Statement Hub</Button>}
            >
              Your ledger has zero balances. Upload a bank statement in the Tools tab to get started.
            </AlertBanner>
          )}
          <MidasTabContent
            activeTab={s.activeTab}
            runway={s.data}
            budgetRefreshKey={s.budgetRefreshKey}
            pendingReceiptsCount={s.pendingReceiptsCount}
            needsReviewReceiptsCount={s.needsReviewReceiptsCount}
            onRefresh={() => void s.loadData()}
            onSelectTab={s.setActiveTab}
            onOpenQuickLog={() => s.setIsQuickLogOpen(true)}
            onOpenReceipts={() => s.setIsReceiptsModalOpen(true)}
            onOpenData={() => s.setIsDataModalOpen(true)}
          />
        </>
      )}
      <QuickLogModal isOpen={s.isQuickLogOpen} onClose={() => s.setIsQuickLogOpen(false)} onSuccess={() => void s.loadData()} categories={s.data?.categories} />
      <DataManagementModal isOpen={s.isDataModalOpen} onClose={() => s.setIsDataModalOpen(false)} onSuccess={() => void s.loadData()} />
      <ReceiptsHubModal isOpen={s.isReceiptsModalOpen} onClose={() => s.setIsReceiptsModalOpen(false)} onReceiptLinked={() => void s.loadData()} />
    </AppShell>
  );
};
