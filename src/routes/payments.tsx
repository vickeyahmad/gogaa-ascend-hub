import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw, CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { PaymentTable } from '@/components/admin/payment-table';
import { PaymentDetailDialog } from '@/components/admin/payment-detail-dialog';
import {
  getAdminPayments,
  type AdminPaymentSummaryDto,
  type AdminPaymentQuery,
  type PaymentStatus,
  type PaymentPurpose,
} from '@/lib/payments-api';

export const Route = createFileRoute('/payments')({
  head: () => ({
    meta: [
      { title: 'Payments Overview · Gogaa Byte Admin' },
      {
        name: 'description',
        content:
          'Inspect real customer payments across order purchases and wallet top-ups with complete audit histories.',
      },
      { property: 'og:title', content: 'Payments Overview · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Read-only administrative payments overview in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedPaymentsPage,
});

function ProtectedPaymentsPage() {
  return (
    <ProtectedRoute>
      <PaymentsManagementView />
    </ProtectedRoute>
  );
}

export function PaymentsManagementView() {
  const { isAuthenticated } = useAuth();

  const [payments, setPayments] = useState<AdminPaymentSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic fetch counter to discard out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters, search & pagination
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Detail dialog state
  const [selectedPaymentNumber, setSelectedPaymentNumber] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  /**
   * Fetches customer payments with server-side filters and pagination.
   * Monotonic fetch counter guarantees that stale out-of-order responses are discarded.
   */
  const fetchPayments = useCallback(
    async (isRefresh = false, targetPage = page) => {
      const currentFetchId = ++latestFetchId.current;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query: AdminPaymentQuery = {
          page: targetPage,
          pageSize,
          status: selectedStatus === 'all' ? undefined : (selectedStatus as PaymentStatus),
          purpose: selectedPurpose === 'all' ? undefined : (selectedPurpose as PaymentPurpose),
          paymentMethod: selectedPaymentMethod === 'all' ? undefined : selectedPaymentMethod,
          search: searchQuery.trim() || undefined,
        };

        const result = await getAdminPayments(query);

        // Discard stale out-of-order response
        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setPayments(result.items || []);
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
            : 'Failed to retrieve payments from backend. Please verify your connection.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, pageSize, selectedStatus, selectedPurpose, selectedPaymentMethod, searchQuery]
  );

  // Fetch when filters or search change (resetting to page 1)
  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchPayments(false, 1);
  }, [isAuthenticated, selectedStatus, selectedPurpose, selectedPaymentMethod, searchQuery]);

  // Page navigation handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchPayments(false, newPage);
  };

  // Status tab change handler
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  // Purpose change handler
  const handlePurposeChange = (purpose: string) => {
    setSelectedPurpose(purpose);
    setPage(1);
  };

  // Payment method change handler
  const handlePaymentMethodChange = (method: string) => {
    setSelectedPaymentMethod(method);
    setPage(1);
  };

  // Search query change handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Clear all filters handler
  const handleClearFilters = () => {
    setSelectedStatus('all');
    setSelectedPurpose('all');
    setSelectedPaymentMethod('all');
    setSearchQuery('');
    setPage(1);
  };

  // View detail modal opener
  const handleViewDetail = (paymentNumber: string) => {
    setSelectedPaymentNumber(paymentNumber);
    setIsDetailOpen(true);
  };

  // Close detail modal
  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedPaymentNumber(null);
  };

  return (
    <AppShell activeItem="Payments" pageTitle="Payments Overview" showSearch={false}>
      <div className="page-container space-y-6">
        <AdminPageHeader
          title="Payments Overview"
          description="Inspect real customer payments across order purchases and wallet top-ups with complete audit histories."
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
              onClick={() => void fetchPayments(true, page)}
              className="gap-2"
              title="Refresh payments"
              aria-label="Refresh payments"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          }
        />

        <PaymentTable
          payments={payments}
          isLoading={isLoading}
          error={error}
          onRetry={() => void fetchPayments(false, page)}
          onViewDetail={handleViewDetail}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          selectedPurpose={selectedPurpose}
          onPurposeChange={handlePurposeChange}
          selectedPaymentMethod={selectedPaymentMethod}
          onPaymentMethodChange={handlePaymentMethodChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onClearFilters={handleClearFilters}
        />

        <PaymentDetailDialog
          paymentNumber={selectedPaymentNumber}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
        />
      </div>
    </AppShell>
  );
}
