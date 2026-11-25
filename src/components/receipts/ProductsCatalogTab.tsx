import React from 'react';
import { Star, Tag } from 'lucide-react';
import { Button, EmptyState, FilterChipBar, LoadingState, SearchInput } from '@yggdrasil-lab/ui';
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

interface ProductsCatalogFiltersProps {
  allTags: string[];
  selectedDomain: string;
  selectedTag: string;
  searchQuery: string;
  filterFavorites: boolean;
  onChangeDomain: (domain: string) => void;
  onChangeTag: (tag: string) => void;
  onChangeSearch: (query: string) => void;
  onToggleFavorites: () => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

const ProductsCatalogFilters: React.FC<ProductsCatalogFiltersProps> = ({
  allTags, selectedDomain, selectedTag, searchQuery, filterFavorites,
  onChangeDomain, onChangeTag, onChangeSearch, onToggleFavorites, onSearchSubmit,
}) => (
  <>
    <form onSubmit={onSearchSubmit}>
      <SearchInput
        value={searchQuery}
        onChange={onChangeSearch}
        placeholder="Search products, brands, tags, or notes..."
        variant="brand"
        rightSlot={
          <Button
            type="button"
            variant={filterFavorites ? 'primary' : 'outline'}
            size="xs"
            onClick={onToggleFavorites}
            icon={<Star className={`w-3 h-3 ${filterFavorites ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />}
            title="Filter favorites"
          >
            Starred
          </Button>
        }
      />
    </form>
    <FilterChipBar options={DOMAIN_FILTERS} selectedId={selectedDomain} onSelect={onChangeDomain} variant="brand" size="xs" />
    {allTags.length > 0 && (
      <FilterChipBar
        options={[{ id: 'all', label: '#all' }, ...allTags.map((tag) => ({ id: tag, label: `#${tag}` }))]}
        selectedId={selectedTag}
        onSelect={onChangeTag}
        toggleDeselectId="all"
        variant="brand"
        tone="solid"
        size="xs"
        scrollable
        prefix={<span className="text-[10px] text-slate-500 font-medium flex items-center"><Tag className="w-3 h-3 mr-1 text-slate-500" /> Tags:</span>}
      />
    )}
  </>
);

/**
 * Product catalog search, domain/tag filtering, and price history timeline list.
 */
export const ProductsCatalogTab: React.FC<ProductsCatalogTabProps> = ({
  products, allTags, loading, selectedDomain, selectedTag, searchQuery, filterFavorites,
  onChangeDomain, onChangeTag, onChangeSearch, onToggleFavorites, onSearchSubmit,
  onToggleFavorite, onSaveNote, onAddTag, onRemoveTag,
}) => (
  <div className="space-y-3">
    <ProductsCatalogFilters
      allTags={allTags} selectedDomain={selectedDomain} selectedTag={selectedTag}
      searchQuery={searchQuery} filterFavorites={filterFavorites} onChangeDomain={onChangeDomain}
      onChangeTag={onChangeTag} onChangeSearch={onChangeSearch} onToggleFavorites={onToggleFavorites}
      onSearchSubmit={onSearchSubmit}
    />
    {loading ? (
      <LoadingState label="Loading product inventory and price telemetry..." variant="brand" />
    ) : products.length === 0 ? (
      <EmptyState title="No products match the selected criteria" description="Upload receipts or adjust tags to see cataloged items." variant="dashed" />
    ) : (
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {products.map((p) => (
          <ProductCard
            key={p.id} product={p} onToggleFavorite={onToggleFavorite}
            onSaveNote={onSaveNote} onAddTag={onAddTag} onRemoveTag={onRemoveTag}
          />
        ))}
      </div>
    )}
  </div>
);
