import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw, Workflow, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { FulfillmentTable } from '@/components/admin/fulfillment-table';
import { FulfillmentDetailDialog } from '@/components/admin/fulfillment-detail-dialog';
import { FulfillmentCapabilitiesBanner } from '@/components/admin/fulfillment-capabilities';
import {
  getAdminFulfillments,
  type AdminFulfillmentSummaryDto,
  type AdminFulfillmentQuery,
} from '@/lib/fulfillments-api';

export const Route = createFileRoute('/fulfillment')({
  head: () => ({
    meta: [
      { title: 'Fulfillment Work Queue · Gogaa Byte Admin' },
      {
        name: 'description',
        content:
          'Inspect real-time order fulfillment work across customer orders, uninitialized line items, and delivery audit history.',
      },
      { property: 'og:title', content: 'Fulfillment Work Queue · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Read-only administrative fulfillment work queue in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedFulfillmentPage,
});

function ProtectedFulfillmentPage() {
  return (
    <ProtectedRoute>
      <FulfillmentManagementView />
    </ProtectedRoute>
  );
}

export function FulfillmentManagementView() {
  const { isAuthenticated } = useAuth();

  const [fulfillments, setFulfillments] = useState<AdminFulfillmentSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic fetch counter to discard out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters, search & pagination
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeQuickView, setActiveQuickView] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Detail dialog state
  const [selectedItem, setSelectedItem] = useState<AdminFulfillmentSummaryDto | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Global capabilities refresh counter
  const [capabilitiesRefreshTrigger, setCapabilitiesRefreshTrigger] = useState<number>(0);

  /**
   * Fetches fulfillment work queue with server-side filters and pagination.
   * Monotonic fetch counter guarantees that stale out-of-order responses are discarded.
   */
  const fetchFulfillments = useCallback(
    async (isRefresh = false, targetPage = page) => {
      const currentFetchId = ++latestFetchId.current;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query: AdminFulfillmentQuery = {
          page: targetPage,
          pageSize,
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          fulfillmentMethod: selectedMethod === 'all' ? undefined : selectedMethod,
          orderStatus: selectedOrderStatus === 'all' ? undefined : selectedOrderStatus,
          search: searchQuery.trim() || undefined,
        };

        const result = await getAdminFulfillments(query);

        // Discard stale out-of-order response
        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setFulfillments(result.items || []);
        setTotalCount(result.totalCount || 0);
        setTotalPages(result.totalPages || 1);
        setPage(result.page || targetPage);
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to retrieve fulfillment work queue from backend. Please verify your connection.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, pageSize, selectedStatus, selectedMethod, selectedOrderStatus, searchQuery]
  );

  // Fetch when filters or search change (resetting to page 1)
  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchFulfillments(false, 1);
  }, [isAuthenticated, selectedStatus, selectedMethod, selectedOrderStatus, searchQuery]);

  // Page navigation handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchFulfillments(false, newPage);
  };

  // Status filter change handler
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setActiveQuickView('custom');
    setPage(1);
  };

  // Method filter change handler
  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    setActiveQuickView('custom');
    setPage(1);
  };

  // Order status filter change handler
  const handleOrderStatusChange = (orderStatus: string) => {
    setSelectedOrderStatus(orderStatus);
    setActiveQuickView('custom');
    setPage(1);
  };

  // Search query change handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Quick Preset View handler
  const handleSelectQuickView = (viewId: string) => {
    setActiveQuickView(viewId);
    setPage(1);

    switch (viewId) {
      case 'all':
        setSelectedStatus('all');
        setSelectedOrderStatus('all');
        break;
      case 'needs-init':
        setSelectedStatus('Uninitialized');
        setSelectedOrderStatus('Processing');
        break;
      case 'in-progress':
        setSelectedStatus('InProgress');
        setSelectedOrderStatus('all');
        break;
      case 'requires-review':
        setSelectedStatus('RequiresReview');
        setSelectedOrderStatus('all');
        break;
      case 'completed':
        setSelectedStatus('Completed');
        setSelectedOrderStatus('all');
        break;
      default:
        break;
    }
  };

  // Clear all filters handler
  const handleClearFilters = () => {
    setSelectedStatus('all');
    setSelectedMethod('all');
    setSelectedOrderStatus('all');
    setSearchQuery('');
    setActiveQuickView('all');
    setPage(1);
  };

  // View details handler
  const handleViewDetails = (item: AdminFulfillmentSummaryDto) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  // Close detail modal
  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedItem(null);
  };

  return (
    <AppShell activeItem="Fulfillment" pageTitle="Fulfillment Work Queue" showSearch={false}>
      <div className="page-container space-y-6">
        <AdminPageHeader
          title="Fulfillment Work Queue"
          description="Inspect real-time order fulfillment work across customer orders, uninitialized line items, and delivery audit history."
          badge={
            <span className="admin-badge-live">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Read-Only</span>
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || isRefreshing}
              onClick={() => {
                setCapabilitiesRefreshTrigger((prev) => prev + 1);
                void fetchFulfillments(true, page);
              }}
              className="gap-2"
              title="Refresh fulfillment queue and capabilities"
              aria-label="Refresh fulfillment queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          }
        />

        <FulfillmentCapabilitiesBanner
          refreshTrigger={capabilitiesRefreshTrigger}
        />

        <FulfillmentTable
          fulfillments={fulfillments}
          isLoading={isLoading}
          error={error}
          onRetry={() => void fetchFulfillments(false, page)}
          onViewDetails={handleViewDetails}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          selectedMethod={selectedMethod}
          onMethodChange={handleMethodChange}
          selectedOrderStatus={selectedOrderStatus}
          onOrderStatusChange={handleOrderStatusChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onClearFilters={handleClearFilters}
          onSelectQuickView={handleSelectQuickView}
          activeQuickView={activeQuickView}
        />

        <FulfillmentDetailDialog
          orderNumber={selectedItem?.orderNumber ?? null}
          summaryItem={selectedItem}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
        />
      </div>
    </AppShell>
  );
}
