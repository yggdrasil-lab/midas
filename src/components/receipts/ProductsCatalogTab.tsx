import React from 'react';
import { Star, Tag } from 'lucide-react';
import { Button, EmptyState, LoadingState, SearchInput } from '@yggdrasil-lab/ui';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductsCatalogTabProps {
  products: Product[];
  allTags: string[];
  loading: boolean;
  selectedDomain: string;
  selectedTag: string;
  searchQuery: string;
  filterFavorites: boolean;
  onChangeDomain: (domain: string) => void;
  onChangeTag: (tag: string) => void;
  onChangeSearch: (query: string) => void;
  onToggleFavorites: () => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onToggleFavorite: (product: Product) => Promise<void>;
  onSaveNote: (productId: number, note: string) => Promise<void>;
  onAddTag: (productId: number, tag: string) => Promise<void>;
  onRemoveTag: (productId: number, tag: string) => Promise<void>;
}

const DOMAIN_FILTERS = [
  { id: 'all', label: 'All Domains' },
  { id: '02-skin', label: 'Skincare' },
  { id: '01-health', label: 'Health' },
  { id: '20-home', label: 'Home' },
];

/**
 * Product catalog search, domain/tag filtering, and price history timeline list.
 */
export const ProductsCatalogTab: React.FC<ProductsCatalogTabProps> = ({
  products,
  allTags,
  loading,
  selectedDomain,
  selectedTag,
  searchQuery,
  filterFavorites,
  onChangeDomain,
  onChangeTag,
  onChangeSearch,
  onToggleFavorites,
  onSearchSubmit,
  onToggleFavorite,
  onSaveNote,
  onAddTag,
  onRemoveTag,
}) => {
  return (
    <div className="space-y-3">
      <form onSubmit={onSearchSubmit}>
        <SearchInput
          value={searchQuery}
          onChange={onChangeSearch}
          placeholder="Search products, brands, tags, or notes..."
          variant="amber"
          rightSlot={
            <Button
              type="button"
              variant={filterFavorites ? 'primary' : 'outline'}
              size="xs"
              onClick={onToggleFavorites}
              icon={
                <Star
                  className={`w-3 h-3 ${
                    filterFavorites ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                  }`}
                />
              }
              title="Filter favorites"
            >
              Starred
            </Button>
          }
        />
      </form>

      {/* Domain Filter Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DOMAIN_FILTERS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onChangeDomain(d.id)}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
              selectedDomain === d.id
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium'
                : 'text-slate-400 hover:text-slate-200 bg-card/30 border border-border/40'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Dynamic Tag Pills */}
      {allTags.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none">
          <span className="text-[10px] text-slate-500 font-medium flex items-center shrink-0">
            <Tag className="w-3 h-3 mr-1 text-slate-500" /> Tags:
          </span>
          <button
            type="button"
            onClick={() => onChangeTag('all')}
            className={`px-2 py-0.5 text-[11px] rounded-md transition-colors shrink-0 ${
              selectedTag === 'all'
                ? 'bg-amber-500 text-slate-900 font-bold'
                : 'bg-card/50 text-slate-400 hover:text-slate-200 border border-border/40'
            }`}
          >
            #all
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChangeTag(tag === selectedTag ? 'all' : tag)}
              className={`px-2 py-0.5 text-[11px] rounded-md transition-colors shrink-0 ${
                selectedTag === tag
                  ? 'bg-amber-500 text-slate-900 font-bold'
                  : 'bg-card/50 text-slate-400 hover:text-slate-200 border border-border/40'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading product inventory and price telemetry..." variant="amber" />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products match the selected criteria"
          description="Upload receipts or adjust tags to see cataloged items."
          variant="dashed"
        />
      ) : (
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onToggleFavorite={onToggleFavorite}
              onSaveNote={onSaveNote}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
            />
          ))}
        </div>
      )}
    </div>
  );
};
