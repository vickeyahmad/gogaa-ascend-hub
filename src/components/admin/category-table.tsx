import { useState, useMemo } from 'react';
import {
  Search,
  X,
  Pencil,
  Power,
  Inbox,
  AlertCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import { ActiveStatusBadge } from './active-status-badge';
import type { AdminCategoryDto } from '@/lib/categories-api';

export interface CategoryTableProps {
  categories: AdminCategoryDto[];
  isLoading: boolean;
  error: string | null;
  pendingStatusCategoryIds?: number[];
  onRetry: () => void;
  onEdit: (category: AdminCategoryDto) => void;
  onToggleStatus: (category: AdminCategoryDto) => void;
  onAddNew: () => void;
  selectedStatusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  pageSize?: number;
}

export function CategoryTable({
  categories,
  isLoading,
  error,
  pendingStatusCategoryIds = [],
  onRetry,
  onEdit,
  onToggleStatus,
  onAddNew,
  selectedStatusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  pageSize = 10,
}: CategoryTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Compute status counts from the full dataset
  const activeCount = useMemo(
    () => categories.filter((c) => c.isActive).length,
    [categories],
  );
  const inactiveCount = useMemo(
    () => categories.filter((c) => !c.isActive).length,
    [categories],
  );

  // Filter categories by search query and active status
  const filteredCategories = useMemo(() => {
    let result = categories;

    if (selectedStatusFilter === 'active') {
      result = result.filter((c) => c.isActive);
    } else if (selectedStatusFilter === 'inactive') {
      result = result.filter((c) => !c.isActive);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [categories, selectedStatusFilter, searchQuery]);

  // Pagination slicing
  const totalItems = filteredCategories.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedCategories = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, safePage, pageSize]);

  const handleStatusFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    onStatusFilterChange(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    onSearchQueryChange(val);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    onSearchQueryChange('');
    onStatusFilterChange('all');
    setCurrentPage(1);
  };

  const startRecord = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="table-shell" data-testid="categories-table-container">
      {/* Table Toolbar */}
      <div className="table-toolbar flex-wrap gap-3">
        {/* Status Filter Tabs */}
        <div className="table-tabs" role="tablist" aria-label="Filter categories by status">
          <Button
            variant="ghost"
            className={`table-tab ${selectedStatusFilter === 'all' ? 'selected' : ''}`}
            onClick={() => handleStatusFilterChange('all')}
            role="tab"
            aria-selected={selectedStatusFilter === 'all'}
            data-testid="filter-tab-all"
          >
            All categories
            <span aria-label={`${categories.length} total`}>{categories.length}</span>
          </Button>
          <Button
            variant="ghost"
            className={`table-tab ${selectedStatusFilter === 'active' ? 'selected' : ''}`}
            onClick={() => handleStatusFilterChange('active')}
            role="tab"
            aria-selected={selectedStatusFilter === 'active'}
            data-testid="filter-tab-active"
          >
            Active
            <span aria-label={`${activeCount} active`}>{activeCount}</span>
          </Button>
          <Button
            variant="ghost"
            className={`table-tab ${selectedStatusFilter === 'inactive' ? 'selected' : ''}`}
            onClick={() => handleStatusFilterChange('inactive')}
            role="tab"
            aria-selected={selectedStatusFilter === 'inactive'}
            data-testid="filter-tab-inactive"
          >
            Inactive
            <span aria-label={`${inactiveCount} inactive`}>{inactiveCount}</span>
          </Button>
        </div>

        {/* Search Field */}
        <div className="search-wrap ml-auto w-full sm:w-64">
          <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            placeholder="Search categories..."
            aria-label="Search categories by name, slug, or description"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="categories-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="text-muted-foreground hover:text-foreground text-xs p-0.5"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Areas */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="table-skeleton" role="status" aria-label="Loading categories" data-testid="table-loading-skeleton">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="table-skeleton-row" key={i}>
              <SkeletonLoader className="h-4 w-40" />
              <SkeletonLoader className="h-4 w-28" />
              <SkeletonLoader className="h-4 w-16" />
              <SkeletonLoader className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="content-state" role="alert" data-testid="categories-error-state">
          <AlertCircle className="w-10 h-10 text-destructive mb-2" />
          <h3>Unable to load categories</h3>
          <p className="max-w-md">{error}</p>
          <Button variant="outline" onClick={onRetry} className="mt-3" data-testid="retry-fetch-button">
            Try again
          </Button>
        </div>
      ) : categories.length === 0 ? (
        /* Empty Catalog State */
        <div className="content-state" data-testid="categories-empty-catalog-state">
          <FolderOpen className="w-10 h-10 text-muted-foreground mb-2" />
          <h3>No categories yet</h3>
          <p>Get started by adding your first product category.</p>
          <Button variant="brand" onClick={onAddNew} className="mt-3" data-testid="empty-add-category-button">
            + Add Category
          </Button>
        </div>
      ) : filteredCategories.length === 0 ? (
        /* Empty Search / Filter State */
        <div className="content-state" data-testid="categories-no-match-state">
          <Inbox className="w-10 h-10 text-muted-foreground mb-2" />
          <h3>No matching categories</h3>
          <p>
            No categories match your query &quot;{searchQuery}&quot; with filter &quot;{selectedStatusFilter}&quot;.
          </p>
          <Button variant="outline" onClick={handleClearSearch} className="mt-3" data-testid="clear-search-button">
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table */}
          <div className="table-scroll category-table-desktop">
            <table aria-label="Product categories management table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>URL Slug</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCategories.map((cat) => {
                  const isStatusPending = pendingStatusCategoryIds.includes(cat.id);
                  return (
                    <tr key={cat.id} data-testid={`category-row-${cat.id}`}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-primary shrink-0">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{cat.name}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                #{cat.id}
                              </span>
                            </div>
                            {cat.description && (
                              <div
                                className="text-[11px] text-muted-foreground truncate max-w-xs"
                                title={cat.description}
                              >
                                {cat.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="slug-chip" title={`Public slug: ${cat.slug}`}>
                          /{cat.slug}
                        </span>
                      </td>

                      <td>
                        <span className="product-count-chip">
                          <Package className="w-3 h-3 text-muted-foreground" />
                          {cat.productCount} {cat.productCount === 1 ? 'product' : 'products'}
                        </span>
                      </td>

                      <td>
                        <ActiveStatusBadge isActive={cat.isActive} />
                      </td>

                      <td className="date-cell">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(cat.updatedAt || cat.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>

                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(cat)}
                            title={`Edit ${cat.name}`}
                            aria-label={`Edit ${cat.name}`}
                            data-testid={`edit-category-${cat.id}`}
                            className="h-8 px-2.5 text-xs text-foreground/80 hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleStatus(cat)}
                            disabled={isStatusPending || isLoading}
                            aria-busy={isStatusPending}
                            title={
                              isStatusPending
                                ? `Updating status for ${cat.name}...`
                                : cat.isActive
                                  ? `Deactivate ${cat.name}`
                                  : `Activate ${cat.name}`
                            }
                            aria-label={cat.isActive ? `Deactivate ${cat.name}` : `Activate ${cat.name}`}
                            data-testid={`toggle-status-${cat.id}`}
                            className={`h-8 px-2.5 text-xs ${
                              cat.isActive
                                ? 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                                : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                            }`}
                          >
                            {isStatusPending ? (
                              <>
                                <span className="button-loader mr-1.5" aria-hidden="true" />
                                <span>Updating...</span>
                              </>
                            ) : (
                              <>
                                <Power className="w-3.5 h-3.5 mr-1" />
                                <span>{cat.isActive ? 'Deactivate' : 'Activate'}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards Grid */}
          <div className="category-cards-grid" data-testid="category-cards-mobile">
            {paginatedCategories.map((cat) => {
              const isStatusPending = pendingStatusCategoryIds.includes(cat.id);
              return (
                <article key={cat.id} className="category-card" data-testid={`category-card-${cat.id}`}>
                  <div className="category-card-header">
                    <div>
                      <h3 className="category-card-title text-foreground">{cat.name}</h3>
                      <span className="text-[10px] text-muted-foreground">ID #{cat.id}</span>
                    </div>
                    <ActiveStatusBadge isActive={cat.isActive} />
                  </div>

                  {cat.description && (
                    <p className="category-card-desc">{cat.description}</p>
                  )}

                  <div className="category-card-meta">
                    <span className="slug-chip">/{cat.slug}</span>
                    <span className="product-count-chip">
                      <Package className="w-3 h-3 text-muted-foreground" />
                      {cat.productCount} {cat.productCount === 1 ? 'product' : 'products'}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(cat.updatedAt || cat.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="category-card-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onEdit(cat)}
                      data-testid={`mobile-edit-${cat.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex-1 text-xs ${
                        cat.isActive
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      onClick={() => onToggleStatus(cat)}
                      disabled={isStatusPending || isLoading}
                      aria-busy={isStatusPending}
                      data-testid={`mobile-toggle-${cat.id}`}
                    >
                      {isStatusPending ? (
                        <>
                          <span className="button-loader mr-1.5" aria-hidden="true" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5 mr-1" />
                          {cat.isActive ? 'Deactivate' : 'Activate'}
                        </>
                      )}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Table Footer with Pagination */}
          <div className="table-footer flex-wrap gap-2">
            <span>
              Showing {startRecord}–{endRecord} of {totalItems} categories
              {totalItems !== categories.length && ` (filtered from ${categories.length})`}
            </span>

            {totalPages > 1 && (
              <div className="pagination" role="navigation" aria-label="Categories pagination">
                <Button
                  variant="outline"
                  aria-label="Previous page"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  data-testid="pagination-prev"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant="ghost"
                    className={safePage === pageNum ? 'current' : ''}
                    onClick={() => setCurrentPage(pageNum)}
                    aria-label={`Page ${pageNum}`}
                    aria-current={safePage === pageNum ? 'page' : undefined}
                    data-testid={`pagination-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  aria-label="Next page"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="pagination-next"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
