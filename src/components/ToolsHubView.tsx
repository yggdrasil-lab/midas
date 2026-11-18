import React, { useState } from 'react';
import {
  Database,
  Receipt as ReceiptIcon,
  Sliders,
  SlidersHorizontal,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { GlassCard, SectionHeader, SegmentedControl } from '@yggdrasil-lab/ui';
import { RulesManagerModal } from './RulesManagerModal';
import { ScenarioSimulator } from './ScenarioSimulator';
import { StatementDropzone } from './StatementDropzone';

type ToolsWorkspace = 'simulator' | 'statement';

interface ToolsHubViewProps {
  baselineBurn: number;
  onRefreshRunway: () => void;
  onOpenReceiptsClick: () => void;
  onOpenDataClick: () => void;
}

/**
 * Dedicated workspace hub consolidating episodic financial tools
 * (Time Machine Simulator, Statement Ingestion, Receipts Hub, Rules, and Data Controls).
 */
export const ToolsHubView: React.FC<ToolsHubViewProps> = ({
  baselineBurn,
  onRefreshRunway,
  onOpenReceiptsClick,
  onOpenDataClick,
}) => {
  const [workspace, setWorkspace] = useState<ToolsWorkspace>('simulator');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="tools-hub-view">
      <GlassCard className="space-y-4">
        <SectionHeader
          title="Tools & Power Utilities"
          subtitle="Scenario modeling, statement ingestion, receipts longevity, categorization rules, and data controls"
          icon={<Wrench className="w-4 h-4" />}
          variant="amber"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            data-testid="receipts-hub-btn"
            onClick={onOpenReceiptsClick}
            className="p-3 rounded-xl bg-background/60 border border-border/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors text-left flex items-start gap-3 cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <ReceiptIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100">Receipts &amp; Longevity</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Itemized bills &amp; depletion tracking
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="rules-manager-btn"
            onClick={() => setIsRulesModalOpen(true)}
            className="p-3 rounded-xl bg-background/60 border border-border/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors text-left flex items-start gap-3 cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100">Categorization Rules</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Auto-tag merchants &amp; recurrence
              </div>
            </div>
          </button>

          <button
            type="button"
            data-testid="data-controls-btn"
            onClick={onOpenDataClick}
            className="p-3 rounded-xl bg-background/60 border border-border/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors text-left flex items-start gap-3 cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100">Data &amp; Ledger Controls</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Reconcile, export, or reset ledger
              </div>
            </div>
          </button>
        </div>

        <SegmentedControl<ToolsWorkspace>
          idPrefix="tools-workspace"
          fullWidth
          variant="amber"
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
    </div>
  );
};
