import {
  Search,
  X,
  Pencil,
  Power,
  Inbox,
  AlertCircle,
  Store,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import { ActiveStatusBadge } from './active-status-badge';
import type { AdminVendorDto } from '@/lib/vendors-api';

export interface VendorTableProps {
  vendors: AdminVendorDto[];
  isLoading: boolean;
  error: string | null;
  pendingStatusVendorIds?: number[];
  onRetry: () => void;
  onEdit: (vendor: AdminVendorDto) => void;
  onToggleStatus: (vendor: AdminVendorDto) => void;
  onAddNew: () => void;
  selectedStatusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

export function VendorTable({
  vendors,
  isLoading,
  error,
  pendingStatusVendorIds = [],
  onRetry,
  onEdit,
  onToggleStatus,
  onAddNew,
  selectedStatusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
}: VendorTableProps) {
  const activeCount = vendors.filter((v) => v.isActive).length;
  const inactiveCount = vendors.filter((v) => !v.isActive).length;

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="table-shell" data-testid="vendors-table-container">
      {/* Table Toolbar */}
      <div className="table-toolbar flex-wrap gap-3">
        {/* Status Filter Tabs */}
        <div className="table-tabs" role="tablist" aria-label="Filter vendors by status">
          <Button
            variant="ghost"
            className={`table-tab ${selectedStatusFilter === 'all' ? 'selected' : ''}`}
            onClick={() => onStatusFilterChange('all')}
            role="tab"
            aria-selected={selectedStatusFilter === 'all'}
            data-testid="filter-tab-all"
          >
            All suppliers
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

        {/* Search Field */}
        <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto">
          <div className="search-wrap w-full sm:w-64">
            <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              placeholder="Search suppliers..."
              aria-label="Search suppliers by internal name"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              data-testid="vendors-search-input"
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
          aria-label="Loading suppliers"
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
        <div className="content-state" role="alert" data-testid="vendors-error-state">
          <AlertCircle className="w-10 h-10 text-destructive mb-2" />
          <h3>Unable to load suppliers</h3>
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
      ) : totalCount === 0 && !searchQuery && selectedStatusFilter === 'all' ? (
        /* Empty Catalog State */
        <div className="content-state" data-testid="vendors-empty-catalog-state">
          <Store className="w-10 h-10 text-muted-foreground mb-2" />
          <h3>No suppliers yet</h3>
          <p>Get started by adding your first supplier record for fulfillment routing.</p>
          <Button
            variant="brand"
            onClick={onAddNew}
            className="mt-3"
            data-testid="empty-add-vendor-button"
          >
            + Add Supplier
          </Button>
        </div>
      ) : vendors.length === 0 ? (
        /* Empty Filter/Search State */
        <div className="content-state" data-testid="vendors-no-match-state">
          <Inbox className="w-10 h-10 text-muted-foreground mb-2" />
          <h3>No matching suppliers</h3>
          <p>
            No suppliers match your current filters
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
          <div className="table-scroll vendor-table-desktop">
            <table aria-label="Vendors management table">
              <thead>
                <tr>
                  <th>Supplier (Internal Name)</th>
                  <th>Status</th>
                  <th>Product Mappings</th>
                  <th>Last Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => {
                  const isStatusPending = pendingStatusVendorIds.includes(vendor.id);
                  return (
                    <tr key={vendor.id} data-testid={`vendor-row-${vendor.id}`}>
                      {/* Vendor Name & ID */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-primary shrink-0">
                            <Store className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{vendor.internalName}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                #{vendor.id}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              Internal Supplier
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td>
                        <ActiveStatusBadge isActive={vendor.isActive} />
                      </td>

                      {/* Product Mappings Count */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="product-count-chip text-xs"
                            title={`${vendor.productMappingCount} linked product mapping(s)`}
                            data-testid={`vendor-mapping-count-${vendor.id}`}
                          >
                            <Link2 className="w-3 h-3 text-muted-foreground" />
                            <span>
                              {vendor.productMappingCount}{' '}
                              {vendor.productMappingCount === 1 ? 'mapping' : 'mappings'}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td className="date-cell">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(vendor.updatedAt || vendor.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(vendor)}
                            title={`Edit ${vendor.internalName}`}
                            aria-label={`Edit ${vendor.internalName}`}
                            data-testid={`edit-vendor-${vendor.id}`}
                            className="h-8 px-2.5 text-xs text-foreground/80 hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleStatus(vendor)}
                            disabled={isStatusPending || isLoading}
                            aria-busy={isStatusPending}
                            title={
                              isStatusPending
                                ? `Updating status for ${vendor.internalName}...`
                                : vendor.isActive
                                  ? `Deactivate ${vendor.internalName}`
                                  : `Activate ${vendor.internalName}`
                            }
                            aria-label={
                              vendor.isActive
                                ? `Deactivate ${vendor.internalName}`
                                : `Activate ${vendor.internalName}`
                            }
                            data-testid={`toggle-status-${vendor.id}`}
                            className={`h-8 px-2.5 text-xs ${
                              vendor.isActive
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
                                <span>{vendor.isActive ? 'Deactivate' : 'Activate'}</span>
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
          <div className="vendor-cards-grid" data-testid="vendor-cards-mobile">
            {vendors.map((vendor) => {
              const isStatusPending = pendingStatusVendorIds.includes(vendor.id);
              return (
                <article
                  key={vendor.id}
                  className="vendor-card"
                  data-testid={`vendor-card-${vendor.id}`}
                >
                  <div className="vendor-card-header">
                    <div className="min-w-0">
                      <h3 className="vendor-card-title text-foreground">{vendor.internalName}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">ID #{vendor.id}</span>
                      </div>
                    </div>
                    <ActiveStatusBadge isActive={vendor.isActive} />
                  </div>

                  <div className="vendor-card-meta">
                    <span className="product-count-chip text-xs">
                      <Link2 className="w-3 h-3 text-muted-foreground" />
                      <span>
                        {vendor.productMappingCount}{' '}
                        {vendor.productMappingCount === 1 ? 'mapping' : 'mappings'}
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(vendor.updatedAt || vendor.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="vendor-card-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onEdit(vendor)}
                      data-testid={`mobile-edit-${vendor.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex-1 text-xs ${
                        vendor.isActive
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      onClick={() => onToggleStatus(vendor)}
                      disabled={isStatusPending || isLoading}
                      aria-busy={isStatusPending}
                      data-testid={`mobile-toggle-${vendor.id}`}
                    >
                      {isStatusPending ? (
                        <>
                          <span className="button-loader mr-1.5" aria-hidden="true" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5 mr-1" />
                          {vendor.isActive ? 'Deactivate' : 'Activate'}
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
              Showing {startRecord}–{endRecord} of {totalCount} suppliers
            </span>

            {totalPages > 1 && (
              <div className="pagination" role="navigation" aria-label="Vendors pagination">
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
