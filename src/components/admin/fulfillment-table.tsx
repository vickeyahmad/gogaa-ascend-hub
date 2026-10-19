import {
  Eye,
  Inbox,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Workflow,
  ShieldCheck,
  Search,
  X,
  Package,
  Layers,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import {
  getFulfillmentQueueStatusBadgeInfo,
  getParentOrderStatusBadgeInfo,
  getFulfillmentMethodBadgeInfo,
  formatFulfillmentDate,
  type AdminFulfillmentSummaryDto,
} from '@/lib/fulfillments-api';

export interface FulfillmentTableProps {
  fulfillments: AdminFulfillmentSummaryDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewDetails: (item: AdminFulfillmentSummaryDto) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  selectedOrderStatus: string;
  onOrderStatusChange: (orderStatus: string) => void;
  searchQuery: string;
  onSearchChange: (search: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  onSelectQuickView?: (viewId: string) => void;
  activeQuickView?: string;
}

const QUICK_VIEW_TABS = [
  { id: 'all', label: 'All Work' },
  { id: 'needs-init', label: 'Needs Initialization' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'requires-review', label: 'Requires Review' },
  { id: 'completed', label: 'Completed' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Queue Statuses' },
  { value: 'Uninitialized', label: 'Uninitialized' },
  { value: 'NotStarted', label: 'Not Started' },
  { value: 'Pending', label: 'Pending' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'RequiresReview', label: 'Requires Review' },
  { value: 'PartiallyCompleted', label: 'Partially Completed' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Failed', label: 'Failed' },
];

const METHOD_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'Unassigned', label: 'Unassigned' },
  { value: 'Manual', label: 'Manual' },
  { value: 'VendorApi', label: 'Vendor API' },
];

const ORDER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Order Statuses' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Processing', label: 'Processing' },
  { value: 'Completed', label: 'Completed' },
  { value: 'SentToVendor', label: 'Sent to Vendor' },
  { value: 'VendorProcessing', label: 'Vendor Processing' },
  { value: 'PartiallyCompleted', label: 'Partially Completed' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'RefundPending', label: 'Refund Pending' },
  { value: 'Refunded', label: 'Refunded' },
];

