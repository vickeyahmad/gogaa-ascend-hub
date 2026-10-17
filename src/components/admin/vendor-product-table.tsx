import {
  Search,
  X,
  Pencil,
  Power,
  Inbox,
  AlertCircle,
  Link2,
  ChevronLeft,
  ChevronRight,
  Store,
  Package,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import { ActiveStatusBadge } from './active-status-badge';
import {
  formatVendorCost,
  type AdminVendorProductDto,
} from '@/lib/vendor-products-api';
import type { AdminVendorDto } from '@/lib/vendors-api';

export interface VendorProductTableProps {
  mappings: AdminVendorProductDto[];
  vendors: AdminVendorDto[];
  isLoading: boolean;
  error: string | null;
  pendingAvailabilityIds?: number[];
  onRetry: () => void;
  onEdit: (mapping: AdminVendorProductDto) => void;
  onToggleAvailability: (mapping: AdminVendorProductDto) => void;
  onAddNew: () => void;
  selectedAvailabilityFilter: 'all' | 'available' | 'unavailable';
  onAvailabilityFilterChange: (filter: 'all' | 'available' | 'unavailable') => void;
  selectedVendorId: number | 'all';
  onVendorFilterChange: (vendorId: number | 'all') => void;
  selectedCurrency: string | 'all';
  onCurrencyFilterChange: (currency: string | 'all') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

const COMMON_CURRENCIES = ['PKR', 'USD', 'USDT', 'EUR'];

function getPriorityLabel(priority: number): string {
  if (priority <= 1) return 'High';
  if (priority <= 10) return 'Normal';
  if (priority <= 50) return 'Standard';
  return 'Low';
}

export function VendorProductTable({
  mappings,
  vendors,
  isLoading,
  error,
  pendingAvailabilityIds = [],
  onRetry,
  onEdit,
  onToggleAvailability,
  onAddNew,
  selectedAvailabilityFilter,
  onAvailabilityFilterChange,
  selectedVendorId,
  onVendorFilterChange,
  selectedCurrency,
  onCurrencyFilterChange,
  searchQuery,
  onSearchQueryChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
}: VendorProductTableProps) {
  const availableCount = mappings.filter((m) => m.isAvailable).length;
  const unavailableCount = mappings.filter((m) => !m.isAvailable).length;

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  const hasActiveFilters =
    selectedAvailabilityFilter !== 'all' ||
    selectedVendorId !== 'all' ||
    selectedCurrency !== 'all' ||
    Boolean(searchQuery.trim());

  return (
    <div className="table-shell" data-testid="vendor-products-table-container">
      {/* Table Toolbar */}
      <div className="table-toolbar flex-wrap gap-3">
        {/* Availability Filter Tabs */}
        <div className="table-tabs" role="tablist" aria-label="Filter mappings by availability">
          <Button
            variant="ghost"
            className={`table-tab ${selectedAvailabilityFilter === 'all' ? 'selected' : ''}`}
            onClick={() => onAvailabilityFilterChange('all')}
            role="tab"
            aria-selected={selectedAvailabilityFilter === 'all'}
            data-testid="filter-tab-all"
          >
            All mappings
            <span aria-label={`${totalCount} total`}>{totalCount}</span>
          </Button>
          <Button
            variant="ghost"
            className={`table-tab ${selectedAvailabilityFilter === 'available' ? 'selected' : ''}`}
            onClick={() => onAvailabilityFilterChange('available')}
            role="tab"
            aria-selected={selectedAvailabilityFilter === 'available'}
            data-testid="filter-tab-available"
          >
            Available
            <span aria-label={`${availableCount} on current page`}>{availableCount}</span>
          </Button>
          <Button
            variant="ghost"
            className={`table-tab ${selectedAvailabilityFilter === 'unavailable' ? 'selected' : ''}`}
            onClick={() => onAvailabilityFilterChange('unavailable')}
            role="tab"
            aria-selected={selectedAvailabilityFilter === 'unavailable'}
            data-testid="filter-tab-unavailable"
          >
            Unavailable
            <span aria-label={`${unavailableCount} on current page`}>{unavailableCount}</span>
          </Button>
        </div>

        {/* Filter Dropdowns & Search */}
        <div className="flex items-center flex-wrap gap-2.5 ml-auto w-full sm:w-auto">
          {/* Vendor Filter Dropdown */}
          <select
            value={selectedVendorId}
            onChange={(e) => {
              const val = e.target.value;
              onVendorFilterChange(val === 'all' ? 'all' : parseInt(val, 10));
            }}
            aria-label="Filter mappings by vendor"
            data-testid="vendor-filter-select"
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-muted-foreground w-full sm:w-40"
          >
            <option value="all">All Suppliers</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.internalName} {!v.isActive ? '(Inactive)' : ''}
              </option>
            ))}
          </select>

          {/* Currency Filter Dropdown */}
          <select
            value={selectedCurrency}
            onChange={(e) => onCurrencyFilterChange(e.target.value)}
            aria-label="Filter mappings by currency"
            data-testid="currency-filter-select"
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-muted-foreground w-full sm:w-32"
          >
            <option value="all">All Currencies</option>
            {COMMON_CURRENCIES.map((cur) => (
              <option key={cur} value={cur}>
                {cur}
              </option>
            ))}
          </select>

          {/* Search by Product SKU / Name */}
          <div className="search-wrap w-full sm:w-56">
            <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              placeholder="Search by SKU..."
              aria-label="Search mappings by product SKU"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              data-testid="vendor-products-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="text-muted-foreground hover:text-foreground text-xs p-0.5"
                title="Clear search"
                aria-label="Clear search"
                data-testid="clear-search-button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
              data-testid="clear-all-filters-button"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div
          className="p-6 text-center text-sm text-destructive bg-destructive/10 border-b border-border space-y-3"
          role="alert"
          data-testid="vendor-products-error-banner"
        >
          <div className="flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-xs"
            data-testid="retry-fetch-button"
          >
            Retry Connection
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="p-4 space-y-3" data-testid="vendor-products-loading-skeleton">
          <SkeletonLoader count={5} />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && mappings.length === 0 && (
        <div className="p-12 text-center" data-testid="vendor-products-empty-state">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          {hasActiveFilters ? (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">No mappings match your filters</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No supplier product mappings match the selected supplier, currency, availability, or SKU query.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="mt-2 text-xs"
                data-testid="empty-clear-filters-button"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">No product mappings established</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Connect your internal products to external supplier catalog IDs, set purchase costs, and define routing priority.
              </p>
              <Button
                onClick={onAddNew}
                size="sm"
                className="mt-2 text-xs"
                data-testid="empty-add-mapping-button"
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                Add First Mapping
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Desktop Table View */}
      {!isLoading && !error && mappings.length > 0 && (
        <div className="table-scroll hidden md:block">
          <table className="w-full text-left border-collapse" data-testid="vendor-products-table">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground">
                <th className="py-3 px-4">Internal Product</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">External Product ID</th>
                <th className="py-3 px-4">Wholesale Cost</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Mapping Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {mappings.map((mapping) => {
                const isPending = pendingAvailabilityIds.includes(mapping.id);
                const priorityLabel = getPriorityLabel(mapping.priority);

                return (
                  <tr
                    key={mapping.id}
                    className="hover:bg-muted/40 transition-colors"
                    data-testid={`vendor-product-row-${mapping.id}`}
                  >
                    {/* Internal Product */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{mapping.productName}</span>
                          {!mapping.productIsActive && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                              title="Internal product is inactive"
                              data-testid={`product-inactive-indicator-${mapping.id}`}
                            >
                              Product Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono bg-muted/80 px-1.5 py-0.5 rounded text-foreground/80 font-medium">
                            {mapping.productSku}
                          </span>
                          <span>·</span>
                          <span>
                            Retail: {mapping.productSellingPrice} {mapping.productSellingCurrency}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{mapping.vendorName}</span>
                        {!mapping.vendorIsActive && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                            title="Supplier vendor is inactive"
                            data-testid={`vendor-inactive-indicator-${mapping.id}`}
                          >
                            Supplier Inactive
                          </span>
                        )}
                      </div>
                    </td>

                    {/* External Product ID */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <span
                        className="bg-accent/40 text-foreground px-2 py-1 rounded border border-border/60"
                        data-testid={`external-id-${mapping.id}`}
                      >
                        {mapping.externalProductId}
                      </span>
                    </td>

                    {/* Wholesale Cost */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-foreground" data-testid={`vendor-cost-${mapping.id}`}>
                        {formatVendorCost(mapping.vendorCost, mapping.vendorCostCurrency)}
                      </span>
                    </td>

                    {/* Routing Priority */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                            mapping.priority <= 1
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25'
                              : mapping.priority <= 10
                                ? 'bg-primary/10 text-primary border border-primary/25'
                                : 'bg-muted text-muted-foreground border border-border'
                          }`}
                          data-testid={`priority-badge-${mapping.id}`}
                        >
                          #{mapping.priority}
                        </span>
                        <span className="text-[10px] text-muted-foreground">({priorityLabel})</span>
                      </div>
                    </td>

                    {/* Availability */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <ActiveStatusBadge
                          isActive={mapping.isAvailable}
                          activeLabel="Available"
                          inactiveLabel="Unavailable"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          onClick={() => onToggleAvailability(mapping)}
                          title={mapping.isAvailable ? 'Disable availability' : 'Enable availability'}
                          className={`h-7 w-7 ${
                            mapping.isAvailable
                              ? 'text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10'
                              : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'
                          }`}
                          data-testid={`toggle-availability-button-${mapping.id}`}
                        >
                          {isPending ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(mapping)}
                        title="Edit mapping"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        data-testid={`edit-mapping-button-${mapping.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Card List View */}
      {!isLoading && !error && mappings.length > 0 && (
        <div className="block md:hidden divide-y divide-border" data-testid="vendor-products-mobile-list">
          {mappings.map((mapping) => {
            const isPending = pendingAvailabilityIds.includes(mapping.id);
            const priorityLabel = getPriorityLabel(mapping.priority);

            return (
              <div
                key={mapping.id}
                className="p-4 space-y-3"
                data-testid={`vendor-product-card-${mapping.id}`}
              >
                {/* Product Name & SKU */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{mapping.productName}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground/80">
                        {mapping.productSku}
                      </span>
                      <span>·</span>
                      <span>{mapping.vendorName}</span>
                    </div>
                  </div>
                  <ActiveStatusBadge
                    isActive={mapping.isAvailable}
                    activeLabel="Available"
                    inactiveLabel="Unavailable"
                  />
                </div>

                {/* External ID & Cost Details */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/60">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">External Product ID</span>
                    <span className="font-mono font-medium text-foreground">{mapping.externalProductId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Wholesale Cost</span>
                    <span className="font-semibold text-foreground">
                      {formatVendorCost(mapping.vendorCost, mapping.vendorCostCurrency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Priority</span>
                    <span className="font-mono font-medium text-foreground">
                      #{mapping.priority} ({priorityLabel})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Customer Price</span>
                    <span className="text-foreground">
                      {mapping.productSellingPrice} {mapping.productSellingCurrency}
                    </span>
                  </div>
                </div>

                {/* Inactive indicators if any */}
                {(!mapping.vendorIsActive || !mapping.productIsActive) && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {!mapping.vendorIsActive && !mapping.productIsActive
                        ? 'Both supplier and product are inactive.'
                        : !mapping.vendorIsActive
                          ? 'Supplier is currently inactive.'
                          : 'Internal product is currently inactive.'}
                    </span>
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => onToggleAvailability(mapping)}
                    className="text-xs h-8"
                    data-testid={`mobile-toggle-availability-${mapping.id}`}
                  >
                    <Power className="w-3.5 h-3.5 mr-1.5" />
                    {mapping.isAvailable ? 'Disable Availability' : 'Enable Availability'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(mapping)}
                    className="text-xs h-8 text-muted-foreground hover:text-foreground"
                    data-testid={`mobile-edit-button-${mapping.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && !error && totalCount > 0 && (
        <div
          className="table-footer flex-wrap gap-3"
          data-testid="vendor-products-pagination"
        >
          <div className="text-xs text-muted-foreground" data-testid="pagination-records-info">
            Showing <strong className="text-foreground font-semibold">{startRecord}</strong> to{' '}
            <strong className="text-foreground font-semibold">{endRecord}</strong> of{' '}
            <strong className="text-foreground font-semibold">{totalCount}</strong> mappings
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              data-testid="pagination-prev-button"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground px-2" data-testid="pagination-page-indicator">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              data-testid="pagination-next-button"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
