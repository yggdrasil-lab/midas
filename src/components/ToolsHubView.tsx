import React, { useState } from 'react';
import {
  ArrowRightLeft,
  FolderTree,
  Receipt as ReceiptIcon,
  Sliders,
  SlidersHorizontal,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { ActionTile, GlassCard, SectionHeader, SegmentedControl, StatusBadge } from '@yggdrasil-lab/ui';
import { CategoryManagerModal } from './CategoryManagerModal';
import { RulesManagerModal } from './RulesManagerModal';
import { ScenarioSimulator } from './ScenarioSimulator';
import { StatementDropzone } from './StatementDropzone';

type ToolsWorkspace = 'simulator' | 'statement';

interface ToolsHubViewProps {
  baselineBurn: number;
  pendingReceiptsCount?: number;
  needsReviewReceiptsCount?: number;
  onRefreshRunway: () => void;
  onOpenReceiptsClick: () => void;
  onOpenDataClick: () => void;
}

const ToolsActionGrid: React.FC<{
  pendingReceiptsCount: number;
  needsReviewReceiptsCount: number;
  onOpenReceiptsClick: () => void;
  onOpenRules: () => void;
  onOpenDataClick: () => void;
  onOpenCategories: () => void;
}> = ({
  pendingReceiptsCount,
  needsReviewReceiptsCount,
  onOpenReceiptsClick,
  onOpenRules,
  onOpenDataClick,
  onOpenCategories,
}) => {
  const receiptsSubtitle =
    pendingReceiptsCount > 0
      ? `${pendingReceiptsCount} ${pendingReceiptsCount === 1 ? 'receipt' : 'receipts'} awaiting ledger match`
      : 'Itemized bills & depletion tracking';

  const receiptsBadge =
    needsReviewReceiptsCount > 0 ? (
      <span data-testid="receipts-needs-review-badge">
        <StatusBadge variant="warning" size="xs" label={`${needsReviewReceiptsCount} Needs Review`} />
      </span>
    ) : pendingReceiptsCount > 0 ? (
      <span data-testid="receipts-pending-badge">
        <StatusBadge variant="idle" size="xs" showDot={false} label={`${pendingReceiptsCount} Pending`} />
      </span>
    ) : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <ActionTile
        data-testid="receipts-hub-btn"
        onClick={onOpenReceiptsClick}
        variant="brand"
        icon={<ReceiptIcon className="w-4 h-4" />}
        title="Receipts & Longevity"
        subtitle={receiptsSubtitle}
        badge={receiptsBadge}
      />
      <ActionTile
        data-testid="rules-manager-btn"
        onClick={onOpenRules}
        variant="blue"
        icon={<SlidersHorizontal className="w-4 h-4" />}
        title="Categorization Rules"
        subtitle="Auto-tag merchants & recurrence"
      />
      <ActionTile
        data-testid="data-controls-btn"
        onClick={onOpenDataClick}
        variant="emerald"
        icon={<ArrowRightLeft className="w-4 h-4" />}
        title="Transfer & FX Reconciliation"
        subtitle="Pair internal transfers & cross-currency legs"
      />
      <ActionTile
        data-testid="categories-manager-btn"
        onClick={onOpenCategories}
        variant="purple"
        icon={<FolderTree className="w-4 h-4" />}
        title="Categories & Hierarchy"
        subtitle="Manage classes & 52w spread"
      />
    </div>
  );
};

/**
 * Dedicated workspace hub consolidating episodic financial tools
 * (Time Machine Simulator, Statement Ingestion, Receipts Hub, Rules, and Data Controls).
 */
export const ToolsHubView: React.FC<ToolsHubViewProps> = ({
  baselineBurn,
  pendingReceiptsCount = 0,
  needsReviewReceiptsCount = 0,
  onRefreshRunway,
  onOpenReceiptsClick,
  onOpenDataClick,
}) => {
  const [workspace, setWorkspace] = useState<ToolsWorkspace>('simulator');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="tools-hub-view">
      <GlassCard className="space-y-4">
        <SectionHeader
          title="Tools & Power Utilities"
          subtitle="Scenario modeling, statement ingestion, receipts longevity, category hierarchy, rules, and data controls"
          icon={<Wrench className="w-4 h-4" />}
          variant="brand"
        />

        <ToolsActionGrid
          pendingReceiptsCount={pendingReceiptsCount}
          needsReviewReceiptsCount={needsReviewReceiptsCount}
          onOpenReceiptsClick={onOpenReceiptsClick}
          onOpenRules={() => setIsRulesModalOpen(true)}
          onOpenDataClick={onOpenDataClick}
          onOpenCategories={() => setIsCategoriesModalOpen(true)}
        />

        <SegmentedControl<ToolsWorkspace>
          idPrefix="tools-workspace"
          fullWidth
          variant="brand"
          size="sm"
          value={workspace}
          onChange={setWorkspace}
          options={[
            {
              id: 'simulator',
              label: 'Time Machine',
              icon: <Sliders className="w-3.5 h-3.5" />,
            },
            {
              id: 'statement',
              label: 'Statement Hub',
              icon: <UploadCloud className="w-3.5 h-3.5" />,
            },
          ]}
        />
      </GlassCard>

      {workspace === 'simulator' ? (
        <ScenarioSimulator baselineBurn={baselineBurn} />
      ) : (
        <StatementDropzone onSuccess={onRefreshRunway} />
      )}

      <RulesManagerModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        onRulesApplied={onRefreshRunway}
      />

      <CategoryManagerModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        onCategoriesChanged={onRefreshRunway}
      />
    </div>
  );
};
