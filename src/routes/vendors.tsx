import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Store,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { VendorTable } from '@/components/admin/vendor-table';
import { VendorFormDialog } from '@/components/admin/vendor-form-dialog';
import { ConfirmVendorStatusDialog } from '@/components/admin/confirm-vendor-status-dialog';
import {
  getAdminVendors,
  getAdminVendorById,
  createAdminVendor,
  updateAdminVendor,
  updateAdminVendorStatus,
  type AdminVendorDto,
  type CreateVendorRequest,
  type UpdateVendorRequest,
} from '@/lib/vendors-api';

export const Route = createFileRoute('/vendors')({
  head: () => ({
    meta: [
      { title: 'Vendors · Gogaa Byte Admin' },
      {
        name: 'description',
        content: 'Manage supplier records and order fulfillment routing status.',
      },
      { property: 'og:title', content: 'Vendors · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Supplier and vendor management in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedVendorsPage,
});

function ProtectedVendorsPage() {
  return (
    <ProtectedRoute>
      <VendorsManagementView />
    </ProtectedRoute>
  );
}

export function VendorsManagementView() {
  const { isAuthenticated } = useAuth();

  const [vendors, setVendors] = useState<AdminVendorDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // In-flight status change tracking per vendor ID
  const [pendingStatusVendorIds, setPendingStatusVendorIds] = useState<number[]>([]);
  // Monotonic fetch counter to discard stale out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters, search, and pagination
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingVendor, setEditingVendor] = useState<AdminVendorDto | null>(null);

  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState<boolean>(false);
  const [statusTargetVendor, setStatusTargetVendor] = useState<AdminVendorDto | null>(null);
  const [statusTargetActive, setStatusTargetActive] = useState<boolean>(false);

  // Global feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  /**
   * Fetches vendors from the backend with server-side filtering and pagination.
   * Monotonic fetch ID prevents stale responses from overwriting newer updates.
   */
  const fetchVendors = useCallback(
    async (isRefresh = false, targetPage = page) => {
      const currentFetchId = ++latestFetchId.current;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query = {
          page: targetPage,
          pageSize,
          search: searchQuery.trim() || undefined,
          isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        };

        const result = await getAdminVendors(query);

        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setVendors(result.items);
        setTotalCount(result.totalCount);
        setTotalPages(Math.max(1, result.totalPages));
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to connect to the supplier service. Please check your backend status.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, pageSize, searchQuery, statusFilter],
  );

  useEffect(() => {
    void fetchVendors(false, page);
  }, [fetchVendors, page]);

  // Auto-dismiss success feedback after 5 seconds
  useEffect(() => {
    if (feedback?.type === 'success') {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Dialog action openers
  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingVendor(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEdit = (vendor: AdminVendorDto) => {
    setFormMode('edit');
    setEditingVendor(vendor);
    setIsFormDialogOpen(true);
  };

  const handleOpenStatusToggle = (vendor: AdminVendorDto) => {
    if (pendingStatusVendorIds.includes(vendor.id)) {
      return;
    }
    setStatusTargetVendor(vendor);
    setStatusTargetActive(!vendor.isActive);
    setIsStatusDialogOpen(true);
  };

  // Filter change handlers
  const handleStatusFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPage(1);
  };

  // Form submission handlers
  const handleCreateSubmit = async (payload: CreateVendorRequest): Promise<AdminVendorDto> => {
    const created = await createAdminVendor(payload);
    setFeedback({
      type: 'success',
      message: `Supplier "${created.internalName}" registered successfully.`,
    });
    // Refresh vendor list starting at page 1
    void fetchVendors(true, 1);
    return created;
  };

  const handleUpdateSubmit = async (
    id: number,
    payload: UpdateVendorRequest,
  ): Promise<AdminVendorDto> => {
    const updated = await updateAdminVendor(id, payload);
    setVendors((prev) => prev.map((v) => (v.id === id ? updated : v)));
    setFeedback({
      type: 'success',
      message: `Supplier "${updated.internalName}" updated successfully.`,
    });
    return updated;
  };

  /**
   * Status change with concurrency guard, authoritative backend synchronization,
   * stale-response prevention, and automatic authoritative rollback on failure.
   */
  const handleConfirmStatus = async (vendor: AdminVendorDto, nextActive: boolean) => {
    if (pendingStatusVendorIds.includes(vendor.id)) {
      return;
    }

    // Invalidate any in-flight background GET fetches so an older response cannot overwrite newer status
    latestFetchId.current++;

    setPendingStatusVendorIds((prev) => [...prev, vendor.id]);
    try {
      const updated = await updateAdminVendorStatus(vendor.id, nextActive);
      // Synchronize with authoritative backend state
      setVendors((prev) => prev.map((v) => (v.id === vendor.id ? updated : v)));
      setFeedback({
        type: 'success',
        message: `Supplier "${updated.internalName}" has been ${updated.isActive ? 'activated' : 'deactivated'}.`,
      });
    } catch (err: unknown) {
      // Re-fetch authoritative vendor record on error
      try {
        const authoritative = await getAdminVendorById(vendor.id);
        setVendors((prev) => prev.map((v) => (v.id === vendor.id ? authoritative : v)));
      } catch {
        // Fallback: keep existing state
      }
      const msg =
        err instanceof Error
          ? err.message
          : `Failed to update status for "${vendor.internalName}". Please try again.`;
      setFeedback({
        type: 'error',
        message: msg,
      });
      throw err;
    } finally {
      setPendingStatusVendorIds((prev) => prev.filter((id) => id !== vendor.id));
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  // Summary counts
  const activeVendorsCount = vendors.filter((v) => v.isActive).length;
  const inactiveVendorsCount = vendors.filter((v) => !v.isActive).length;
  const mappedProductsTotal = vendors.reduce((sum, v) => sum + (v.productMappingCount || 0), 0);

  return (
    <AppShell
      activeItem="Vendors"
      pageTitle="Vendors"
      breadcrumbs={[
        { label: 'Control Center' },
        { label: 'Suppliers' },
        { label: 'Vendors' },
      ]}
      showSearch={false}
    >
      <main className="page-container" data-testid="vendors-page">
        {/* Page Header */}
        <AdminPageHeader
          title="Vendors"
          description="Manage internal supplier records and order fulfillment routing status."
          badge={
            <span className="admin-badge-live" data-testid="live-vendors-badge">
              <span aria-hidden="true" />
              Live Suppliers
            </span>
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchVendors(true, page)}
                disabled={isLoading || isRefreshing}
                title="Refresh suppliers from server"
                aria-label="Refresh suppliers"
                data-testid="refresh-vendors-button"
                className="h-9 gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <Button
                variant="brand"
                size="sm"
                onClick={handleOpenCreate}
                className="h-9 gap-1.5 shadow-sm"
                data-testid="add-vendor-button"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Supplier</span>
              </Button>
            </>
          }
        />

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`mb-4 flex items-center justify-between rounded-lg p-3 text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                : 'bg-destructive/10 border-destructive/25 text-destructive'
            }`}
            role="status"
            data-testid="vendors-feedback-alert"
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0 text-destructive" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground text-xs ml-4"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {/* Live Supplier Metrics Bar */}
        <section
          className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
          aria-label="Vendor summary metrics"
        >
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Total Suppliers</span>
              <Store className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-bold font-display" data-testid="metric-total-vendors">
              {totalCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Active (Current Page)</span>
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div
              className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400"
              data-testid="metric-active-vendors"
            >
              {activeVendorsCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Inactive (Current Page)</span>
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div
              className="text-xl font-bold font-display text-muted-foreground"
              data-testid="metric-inactive-vendors"
            >
              {inactiveVendorsCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Mapped Products</span>
              <Link2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-display" data-testid="metric-mapped-products">
              {mappedProductsTotal}
            </div>
          </div>
        </section>

        {/* Vendor Table & Mobile Cards */}
        <VendorTable
          vendors={vendors}
          isLoading={isLoading}
          error={error}
          pendingStatusVendorIds={pendingStatusVendorIds}
          onRetry={() => void fetchVendors(false, page)}
          onEdit={handleOpenEdit}
          onToggleStatus={handleOpenStatusToggle}
          onAddNew={handleOpenCreate}
          selectedStatusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          searchQuery={searchQuery}
          onSearchQueryChange={handleSearchQueryChange}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={(newPage) => setPage(newPage)}
          onClearFilters={handleClearFilters}
        />

        {/* Create / Edit Modal Dialog */}
        <VendorFormDialog
          isOpen={isFormDialogOpen}
          mode={formMode}
          vendor={editingVendor}
          onClose={() => setIsFormDialogOpen(false)}
          onSubmitCreate={handleCreateSubmit}
          onSubmitUpdate={handleUpdateSubmit}
        />

        {/* Confirmation Dialog for Status Toggling */}
        <ConfirmVendorStatusDialog
          isOpen={isStatusDialogOpen}
          vendor={statusTargetVendor}
          targetActive={statusTargetActive}
          onClose={() => setIsStatusDialogOpen(false)}
          onConfirm={handleConfirmStatus}
        />
      </main>
    </AppShell>
  );
}