export function FulfillmentTable({
  fulfillments,
  isLoading,
  error,
  onRetry,
  onViewDetails,
  selectedStatus,
  onStatusChange,
  selectedMethod,
  onMethodChange,
  selectedOrderStatus,
  onOrderStatusChange,
  searchQuery,
  onSearchChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
  onSelectQuickView,
  activeQuickView = 'all',
}: FulfillmentTableProps) {
  const isFiltered =
    selectedStatus !== 'all' ||
    selectedMethod !== 'all' ||
    selectedOrderStatus !== 'all' ||
    Boolean(searchQuery.trim());

  return (
    <div className="space-y-4">
      {/* Table Shell with Toolbar & Quick Tabs */}
      <div className="table-shell">
        <div className="table-toolbar flex-wrap gap-2.5">
          {/* Quick Preset Tabs */}
          <div className="table-tabs overflow-x-auto pb-1 max-w-full" role="tablist" aria-label="Fulfillment Views">
            {QUICK_VIEW_TABS.map((tab) => {
              const isSelected = activeQuickView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`table-tab whitespace-nowrap cursor-pointer ${
                    isSelected ? 'selected' : ''
                  }`}
                  onClick={() => onSelectQuickView?.(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/60 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Read-Only Queue</span>
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="p-3 border-b border-border/50 bg-muted/20 flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              className="w-full h-8 pl-8 pr-8 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search order #, customer, SKU..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search fulfillment work queue"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Queue Status Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="fulfillment-status-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Status:
            </label>
            <select
              id="fulfillment-status-filter"
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              aria-label="Filter by queue status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Method Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="fulfillment-method-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Method:
            </label>
            <select
              id="fulfillment-method-filter"
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedMethod}
              onChange={(e) => onMethodChange(e.target.value)}
              aria-label="Filter by fulfillment method"
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Parent Order Status Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="fulfillment-order-status-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Order:
            </label>
            <select
              id="fulfillment-order-status-filter"
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedOrderStatus}
              onChange={(e) => onOrderStatusChange(e.target.value)}
              aria-label="Filter by parent order status"
            >
              {ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground ml-auto"
              onClick={onClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="p-8 space-y-4" data-testid="fulfillment-loading-skeleton">
            <SkeletonLoader />
            <p className="text-xs text-center text-muted-foreground">
              Retrieving fulfillment work queue from server...
            </p>
          </div>
        )}

        {/* Error Banner */}
        {!isLoading && error && (
          <div
            className="m-4 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-3"
            data-testid="fulfillment-error-banner"
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Failed to load fulfillment work items</span>
            </div>
            <p className="text-xs">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-1.5 text-xs h-8"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && fulfillments.length === 0 && (
          <div className="p-12 text-center space-y-3" data-testid="fulfillment-empty-state">
            <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {isFiltered ? 'No matching fulfillment work found' : 'No Fulfillment Work Recorded'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isFiltered
                  ? 'No order fulfillment records match your current filter and search parameters. Try adjusting your selections.'
                  : 'Actionable and historical fulfillment items across customer orders will appear here.'}
              </p>
            </div>
            {isFiltered && (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Desktop Table View */}
        {!isLoading && !error && fulfillments.length > 0 && (
          <div className="hidden md:block table-scroll">
            <table className="w-full text-left border-collapse" aria-label="Fulfillment Work Queue">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product Snapshot</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4">Queue Status</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-center">Attempts</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {fulfillments.map((item) => {
                  const queueStatusInfo = getFulfillmentQueueStatusBadgeInfo(item.queueStatus);
                  const orderStatusInfo = getParentOrderStatusBadgeInfo(item.orderStatus);
                  const methodInfo = getFulfillmentMethodBadgeInfo(item.fulfillmentMethod);
                  const isUninitialized = !item.isInitialized || item.fulfillmentId === null;

                  return (
                    <tr
                      key={`${item.orderNumber}-${item.orderItemId}`}
                      className="hover:bg-muted/30 transition-colors group"
                      data-testid={`fulfillment-row-${item.orderNumber}-${item.orderItemId}`}
                    >
                      {/* Order Number */}
                      <td className="py-3 px-4 font-mono text-[11px] font-medium text-foreground">
                        <button
                          type="button"
                          className="hover:text-primary transition-colors underline-offset-2 hover:underline cursor-pointer"
                          onClick={() => onViewDetails(item)}
                          title={`View fulfillment details for ${item.orderNumber}`}
                          aria-label={`View details for order ${item.orderNumber}`}
                        >
                          {item.orderNumber}
                        </button>
                        <div className="text-[10px] text-muted-foreground font-sans">
                          Item #{item.orderItemId}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground truncate max-w-[160px]">
                            {item.customerName || item.customerId}
                          </div>
                          {item.customerEmail && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {item.customerEmail}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Product Snapshot */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground truncate max-w-[200px]" title={item.productName}>
                            {item.productName}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]" title={item.productSku}>
                            {item.productSku}
                          </div>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            item.quantityFulfilled >= item.quantityRequested && item.quantityRequested > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-foreground'
                          }`}
                        >
                          {item.quantityFulfilled} / {item.quantityRequested}
                        </span>
                      </td>

                      {/* Queue Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${queueStatusInfo.badgeClass}`}
                          title={queueStatusInfo.description}
                          data-testid="queue-status-badge"
                        >
                          {queueStatusInfo.dotClass && (
                            <span className={`w-1.5 h-1.5 rounded-full ${queueStatusInfo.dotClass}`} />
                          )}
                          {queueStatusInfo.label}
                        </span>
                        {isUninitialized && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            Awaiting Init
                          </div>
                        )}
                      </td>

                      {/* Parent Order Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${orderStatusInfo.badgeClass}`}
                          data-testid="order-status-badge"
                        >
                          {orderStatusInfo.dotClass && (
                            <span className={`w-1.5 h-1.5 rounded-full ${orderStatusInfo.dotClass}`} />
                          )}
                          {orderStatusInfo.label}
                        </span>
                        {item.orderStatus === 'Paid' && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Not in Processing
                          </div>
                        )}
                      </td>

                      {/* Method */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${methodInfo.badgeClass}`}
                        >
                          {methodInfo.label}
                        </span>
                      </td>

                      {/* Attempt Count */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-muted-foreground">
                        {item.attemptCount}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                        {formatFulfillmentDate(item.updatedAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => onViewDetails(item)}
                          title={`Inspect details for ${item.orderNumber}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Cards View */}
        {!isLoading && !error && fulfillments.length > 0 && (
          <div className="md:hidden divide-y divide-border/50">
            {fulfillments.map((item) => {
              const queueStatusInfo = getFulfillmentQueueStatusBadgeInfo(item.queueStatus);
              const orderStatusInfo = getParentOrderStatusBadgeInfo(item.orderStatus);
              const methodInfo = getFulfillmentMethodBadgeInfo(item.fulfillmentMethod);
              const isUninitialized = !item.isInitialized || item.fulfillmentId === null;

              return (
                <div
                  key={`${item.orderNumber}-${item.orderItemId}-mobile`}
                  className="p-4 space-y-3"
                  data-testid={`fulfillment-card-${item.orderNumber}-${item.orderItemId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline cursor-pointer"
                        onClick={() => onViewDetails(item)}
                      >
                        {item.orderNumber}
                      </button>
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        Item #{item.orderItemId}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${queueStatusInfo.badgeClass}`}
                      >
                        {queueStatusInfo.dotClass && (
                          <span className={`w-1 h-1 rounded-full ${queueStatusInfo.dotClass}`} />
                        )}
                        {queueStatusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-medium text-foreground">{item.productName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{item.productSku}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/30">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Customer</span>
                      <span className="font-medium text-foreground truncate block">
                        {item.customerName || item.customerId}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Quantity</span>
                      <span className="font-mono font-semibold text-foreground">
                        {item.quantityFulfilled} / {item.quantityRequested}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${orderStatusInfo.badgeClass}`}
                      >
                        Order: {orderStatusInfo.label}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${methodInfo.badgeClass}`}
                      >
                        {methodInfo.label}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onViewDetails(item)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        {!isLoading && !error && fulfillments.length > 0 && (
          <div className="p-3 border-t border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing{' '}
              <span className="font-medium text-foreground">
                {(page - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-foreground">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-medium text-foreground" data-testid="total-count">{totalCount}</span> items
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <span className="text-xs font-medium px-2 text-foreground">
                Page {page} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
