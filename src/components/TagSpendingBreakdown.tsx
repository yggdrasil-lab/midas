import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Tag } from 'lucide-react';
import {
  AlertBanner,
  EmptyState,
  GlassCard,
  LoadingState,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  SegmentedControlOption,
  SummaryMetricGrid,
} from '@yggdrasil-lab/ui';
import { formatPeriodLabel } from '../constants/categories';
import { fetchTagSpendingSummary } from '../transport';
import {
  PeriodType,
  TagSpendingSummaryItem,
  TagSpendingSummaryResponse,
} from '../types';
import { formatMoney } from '../utils/format';
import { TagTransactionInspectionModal } from './TagTransactionInspectionModal';

interface TagSpendingBreakdownProps {
  onRefreshRunway?: () => void;
  refreshKey?: number;
}

const TAG_PERIOD_OPTIONS: SegmentedControlOption<PeriodType>[] = [
  { id: 'all', label: 'All Time' },
  { id: 'annual', label: '52w' },
  { id: 'month', label: 'Month' },
  { id: 'last_month', label: 'Last Mo' },
];

function useTagSpendingState(refreshKey: number) {
  const [period, setPeriod] = useState<PeriodType>('all');
  const [data, setData] = useState<TagSpendingSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTagSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTagSpendingSummary(period));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load tag spending summary');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadTagSummary();
  }, [loadTagSummary, refreshKey]);

  const filteredTags = useMemo(() => {
    if (!data?.tags) return [];
    const q = searchQuery.trim().toLowerCase().replace(/^#+/, '');
    if (!q) return data.tags;
    return data.tags.filter(
      (item) =>
        item.tag.toLowerCase().includes(q) ||
        item.categories.some((c) => c.category.toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  return { period, setPeriod, data, loading, error, searchQuery, setSearchQuery, loadTagSummary, filteredTags };
}

const TagMetricSummary: React.FC<{ data: TagSpendingSummaryResponse; period: PeriodType }> = ({ data, period }) => (
  <SummaryMetricGrid
    columns={3}
    items={[
      {
        id: 'total-tagged-spend',
        label: 'Tagged Spend',
        value: (
          <span className="text-xs sm:text-sm tracking-tight">
            {formatMoney(data.total_tagged_spend, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ),
        subvalue: 'NZD',
        valueClassName: 'text-slate-100 font-mono',
      },
      {
        id: 'active-tag-count',
        label: 'Tags',
        value: data.tags.length,
        valueClassName: 'text-amber-300 font-mono text-xs sm:text-sm',
      },
      {
        id: 'tag-period-label',
        label: 'Window',
        value: formatPeriodLabel(period),
        valueClassName: 'text-slate-200 text-xs font-medium',
      },
    ]}
  />
);

const TagSummaryRow: React.FC<{ item: TagSpendingSummaryItem; onSelect: (item: TagSpendingSummaryItem) => void }> = ({
  item,
  onSelect,
}) => {
  const visibleCats = item.categories.slice(0, 4);
  const remainingCount = item.categories.length - visibleCats.length;
  const dateRangeLabel = item.first_date === item.last_date ? item.last_date : `${item.first_date} to ${item.last_date}`;

  return (
    <button
      type="button"
      data-testid={`tag-row-${item.tag}`}
      onClick={() => onSelect(item)}
      className="w-full text-left p-3 rounded-xl bg-card/60 hover:bg-card/90 border border-border hover:border-amber-500/40 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Tag className="w-3 h-3" />
              <span>#{item.tag}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {item.transaction_count} {item.transaction_count === 1 ? 'expense' : 'expenses'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">{dateRangeLabel}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right">
            <div className="text-xs sm:text-sm font-mono font-semibold text-slate-100">
              {formatMoney(item.total_spend, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="text-[10px] text-slate-400">NZD</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>
      </div>
      {visibleCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {visibleCats.map((cat) => (
            <span key={cat.category} className="text-[10px] px-2 py-0.5 rounded-md bg-background/70 text-slate-300 border border-border/80">
              {cat.category}: {formatMoney(cat.total_spend)} ({cat.percentage.toFixed(0)}%)
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-background/50 text-slate-400 border border-border/60">
              +{remainingCount} more
            </span>
          )}
        </div>
      )}
    </button>
  );
};

/**
 * Displays cross-category spending grouped by transaction tag (such as trips,
 * events, or projects) with search and drill-down transaction inspection.
 */
export const TagSpendingBreakdown: React.FC<TagSpendingBreakdownProps> = ({
  onRefreshRunway,
  refreshKey = 0,
}) => {
  const s = useTagSpendingState(refreshKey);
  const [selectedTag, setSelectedTag] = useState<TagSpendingSummaryItem | null>(null);

  const handleTagDataChanged = () => {
    const tagPromise = s.loadTagSummary();
    onRefreshRunway?.();
    return tagPromise;
  };

  return (
    <div data-testid="tag-spending-breakdown">
      <GlassCard className="space-y-4">
        <SectionHeader
          title="Spending by Tag & Trips"
          subtitle="Track trips, events, or projects across all categories using #tags"
          icon={<Tag className="w-4 h-4" />}
          variant="brand"
          actions={
            <SegmentedControl<PeriodType>
              options={TAG_PERIOD_OPTIONS}
              value={s.period}
              onChange={s.setPeriod}
              variant="brand"
              size="xs"
              idPrefix="tag-period"
            />
          }
        />

        {Boolean(s.error) && <AlertBanner variant="error">{s.error}</AlertBanner>}

        {s.loading && !s.data ? (
          <LoadingState label="Loading tagged spending..." variant="brand" />
        ) : !s.data || s.data.tags.length === 0 ? (
          <EmptyState
            title="No tagged expenses found for this period."
            description="Add a #tag (e.g. #japan-trip) inside any account or category modal to track total spend across all categories."
            variant="dashed"
          />
        ) : (
          <div className="space-y-3">
            <TagMetricSummary data={s.data} period={s.period} />
            <SearchInput
              value={s.searchQuery}
              onChange={s.setSearchQuery}
              placeholder="Filter #tags or categories (e.g. trip, hotel, food)..."
              variant="brand"
              data-testid="tag-search-input"
            />
            {s.filteredTags.length === 0 ? (
              <EmptyState title={`No tags matching "${s.searchQuery}".`} variant="dashed" />
            ) : (
              <div className="space-y-2">
                {s.filteredTags.map((item) => (
                  <TagSummaryRow key={item.tag} item={item} onSelect={setSelectedTag} />
                ))}
              </div>
            )}
          </div>
        )}

        <TagTransactionInspectionModal
          isOpen={Boolean(selectedTag)}
          onClose={() => setSelectedTag(null)}
          summary={selectedTag}
          period={s.period}
          onTagDataChanged={handleTagDataChanged}
        />
      </GlassCard>
    </div>
  );
};
