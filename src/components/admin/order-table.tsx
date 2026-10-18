import {
  Search,
  X,
  Eye,
  Inbox,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  CreditCard,
  Calendar,
  Filter,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import {
  formatOrderPrice,
  formatOrderDate,
  getOrderStatusBadgeInfo,
  getPaymentStatusBadgeInfo,
  getSalesChannelBadgeInfo,
  type AdminOrderSummaryDto,
} from '@/lib/orders-api';

export interface OrderTableProps {
  orders: AdminOrderSummaryDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewDetail: (orderNumber: string) => void;
  onStartProcessing?: (order: AdminOrderSummaryDto) => void;
  processingOrderNumbers?: string[];
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedSalesChannel: string;
  onSalesChannelChange: (channel: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  productSkuQuery: string;
  onProductSkuQueryChange: (sku: string) => void;
  fromDate: string;
  onFromDateChange: (date: string) => void;
  toDate: string;
  onToDateChange: (date: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

const PRIMARY_STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'PendingPayment', label: 'Awaiting Payment' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Processing', label: 'Processing' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

const ALL_ORDER_STATUSES = [
  { id: 'all', label: 'All Statuses' },
  { id: 'PendingPayment', label: 'Pending Payment' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Processing', label: 'Processing' },
  { id: 'SentToVendor', label: 'Sent to Vendor' },
  { id: 'VendorProcessing', label: 'Vendor Processing' },
  { id: 'Completed', label: 'Completed' },
  { id: 'PartiallyCompleted', label: 'Partially Completed' },
  { id: 'Failed', label: 'Failed' },
  { id: 'Cancelled', label: 'Cancelled' },
  { id: 'RefundPending', label: 'Refund Pending' },
  { id: 'Refunded', label: 'Refunded' },
];

const SALES_CHANNELS = [
  { id: 'all', label: 'All Channels' },
  { id: 'Website', label: 'Web Storefront' },
  { id: 'Telegram', label: 'Telegram Bot' },
  { id: 'Smm', label: 'SMM Panel' },
  { id: 'Admin', label: 'Admin Manual' },
];

export function OrderTable({
  orders,
  isLoading,
  error,
  onRetry,
  onViewDetail,
  onStartProcessing,
  processingOrderNumbers = [],
  selectedStatus,
  onStatusChange,
  selectedSalesChannel,
  onSalesChannelChange,
  searchQuery,
  onSearchQueryChange,
  productSkuQuery,
  onProductSkuQueryChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
}: OrderTableProps) {
  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  const hasActiveFilters =
    selectedStatus !== 'all' ||
    selectedSalesChannel !== 'all' ||
    Boolean(searchQuery.trim()) ||
    Boolean(productSkuQuery.trim()) ||
    Boolean(fromDate) ||
    Boolean(toDate);

  return (
    <div className="table-shell" data-testid="orders-table-container">
      {/* Primary Toolbar: Status Tabs & Quick Filter Controls */}
      <div className="table-toolbar flex-wrap gap-3">
        {/* Status Tabs */}
        <div className="tab-list flex-wrap gap-1" role="tablist" aria-label="Filter orders by status">
          {PRIMARY_STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                className={`table-tab ${isActive ? 'active' : ''}`}
                onClick={() => onStatusChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Detailed Status Select (for all 11 backend statuses) */}
          <select
            className="filter-select text-xs h-9 px-2 rounded-md border border-border bg-card text-foreground"
            value={selectedStatus}
            aria-label="Filter by detailed status"
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {ALL_ORDER_STATUSES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>

          {/* Sales Channel Filter */}
          <select
            className="filter-select text-xs h-9 px-2 rounded-md border border-border bg-card text-foreground"
            value={selectedSalesChannel}
            aria-label="Filter by sales channel"
            onChange={(e) => onSalesChannelChange(e.target.value)}
          >
            {SALES_CHANNELS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.label}
              </option>
            ))}
          </select>

          {/* Search by Order # or Customer */}
          <div className="search-wrap relative flex-1 min-w-[200px] max-w-sm">
            <Search className="search-icon w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              className="search-input w-full pl-9 pr-8 text-xs h-9 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search Order # or Customer..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              aria-label="Search orders by order number or customer"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear order search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Product SKU filter */}
          <div className="search-wrap relative w-36">
            <input
              type="text"
              className="search-input w-full px-2.5 text-xs h-9 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="SKU Snapshot..."
              value={productSkuQuery}
              onChange={(e) => onProductSkuQueryChange(e.target.value)}
              aria-label="Filter by product SKU"
            />
            {productSkuQuery && (
              <button
                type="button"
                onClick={() => onProductSkuQueryChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear SKU filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-[11px]">From:</span>
              <input
                type="date"
                className="h-9 px-2 text-xs rounded-md border border-border bg-card text-foreground"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                aria-label="Filter orders from date"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-[11px]">To:</span>
              <input
                type="date"
                className="h-9 px-2 text-xs rounded-md border border-border bg-card text-foreground"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                aria-label="Filter orders to date"
              />
            </div>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Error State Banner */}
      {error && !isLoading && (
        <div
          className="m-4 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between gap-4"
          data-testid="orders-error-banner"
        >
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-xs h-7 px-3 shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="table-skeleton p-6" data-testid="orders-loading-skeleton">
          <SkeletonLoader />
        </div>
      )}

      {/* Empty States */}
      {!isLoading && !error && orders.length === 0 && (
        <div
          className="p-12 text-center flex flex-col items-center justify-center space-y-3"
          data-testid="orders-empty-state"
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              {hasActiveFilters ? 'No matching orders found' : 'No orders in system'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {hasActiveFilters
                ? 'Try broadening your search term, clearing date filters, or selecting a different status.'
                : 'Customer orders placed across web storefront, Telegram bot, and other channels will appear here.'}
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="mt-2 text-xs"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* Desktop Table View */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="order-table-desktop overflow-x-auto">
          <table className="admin-table w-full text-xs" data-testid="orders-desktop-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4 text-left">Order #</th>
                <th className="py-3 px-4 text-left">Customer</th>
                <th className="py-3 px-4 text-left">Channel</th>
                <th className="py-3 px-4 text-left">Items</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-left">Payment</th>
                <th className="py-3 px-4 text-left">Placed</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => {
                const statusBadge = getOrderStatusBadgeInfo(order.status);
                const channelBadge = getSalesChannelBadgeInfo(order.salesChannel);
                const paymentBadge = order.paymentSummary
                  ? getPaymentStatusBadgeInfo(order.paymentSummary.paymentStatus)
                  : null;

                return (
                  <tr
                    key={order.orderNumber}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`order-row-${order.orderNumber}`}
                  >
                    {/* Order Number */}
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      <button
                        type="button"
                        onClick={() => onViewDetail(order.orderNumber)}
                        className="text-primary hover:underline text-left"
                        title="Inspect Order Details"
                      >
                        {order.orderNumber}
                      </button>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
                        {order.customerName || 'Guest / Not Specified'}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {order.customerEmail || '—'}
                      </div>
                    </td>

                    {/* Sales Channel */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${channelBadge.badgeClass}`}
                      >
                        {channelBadge.label}
                      </span>
                    </td>

                    {/* Items & Summary */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-foreground truncate" title={order.productSummary}>
                        {order.productSummary}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      {formatOrderPrice(order.totalAmount, order.currency)}
                    </td>

                    {/* Order Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                        {statusBadge.label}
                      </span>
                    </td>

                    {/* Payment Summary */}
                    <td className="py-3 px-4">
                      {order.paymentSummary && paymentBadge ? (
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${paymentBadge.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${paymentBadge.dotClass}`} />
                            {paymentBadge.label}
                          </span>
                          {order.paymentSummary.paymentMethod && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {order.paymentSummary.paymentMethod}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Unpaid
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {formatOrderDate(order.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onStartProcessing && order.status === 'Paid' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => onStartProcessing(order)}
                            disabled={processingOrderNumbers.includes(order.orderNumber)}
                            className="gap-1 text-xs h-7 px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                            title={`Start processing for ${order.orderNumber}`}
                            aria-label={`Start processing for ${order.orderNumber}`}
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            {processingOrderNumbers.includes(order.orderNumber) ? 'Processing...' : 'Start Processing'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetail(order.orderNumber)}
                          className="gap-1.5 text-xs h-7 px-2.5"
                          title={`View details for ${order.orderNumber}`}
                          aria-label={`View details for ${order.orderNumber}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards Grid */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="order-cards-grid" data-testid="orders-mobile-cards">
          {orders.map((order) => {
            const statusBadge = getOrderStatusBadgeInfo(order.status);
            const channelBadge = getSalesChannelBadgeInfo(order.salesChannel);
            const paymentBadge = order.paymentSummary
              ? getPaymentStatusBadgeInfo(order.paymentSummary.paymentStatus)
              : null;

            return (
              <div
                key={order.orderNumber}
                className="order-card"
                data-testid={`mobile-order-card-${order.orderNumber}`}
              >
                <div className="order-card-header">
                  <div>
                    <div className="order-card-title font-mono text-primary">
                      {order.orderNumber}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatOrderDate(order.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                    {statusBadge.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-semibold text-foreground">
                      {order.customerName || order.customerEmail || 'Guest'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Channel:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${channelBadge.badgeClass}`}>
                      {channelBadge.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span className="text-foreground text-right truncate max-w-[200px]">
                      {order.productSummary} ({order.itemCount})
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-border">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {formatOrderPrice(order.totalAmount, order.currency)}
                    </span>
                  </div>
                  {order.paymentSummary && paymentBadge && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-muted-foreground">Payment:</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${paymentBadge.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${paymentBadge.dotClass}`} />
                        {paymentBadge.label} ({order.paymentSummary.paymentMethod || 'Wallet'})
                      </span>
                    </div>
                  )}
                </div>

                <div className="order-card-actions flex items-center gap-2">
                  {onStartProcessing && order.status === 'Paid' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onStartProcessing(order)}
                      disabled={processingOrderNumbers.includes(order.orderNumber)}
                      className="flex-1 gap-1.5 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      {processingOrderNumbers.includes(order.orderNumber) ? 'Processing...' : 'Start Processing'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetail(order.orderNumber)}
                    className={`${onStartProcessing && order.status === 'Paid' ? 'flex-1' : 'w-full'} gap-1.5 text-xs h-8`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {!isLoading && !error && totalCount > 0 && (
        <div className="table-pagination p-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div data-testid="orders-pagination-info">
            Showing <span className="font-semibold text-foreground">{startRecord}</span> to{' '}
            <span className="font-semibold text-foreground">{endRecord}</span> of{' '}
            <span className="font-semibold text-foreground">{totalCount}</span> orders
          </div>

          <div className="flex items-center gap-2">
            <span className="mr-2">
              Page <span className="font-semibold text-foreground">{page}</span> of{' '}
              <span className="font-semibold text-foreground">{Math.max(totalPages, 1)}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-8 px-2.5 text-xs gap-1"
              aria-label="Previous orders page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-8 px-2.5 text-xs gap-1"
              aria-label="Next orders page"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
