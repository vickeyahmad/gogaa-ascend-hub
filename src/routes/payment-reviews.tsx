import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw, CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ManualPaymentTable } from '@/components/admin/manual-payment-table';
import { ManualPaymentDetailDialog } from '@/components/admin/manual-payment-detail-dialog';
import {
  getAdminManualPayments,
  type AdminManualPaymentDto,
  type AdminManualPaymentQuery,
  type PaymentStatus,
} from '@/lib/manual-payments-api';

export const Route = createFileRoute('/payment-reviews')({
  head: () => ({
    meta: [
      { title: 'Payment Reviews · Gogaa Byte Admin' },
      {
        name: 'description',
        content:
          'Inspect real customer manual wallet top-up payments, bank transfer proofs, and verification history.',
      },
      { property: 'og:title', content: 'Payment Reviews · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Read-only manual top-up payment review interface in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedPaymentReviewsPage,
});

function ProtectedPaymentReviewsPage() {
  return (
    <ProtectedRoute>
      <PaymentReviewsManagementView />
    </ProtectedRoute>
  );
}

export function PaymentReviewsManagementView() {
  const { isAuthenticated } = useAuth();

  const [payments, setPayments] = useState<AdminManualPaymentDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic fetch counter to discard out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters & pagination
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Detail dialog state
  const [selectedPaymentNumber, setSelectedPaymentNumber] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  /**
   * Fetches manual payments with server-side status filter and pagination.
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
        const query: AdminManualPaymentQuery = {
          page: targetPage,
          pageSize,
          status: selectedStatus === 'all' ? undefined : (selectedStatus as PaymentStatus),
        };

        const result = await getAdminManualPayments(query);

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
            : 'Failed to retrieve payment records. Please verify connection and retry.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, pageSize, selectedStatus]
  );

  // Load payments on mount and when filter changes
  useEffect(() => {
    if (isAuthenticated) {
      void fetchPayments(false, page);
    }
  }, [isAuthenticated, fetchPayments, page]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1); // Reset to page 1 on filter change
  };

  const handleClearFilters = () => {
    setSelectedStatus('all');
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleViewDetail = (paymentNumber: string) => {
    setSelectedPaymentNumber(paymentNumber);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedPaymentNumber(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppShell
      activeItem="Payment Reviews"
      pageTitle="Payment Reviews"
      breadcrumbs={[
        { label: 'Control Center' },
        { label: 'Operations' },
        { label: 'Payment Reviews' },
      ]}
      showSearch={false}
    >
      <main className="page-container" data-testid="payment-reviews-page">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">
                Payment Reviews
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Manual Top-Ups</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Inspect customer PKR wallet top-up payment attempts, bank transfer references, and audit history. Strictly read-only verification.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs cursor-pointer hover:bg-muted"
              disabled={isLoading || isRefreshing}
              onClick={() => void fetchPayments(true, page)}
              aria-label="Refresh payment reviews"
              data-testid="refresh-payments-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="mb-5 p-3 rounded-lg border border-border bg-card flex items-start gap-3 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground">Authoritative Financial Audit</span>
            <p className="leading-relaxed">
              Records are retrieved directly from the central ASP.NET Core backend. Status filtering and pagination are executed server-side. Global customer and transaction reference search will be added in a future backend milestone.
            </p>
          </div>
        </div>

        {/* Payments Table */}
        <ManualPaymentTable
          payments={payments}
          isLoading={isLoading}
          error={error}
          onRetry={() => void fetchPayments(false, page)}
          onViewDetail={handleViewDetail}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onClearFilters={handleClearFilters}
        />

        {/* Read-Only Details Dialog */}
        <ManualPaymentDetailDialog
          paymentNumber={selectedPaymentNumber}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
        />
      </main>
    </AppShell>
  );
}
