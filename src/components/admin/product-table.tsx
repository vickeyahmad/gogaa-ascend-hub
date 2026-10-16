import {
  Search,
  X,
  Pencil,
  Power,
  Inbox,
  AlertCircle,
  Package,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import { ActiveStatusBadge } from './active-status-badge';
import { formatPrice, type AdminProductDto } from '@/lib/products-api';
import type { AdminCategoryDto } from '@/lib/categories-api';

export interface ProductTableProps {
  products: AdminProductDto[];
  categories: AdminCategoryDto[];
  isLoading: boolean;
  error: string | null;
  pendingStatusProductIds?: number[];
  onRetry: () => void;
  onEdit: (product: AdminProductDto) => void;
  onToggleStatus: (product: AdminProductDto) => void;
  onAddNew: () => void;
  selectedStatusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  selectedCategoryId: number | 'all';
  onCategoryFilterChange: (catId: number | 'all') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

export function ProductTable({
  products,
  categories,
  isLoading,
  error,
  pendingStatusProductIds = [],
  onRetry,
  onEdit,
  onToggleStatus,
  onAddNew,
  selectedStatusFilter,
  onStatusFilterChange,
  selectedCategoryId,
  onCategoryFilterChange,
  searchQuery,
  onSearchQueryChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
}: ProductTableProps) {
  const activeCount = products.filter((p) => p.isActive).length;
  const inactiveCount = products.filter((p) => !p.isActive).length;

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="table-shell" data-testid="products-table-container">
      {/* Table Toolbar */}
      <div className="table-toolbar flex-wrap gap-3">
        {/* Status Filter Tabs */}
        <div className="table-tabs" role="tablist" aria-label="Filter products by status">
          <Button
            variant="ghost"
            className={`table-tab ${selectedStatusFilter === 'all' ? 'selected' : ''}`}
            onClick={() => onStatusFilterChange('all')}
            role="tab"
            aria-selected={selectedStatusFilter === 'all'}
            data-testid="filter-tab-all"
          >
            All products
            <span aria-label={`${totalCount} total`}>{totalCount}</span>
          </Button>
          <Button
            variant="ghost"
            className={`table-tab ${selectedStatusFilter === 'active' ? 'selected' : ''}`}
            onClick={() => onStatusFilterChange('active')}
            role="tab"
            aria-selected={selectedStatusFilter === 'active'}
            data-testid="filter-tab-active"
          >
            Active
            <span aria-label={`${activeCount} on current page`}>{activeCount}</span>
          </Button>
          <Button
            variant="ghost"
            className={`table-tab ${selectedStatusFilter === 'inactive' ? 'selected' : ''}`}
            onClick={() => onStatusFilterChange('inactive')}
            role="tab"
            aria-selected={selectedStatusFilter === 'inactive'}
            data-testid="filter-tab-inactive"
          >
            Inactive
            <span aria-label={`${inactiveCount} on current page`}>{inactiveCount}</span>
          </Button>
        </div>

        {/* Category Filter & Search Field */}
        <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto">
          {/* Category Filter Dropdown */}
          <select
            value={selectedCategoryId}
            onChange={(e) => {
              const val = e.target.value;
              onCategoryFilterChange(val === 'all' ? 'all' : parseInt(val, 10));
            }}
            aria-label="Filter products by category"
            data-testid="category-filter-select"
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-muted-foreground w-full sm:w-44"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} {!cat.isActive ? '(Inactive)' : ''}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="search-wrap w-full sm:w-60">
            <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              placeholder="Search products..."
              aria-label="Search products by name, SKU, or description"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              data-testid="products-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="text-muted-foreground hover:text-foreground text-xs p-0.5"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Areas */}
      {isLoading ? (
        /* Loading Skeleton */
        <div
          className="table-skeleton"
          role="status"
          aria-label="Loading products"
          data-testid="table-loading-skeleton"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <div className="table-skeleton-row" key={i}>
              <SkeletonLoader className="h-4 w-44" />
              <SkeletonLoader className="h-4 w-28" />
              <SkeletonLoader className="h-4 w-24" />
              <SkeletonLoader className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="content-state" role="alert" data-testid="products-error-state">
          <AlertCircle className="w-10 h-10 text-destructive mb-2" />
          <h3>Unable to load products</h3>
          <p className="max-w-md">{error}</p>
          <Button
            variant="outline"
            onClick={onRetry}
            className="mt-3"
            data-testid="retry-fetch-button"
          >
            Try again
          </Button>
        </div>
      ) : totalCount === 0 && !searchQuery && selectedCategoryId === 'all' && selectedStatusFilter === 'all' ? (
        /* Empty Catalog State */
        <div className="content-state" data-testid="products-empty-catalog-state">
          <Package className="w-10 h-10 text-muted-foreground mb-2" />
          <h3>No products yet</h3>
          <p>Get started by adding your first product to the catalog.</p>
          <Button
            variant="brand"
            onClick={onAddNew}
            className="mt-3"
            data-testid="empty-add-product-button"
          >
            + Add Product
          </Button>
        </div>
      ) : products.length === 0 ? (
        /* Empty Filter/Search State */
        <div className="content-state" data-testid="products-no-match-state">
          <Inbox className="w-10 h-10 text-muted-foreground mb-2" />
          <h3>No matching products</h3>
          <p>
            No products match your current filters
            {searchQuery ? ` and query "${searchQuery}"` : ''}.
          </p>
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="mt-3"
            data-testid="clear-filters-button"
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table */}
          <div className="table-scroll product-table-desktop">
            <table aria-label="Products management table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Selling Price</th>
                  <th>Availability</th>
                  <th>Last Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => {
                  const isStatusPending = pendingStatusProductIds.includes(prod.id);
                  return (
                    <tr key={prod.id} data-testid={`product-row-${prod.id}`}>
                      {/* Product Name & SKU */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-primary shrink-0">
                            <Package className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{prod.name}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                #{prod.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className="slug-chip font-mono text-[10px] uppercase"
                                title={`Internal SKU: ${prod.internalSku}`}
                              >
                                {prod.internalSku}
                              </span>
                              {prod.description && (
                                <span
                                  className="text-[11px] text-muted-foreground truncate max-w-xs"
                                  title={prod.description}
                                >
                                  {prod.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground text-xs">
                            {prod.categoryName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            /{prod.categorySlug}
                          </span>
                          {!prod.categoryIsActive && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium"
                              title="Parent category is deactivated"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Category Inactive
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Selling Price */}
                      <td className="amount-cell">
                        <span className="font-semibold text-foreground">
                          {formatPrice(prod.sellingPrice, prod.sellingCurrency)}
                        </span>
                      </td>

                      {/* Availability & Active Status */}
                      <td>
                        <div className="flex flex-col gap-1 items-start">
                          <ActiveStatusBadge isActive={prod.isActive} />
                          {prod.isActive && !prod.categoryIsActive && (
                            <span
                              className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded"
                              title="Product is active but hidden because its category is disabled."
                            >
                              Hidden (Category Off)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td className="date-cell">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(prod.updatedAt || prod.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(prod)}
                            title={`Edit ${prod.name}`}
                            aria-label={`Edit ${prod.name}`}
                            data-testid={`edit-product-${prod.id}`}
                            className="h-8 px-2.5 text-xs text-foreground/80 hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleStatus(prod)}
                            disabled={isStatusPending || isLoading}
                            aria-busy={isStatusPending}
                            title={
                              isStatusPending
                                ? `Updating status for ${prod.name}...`
                                : prod.isActive
                                  ? `Deactivate ${prod.name}`
                                  : `Activate ${prod.name}`
                            }
                            aria-label={
                              prod.isActive
                                ? `Deactivate ${prod.name}`
                                : `Activate ${prod.name}`
                            }
                            data-testid={`toggle-status-${prod.id}`}
                            className={`h-8 px-2.5 text-xs ${
                              prod.isActive
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
                                <span>{prod.isActive ? 'Deactivate' : 'Activate'}</span>
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
          <div className="product-cards-grid" data-testid="product-cards-mobile">
            {products.map((prod) => {
              const isStatusPending = pendingStatusProductIds.includes(prod.id);
              return (
                <article
                  key={prod.id}
                  className="product-card"
                  data-testid={`product-card-${prod.id}`}
                >
                  <div className="product-card-header">
                    <div className="min-w-0">
                      <h3 className="product-card-title text-foreground">{prod.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="slug-chip font-mono text-[9px] uppercase">
                          {prod.internalSku}
                        </span>
                        <span className="text-[10px] text-muted-foreground">ID #{prod.id}</span>
                      </div>
                    </div>
                    <ActiveStatusBadge isActive={prod.isActive} />
                  </div>

                  {prod.description && <p className="product-card-desc">{prod.description}</p>}

                  <div className="product-card-meta">
                    <span className="font-semibold text-xs text-foreground">
                      {formatPrice(prod.sellingPrice, prod.sellingCurrency)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {prod.categoryName}
                    </span>
                    {!prod.categoryIsActive && (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Category Inactive
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(prod.updatedAt || prod.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="product-card-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onEdit(prod)}
                      data-testid={`mobile-edit-${prod.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex-1 text-xs ${
                        prod.isActive
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      onClick={() => onToggleStatus(prod)}
                      disabled={isStatusPending || isLoading}
                      aria-busy={isStatusPending}
                      data-testid={`mobile-toggle-${prod.id}`}
                    >
                      {isStatusPending ? (
                        <>
                          <span className="button-loader mr-1.5" aria-hidden="true" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5 mr-1" />
                          {prod.isActive ? 'Deactivate' : 'Activate'}
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
              Showing {startRecord}–{endRecord} of {totalCount} products
            </span>

            {totalPages > 1 && (
              <div className="pagination" role="navigation" aria-label="Products pagination">
                <Button
                  variant="outline"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  data-testid="pagination-prev"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant="ghost"
                    className={page === pageNum ? 'current' : ''}
                    onClick={() => onPageChange(pageNum)}
                    aria-label={`Page ${pageNum}`}
                    aria-current={page === pageNum ? 'page' : undefined}
                    data-testid={`pagination-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
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
