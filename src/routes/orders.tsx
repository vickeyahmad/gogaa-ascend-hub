import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw, ShoppingCart, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { OrderTable } from '@/components/admin/order-table';
import { OrderDetailDialog } from '@/components/admin/order-detail-dialog';
import { StartProcessingDialog } from '@/components/admin/start-processing-dialog';
import {
  getAdminOrders,
  startOrderProcessing,
  type AdminOrderSummaryDto,
  type AdminOrderDetailDto,
  type AdminOrderQuery,
  type OrderStatus,
  type SalesChannel,
} from '@/lib/orders-api';
import { ApiClientError } from '@/lib/api-client';

export const Route = createFileRoute('/orders')({
  head: () => ({
    meta: [
      { title: 'Orders Management · Gogaa Byte Admin' },
      {
        name: 'description',
        content:
          'Inspect real customer orders across all sales channels with historical price snapshots and verified payment records.',
      },
      { property: 'og:title', content: 'Orders Management · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Controlled administrative order inspection and processing in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedOrdersPage,
});

function ProtectedOrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersManagementView />
    </ProtectedRoute>
  );
}

export function OrdersManagementView() {
  const { isAuthenticated } = useAuth();

  const [orders, setOrders] = useState<AdminOrderSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic fetch counter to discard out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters, search, and pagination
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSalesChannel, setSelectedSalesChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [productSkuQuery, setProductSkuQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Order Detail dialog state
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Start Processing dialog state
  const [processingTargetOrder, setProcessingTargetOrder] = useState<
    AdminOrderSummaryDto | AdminOrderDetailDto | null
  >(null);
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState<boolean>(false);
  const [isProcessingSubmitting, setIsProcessingSubmitting] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingAmbiguousFailure, setProcessingAmbiguousFailure] = useState<boolean>(false);
  const [processingOrderNumbers, setProcessingOrderNumbers] = useState<string[]>([]);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  /**
   * Fetches customer orders with server-side filters and pagination.
   * Monotonic fetch counter protects against stale responses overwriting newer state.
   */
  const fetchOrders = useCallback(
    async (isRefresh = false, targetPage = page) => {
      const currentFetchId = ++latestFetchId.current;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query: AdminOrderQuery = {
          page: targetPage,
          pageSize,
          status: selectedStatus === 'all' ? undefined : (selectedStatus as OrderStatus),
          salesChannel:
            selectedSalesChannel === 'all'
              ? undefined
              : (selectedSalesChannel as SalesChannel),
          customerQuery: searchQuery.trim() || undefined,
          productSku: productSkuQuery.trim() || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        };

        const result = await getAdminOrders(query);

        // If a newer fetch was started while this one was in flight, ignore this response
        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setOrders(result.items || []);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setPage(result.page);
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while fetching orders.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [
      page,
      pageSize,
      selectedStatus,
      selectedSalesChannel,
      searchQuery,
      productSkuQuery,
      fromDate,
      toDate,
    ]
  );

  // Initial load and whenever filters or page change
  useEffect(() => {
    if (isAuthenticated) {
      void fetchOrders(false, page);
    }
  }, [isAuthenticated, fetchOrders, page]);

  // Filter change handlers that reset to page 1
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const handleSalesChannelChange = (channel: string) => {
    setSelectedSalesChannel(channel);
    setPage(1);
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleProductSkuQueryChange = (sku: string) => {
    setProductSkuQuery(sku);
    setPage(1);
  };

  const handleFromDateChange = (date: string) => {
    setFromDate(date);
    setPage(1);
  };

  const handleToDateChange = (date: string) => {
    setToDate(date);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedStatus('all');
    setSelectedSalesChannel('all');
    setSearchQuery('');
    setProductSkuQuery('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleOpenDetail = (orderNumber: string) => {
    setSelectedOrderNumber(orderNumber);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedOrderNumber(null);
  };

  const handleOpenStartProcessing = (
    order: AdminOrderSummaryDto | AdminOrderDetailDto
  ) => {
    setProcessingTargetOrder(order);
    setProcessingError(null);
    setProcessingAmbiguousFailure(false);
    setIsProcessingDialogOpen(true);
  };

  const handleCloseStartProcessing = () => {
    if (!isProcessingSubmitting) {
      setIsProcessingDialogOpen(false);
      setProcessingTargetOrder(null);
      setProcessingError(null);
      setProcessingAmbiguousFailure(false);
    }
  };

  const handleConfirmStartProcessing = async (reason?: string) => {
    if (!processingTargetOrder || isProcessingSubmitting) return;

    const targetOrderNumber = processingTargetOrder.orderNumber;
    setIsProcessingSubmitting(true);
    setProcessingError(null);
    setProcessingAmbiguousFailure(false);
    setProcessingOrderNumbers((prev) =>
      prev.includes(targetOrderNumber) ? prev : [...prev, targetOrderNumber]
    );

    try {
      const updatedOrder = await startOrderProcessing(targetOrderNumber, { reason });

      // Synchronize in-memory order summary status strictly from the confirmed backend response
      setOrders((prev) =>
        prev.map((o) =>
          o.orderNumber === targetOrderNumber
            ? { ...o, status: updatedOrder.status as OrderStatus }
            : o
        )
      );

      setSuccessFeedback(
        `Order ${targetOrderNumber} has been transitioned to Processing successfully.`
      );
      setIsProcessingDialogOpen(false);
      setProcessingTargetOrder(null);

      // If details dialog is open for this order, close it so it reloads fresh on next open
      if (selectedOrderNumber === targetOrderNumber) {
        setIsDetailOpen(false);
        setSelectedOrderNumber(null);
      }

      // Authoritative refresh of current page from server
      await fetchOrders(true, page);
    } catch (err: unknown) {
      const isNetworkError =
        (err instanceof ApiClientError && err.status === 0) ||
        (err instanceof TypeError &&
          err.message.toLowerCase().includes('failed to fetch')) ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetworkError) {
        setProcessingAmbiguousFailure(true);
        setProcessingError(
          'Network connection interrupted during order processing request. The backend may or may not have committed the transition. Do not re-send. Please inspect or refresh order status.'
        );
      } else {
        setProcessingAmbiguousFailure(false);
        setProcessingError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while starting order processing.'
        );
      }
    } finally {
      setIsProcessingSubmitting(false);
      setProcessingOrderNumbers((prev) =>
        prev.filter((num) => num !== targetOrderNumber)
      );
    }
  };

  return (
    <AppShell activeItem="Orders" pageTitle="Orders Management">
      <div className="page-container space-y-6">
        {/* Header with Title, Description, and Refresh Action */}
        <AdminPageHeader
          title="Orders Management"
          description="Inspect centralized customer orders across Web Storefront, Telegram Bot, and external channels with historical price snapshots and payment audits."
          badge={
            <span className="admin-badge-live">
              <span aria-hidden="true" />
              Live Orders
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || isRefreshing}
              onClick={() => void fetchOrders(true, page)}
              className="gap-2 text-xs"
              aria-label="Refresh orders"
              data-testid="refresh-orders-button"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          }
        />

        {/* Success Feedback Alert */}
        {successFeedback && (
          <div
            className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 text-sm shadow-sm animate-in fade-in"
            role="status"
            data-testid="order-processing-success-banner"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-medium">{successFeedback}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessFeedback(null)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss success notice"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Security Notice Banner */}
        <div className="p-3.5 rounded-lg border border-border bg-card/60 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Orders and historical payment records reflect locked creation snapshots. Only verified Paid orders can be transitioned to Processing.
            </span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
            {totalCount} total {totalCount === 1 ? 'order' : 'orders'}
          </span>
        </div>

        {/* Orders Table & Filters */}
        <OrderTable
          orders={orders}
          isLoading={isLoading}
          error={error}
          onRetry={() => void fetchOrders(false, page)}
          onViewDetail={handleOpenDetail}
          onStartProcessing={handleOpenStartProcessing}
          processingOrderNumbers={processingOrderNumbers}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          selectedSalesChannel={selectedSalesChannel}
          onSalesChannelChange={handleSalesChannelChange}
          searchQuery={searchQuery}
          onSearchQueryChange={handleSearchQueryChange}
          productSkuQuery={productSkuQuery}
          onProductSkuQueryChange={handleProductSkuQueryChange}
          fromDate={fromDate}
          onFromDateChange={handleFromDateChange}
          toDate={toDate}
          onToDateChange={handleToDateChange}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={(newPage) => setPage(newPage)}
          onClearFilters={handleClearFilters}
        />

        {/* Order Detail Modal */}
        <OrderDetailDialog
          orderNumber={selectedOrderNumber}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          onStartProcessing={handleOpenStartProcessing}
          isProcessingInFlight={
            selectedOrderNumber
              ? processingOrderNumbers.includes(selectedOrderNumber)
              : false
          }
        />

        {/* Start Order Processing Confirmation Modal */}
        <StartProcessingDialog
          isOpen={isProcessingDialogOpen}
          orderNumber={processingTargetOrder?.orderNumber ?? null}
          orderTotal={processingTargetOrder?.totalAmount ?? 0}
          currency={processingTargetOrder?.currency ?? 'PKR'}
          customerName={processingTargetOrder?.customerName ?? null}
          customerEmail={processingTargetOrder?.customerEmail ?? null}
          currentStatus={processingTargetOrder?.status ?? 'Paid'}
          isSubmitting={isProcessingSubmitting}
          error={processingError}
          isAmbiguousFailure={processingAmbiguousFailure}
          onConfirm={handleConfirmStartProcessing}
          onClose={handleCloseStartProcessing}
        />
      </div>
    </AppShell>
  );
}
