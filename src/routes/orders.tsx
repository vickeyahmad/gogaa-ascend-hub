import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw, ShoppingCart, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { OrderTable } from '@/components/admin/order-table';
import { OrderDetailDialog } from '@/components/admin/order-detail-dialog';
import {
  getAdminOrders,
  type AdminOrderSummaryDto,
  type AdminOrderQuery,
  type OrderStatus,
  type SalesChannel,
} from '@/lib/orders-api';

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
        content: 'Read-only administrative order inspection in Gogaa Byte Control Center.',
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

        {/* Read-only Security Notice Banner */}
        <div className="p-3.5 rounded-lg border border-border bg-card/60 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Orders and historical payment records are displayed in read-only administrative mode. All product prices reflect locked creation snapshots.
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
        />
      </div>
    </AppShell>
  );
}
