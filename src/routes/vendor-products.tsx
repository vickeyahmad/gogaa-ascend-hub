import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Link2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { VendorProductTable } from '@/components/admin/vendor-product-table';
import { VendorProductFormDialog } from '@/components/admin/vendor-product-form-dialog';
import { ConfirmVendorProductAvailabilityDialog } from '@/components/admin/confirm-vendor-product-availability-dialog';
import {
  getAdminVendorProducts,
  getAdminVendorProductById,
  createAdminVendorProduct,
  updateAdminVendorProduct,
  updateAdminVendorProductAvailability,
  type AdminVendorProductDto,
  type CreateVendorProductRequest,
  type UpdateVendorProductRequest,
} from '@/lib/vendor-products-api';
import { getAdminVendors, type AdminVendorDto } from '@/lib/vendors-api';

export const Route = createFileRoute('/vendor-products')({
  head: () => ({
    meta: [
      { title: 'Product Mappings · Gogaa Byte Admin' },
      {
        name: 'description',
        content: 'Manage internal product mappings to external suppliers, wholesale costs, and routing priority.',
      },
      { property: 'og:title', content: 'Product Mappings · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Vendor product mapping management in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedVendorProductsPage,
});

function ProtectedVendorProductsPage() {
  return (
    <ProtectedRoute>
      <VendorProductsManagementView />
    </ProtectedRoute>
  );
}

export function VendorProductsManagementView() {
  const { isAuthenticated } = useAuth();

  const [mappings, setMappings] = useState<AdminVendorProductDto[]>([]);
  const [vendors, setVendors] = useState<AdminVendorDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // In-flight status change tracking per mapping ID
  const [pendingAvailabilityIds, setPendingAvailabilityIds] = useState<number[]>([]);
  // Monotonic fetch counter to discard stale out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters, search, and pagination
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [selectedVendorId, setSelectedVendorId] = useState<number | 'all'>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingMapping, setEditingMapping] = useState<AdminVendorProductDto | null>(null);

  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState<boolean>(false);
  const [availabilityTargetMapping, setAvailabilityTargetMapping] = useState<AdminVendorProductDto | null>(null);
  const [availabilityTargetStatus, setAvailabilityTargetStatus] = useState<boolean>(false);

  // Global feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  /**
   * Fetches vendor product mappings with server-side filtering and pagination.
   * Uses monotonic fetch counter to ignore responses that return out of order.
   */
  const fetchMappings = useCallback(
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
          vendorId: selectedVendorId === 'all' ? undefined : selectedVendorId,
          isAvailable:
            availabilityFilter === 'all'
              ? undefined
              : availabilityFilter === 'available',
          currency: selectedCurrency === 'all' ? undefined : selectedCurrency,
          productSku: searchQuery.trim() || undefined,
          page: targetPage,
          pageSize,
        };

        const result = await getAdminVendorProducts(query);

        // Discard response if a newer fetch was started
        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setMappings(result.items);
        setTotalCount(result.totalCount);
        setTotalPages(Math.max(1, result.totalPages));
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to load vendor product mappings. Please check your connection.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [availabilityFilter, selectedVendorId, selectedCurrency, searchQuery, page, pageSize],
  );

  /**
   * Loads vendor list for the filter dropdown.
   */
  const loadFilterVendors = useCallback(async () => {
    try {
      const result = await getAdminVendors({ pageSize: 100 });
      setVendors(result.items);
    } catch {
      // Non-critical, filter dropdown will just be empty
    }
  }, []);

  useEffect(() => {
    void loadFilterVendors();
  }, [loadFilterVendors]);

  // Fetch mappings whenever authentication or dependencies (including page) change
  useEffect(() => {
    if (isAuthenticated) {
      void fetchMappings(false, page);
    }
  }, [isAuthenticated, fetchMappings, page]);

  // Handle refresh action
  const handleRefresh = async () => {
    setFeedback(null);
    await fetchMappings(true, page);
    await loadFilterVendors();
  };

  // Open create dialog
  const handleAddNew = () => {
    setFeedback(null);
    setFormMode('create');
    setEditingMapping(null);
    setIsFormDialogOpen(true);
  };

  // Open edit dialog
  const handleEdit = async (mapping: AdminVendorProductDto) => {
    setFeedback(null);
    try {
      // Fetch fresh data from backend
      const fresh = await getAdminVendorProductById(mapping.id);
      setEditingMapping(fresh);
    } catch {
      // Fallback to table row data
      setEditingMapping(mapping);
    }
    setFormMode('edit');
    setIsFormDialogOpen(true);
  };

  // Open availability confirmation dialog
  const handleToggleAvailability = (mapping: AdminVendorProductDto) => {
    setFeedback(null);
    setAvailabilityTargetMapping(mapping);
    setAvailabilityTargetStatus(!mapping.isAvailable);
    setIsAvailabilityDialogOpen(true);
  };

  // Confirm availability status change
  const handleConfirmAvailability = async (mapping: AdminVendorProductDto, nextAvailable: boolean) => {
    setPendingAvailabilityIds((prev) => [...prev, mapping.id]);

    try {
      const updated = await updateAdminVendorProductAvailability(mapping.id, {
        isAvailable: nextAvailable,
      });

      // Update local state immediately
      setMappings((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );

      setFeedback({
        type: 'success',
        message: `Mapping #${mapping.id} (${mapping.productSku} ↔ ${mapping.vendorName}) is now ${
          nextAvailable ? 'available' : 'unavailable'
        }.`,
      });

      // Trigger authoritative refresh in background
      void fetchMappings(false, page);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update mapping availability. Please try again.';
      setFeedback({ type: 'error', message: msg });
      throw err;
    } finally {
      setPendingAvailabilityIds((prev) => prev.filter((id) => id !== mapping.id));
    }
  };

  // Form submit success callback
  const handleFormSuccess = (saved: AdminVendorProductDto, mode: 'create' | 'edit') => {
    setFeedback({
      type: 'success',
      message:
        mode === 'create'
          ? `Created mapping #${saved.id} (${saved.productSku} ↔ ${saved.vendorName}) successfully.`
          : `Updated mapping #${saved.id} (${saved.productSku} ↔ ${saved.vendorName}) successfully.`,
    });

    // Authoritative refresh
    void fetchMappings(false, mode === 'create' ? 1 : page);
  };

  // Reset all filters
  const handleClearFilters = () => {
    setAvailabilityFilter('all');
    setSelectedVendorId('all');
    setSelectedCurrency('all');
    setSearchQuery('');
    setPage(1);
  };

  return (
    <AppShell
      activeItem="Product Mappings"
      pageTitle="Product Mappings"
      showSearch={false}
      breadcrumbs={[
        { label: 'Control Center', href: '/' },
        { label: 'Suppliers' },
        { label: 'Product Mappings' },
      ]}
    >
      <div className="page-container space-y-6" data-testid="vendor-products-management-page">
        {/* Page Header */}
        <AdminPageHeader
          title="Product Mappings"
          description="Link internal products to external supplier catalog IDs, manage wholesale costs, currencies, and routing priority."
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Live Suppliers
            </span>
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="text-xs h-9"
                data-testid="refresh-vendor-products-button"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              <Button
                onClick={handleAddNew}
                size="sm"
                className="text-xs h-9"
                data-testid="add-vendor-product-button"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Mapping
              </Button>
            </>
          }
        />

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`rounded-lg p-3 text-xs flex items-center justify-between border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                : 'bg-destructive/10 border-destructive/25 text-destructive'
            }`}
            role="status"
            data-testid="vendor-products-feedback-banner"
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground text-xs ml-4"
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Table Component */}
        <VendorProductTable
          mappings={mappings}
          vendors={vendors}
          isLoading={isLoading}
          error={error}
          pendingAvailabilityIds={pendingAvailabilityIds}
          onRetry={() => void fetchMappings(false, page)}
          onEdit={handleEdit}
          onToggleAvailability={handleToggleAvailability}
          onAddNew={handleAddNew}
          selectedAvailabilityFilter={availabilityFilter}
          onAvailabilityFilterChange={(filter) => {
            setAvailabilityFilter(filter);
            setPage(1);
          }}
          selectedVendorId={selectedVendorId}
          onVendorFilterChange={(vId) => {
            setSelectedVendorId(vId);
            setPage(1);
          }}
          selectedCurrency={selectedCurrency}
          onCurrencyFilterChange={(cur) => {
            setSelectedCurrency(cur);
            setPage(1);
          }}
          searchQuery={searchQuery}
          onSearchQueryChange={(q) => {
            setSearchQuery(q);
            setPage(1);
          }}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p)}
          onClearFilters={handleClearFilters}
        />

        {/* Form Dialog (Create / Edit) */}
        <VendorProductFormDialog
          isOpen={isFormDialogOpen}
          mode={formMode}
          mapping={editingMapping}
          onClose={() => setIsFormDialogOpen(false)}
          onSubmitCreate={createAdminVendorProduct}
          onSubmitUpdate={updateAdminVendorProduct}
          onSuccess={handleFormSuccess}
        />

        {/* Availability Confirmation Dialog */}
        <ConfirmVendorProductAvailabilityDialog
          mapping={availabilityTargetMapping}
          targetAvailable={availabilityTargetStatus}
          isOpen={isAvailabilityDialogOpen}
          onClose={() => setIsAvailabilityDialogOpen(false)}
          onConfirm={handleConfirmAvailability}
        />
      </div>
    </AppShell>
  );
}
