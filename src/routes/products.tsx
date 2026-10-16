import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Package,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ProductTable } from '@/components/admin/product-table';
import { ProductFormDialog } from '@/components/admin/product-form-dialog';
import { ConfirmProductStatusDialog } from '@/components/admin/confirm-product-status-dialog';
import {
  getAdminProducts,
  getAdminProductById,
  createAdminProduct,
  updateAdminProduct,
  updateAdminProductStatus,
  type AdminProductDto,
  type CreateProductRequest,
  type UpdateProductRequest,
} from '@/lib/products-api';
import { getAdminCategories, type AdminCategoryDto } from '@/lib/categories-api';

export const Route = createFileRoute('/products')({
  head: () => ({
    meta: [
      { title: 'Products · Gogaa Byte Admin' },
      {
        name: 'description',
        content: 'Manage product catalog, selling prices, and customer availability.',
      },
      { property: 'og:title', content: 'Products · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Product management in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedProductsPage,
});

function ProtectedProductsPage() {
  return (
    <ProtectedRoute>
      <ProductsManagementView />
    </ProtectedRoute>
  );
}

export function ProductsManagementView() {
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState<AdminProductDto[]>([]);
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // In-flight status change tracking per product ID
  const [pendingStatusProductIds, setPendingStatusProductIds] = useState<number[]>([]);
  // Monotonic fetch counter to discard stale out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters, search, and pagination
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryIdFilter, setCategoryIdFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProduct, setEditingProduct] = useState<AdminProductDto | null>(null);

  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState<boolean>(false);
  const [statusTargetProduct, setStatusTargetProduct] = useState<AdminProductDto | null>(null);
  const [statusTargetActive, setStatusTargetActive] = useState<boolean>(false);

  // Global feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  /**
   * Fetches categories from the backend for dropdowns and filters.
   */
  const fetchCategoriesList = useCallback(async () => {
    try {
      const cats = await getAdminCategories();
      setCategories(cats);
    } catch {
      // Category fetch failure is non-fatal; falls back to empty categories list
    }
  }, []);

  /**
   * Fetches products from the backend with server-side filtering and pagination.
   * Monotonic fetch ID prevents stale responses from overwriting newer updates.
   */
  const fetchProducts = useCallback(
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
          categoryId: categoryIdFilter === 'all' ? undefined : categoryIdFilter,
          isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        };

        const result = await getAdminProducts(query);

        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setProducts(result.items);
        setTotalCount(result.totalCount);
        setTotalPages(Math.max(1, result.totalPages));
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to connect to the catalog service. Please check your backend status.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, pageSize, searchQuery, categoryIdFilter, statusFilter],
  );

  useEffect(() => {
    void fetchCategoriesList();
  }, [fetchCategoriesList]);

  useEffect(() => {
    void fetchProducts(false, page);
  }, [fetchProducts, page]);

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
    setEditingProduct(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEdit = (product: AdminProductDto) => {
    setFormMode('edit');
    setEditingProduct(product);
    setIsFormDialogOpen(true);
  };

  const handleOpenStatusToggle = (product: AdminProductDto) => {
    if (pendingStatusProductIds.includes(product.id)) {
      return;
    }
    setStatusTargetProduct(product);
    setStatusTargetActive(!product.isActive);
    setIsStatusDialogOpen(true);
  };

  // Filter change handlers
  const handleStatusFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleCategoryFilterChange = (catId: number | 'all') => {
    setCategoryIdFilter(catId);
    setPage(1);
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryIdFilter('all');
    setPage(1);
  };

  // Form submission handlers
  const handleCreateSubmit = async (payload: CreateProductRequest): Promise<AdminProductDto> => {
    const created = await createAdminProduct(payload);
    setFeedback({
      type: 'success',
      message: `Product "${created.name}" created successfully.`,
    });
    // Refresh product list and categories
    void fetchProducts(true, 1);
    void fetchCategoriesList();
    return created;
  };

  const handleUpdateSubmit = async (
    id: number,
    payload: UpdateProductRequest,
  ): Promise<AdminProductDto> => {
    const updated = await updateAdminProduct(id, payload);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    setFeedback({
      type: 'success',
      message: `Product "${updated.name}" updated successfully.`,
    });
    return updated;
  };

  /**
   * Status change with concurrency guard, authoritative backend synchronization,
   * stale-response prevention, and automatic authoritative rollback on failure.
   */
  const handleConfirmStatus = async (product: AdminProductDto, nextActive: boolean) => {
    if (pendingStatusProductIds.includes(product.id)) {
      return;
    }

    // Invalidate any in-flight background GET fetches so an older response cannot overwrite newer status
    latestFetchId.current++;

    setPendingStatusProductIds((prev) => [...prev, product.id]);
    try {
      const updated = await updateAdminProductStatus(product.id, nextActive);
      // Synchronize with authoritative backend state
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      setFeedback({
        type: 'success',
        message: `Product "${updated.name}" has been ${updated.isActive ? 'activated' : 'deactivated'}.`,
      });
    } catch (err: unknown) {
      // Re-fetch authoritative product record on error
      try {
        const authoritative = await getAdminProductById(product.id);
        setProducts((prev) => prev.map((p) => (p.id === product.id ? authoritative : p)));
      } catch {
        // Fallback: keep existing state
      }
      const msg =
        err instanceof Error
          ? err.message
          : `Failed to update status for "${product.name}". Please try again.`;
      setFeedback({
        type: 'error',
        message: msg,
      });
      throw err;
    } finally {
      setPendingStatusProductIds((prev) => prev.filter((id) => id !== product.id));
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  // Summary counts
  const activeProductsCount = products.filter((p) => p.isActive).length;
  const inactiveProductsCount = products.filter((p) => !p.isActive).length;

  return (
    <AppShell
      activeItem="Products"
      pageTitle="Products"
      breadcrumbs={[
        { label: 'Control Center' },
        { label: 'Catalog' },
        { label: 'Products' },
      ]}
      showSearch={false}
    >
      <main className="page-container" data-testid="products-page">
        {/* Page Header */}
        <AdminPageHeader
          title="Products"
          description="Manage catalog products, customer selling prices, and availability status."
          badge={
            <span className="admin-badge-live" data-testid="live-products-badge">
              <span aria-hidden="true" />
              Live Catalog
            </span>
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchProducts(true, page)}
                disabled={isLoading || isRefreshing}
                title="Refresh products from server"
                aria-label="Refresh products"
                data-testid="refresh-products-button"
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
                data-testid="add-product-button"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Product</span>
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
            data-testid="products-feedback-alert"
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

        {/* Live Catalog Metrics Bar */}
        <section
          className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
          aria-label="Product catalog summary metrics"
        >
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Total Products</span>
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-bold font-display" data-testid="metric-total-products">
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
              data-testid="metric-active-products"
            >
              {activeProductsCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Inactive (Current Page)</span>
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div
              className="text-xl font-bold font-display text-muted-foreground"
              data-testid="metric-inactive-products"
            >
              {inactiveProductsCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Categories</span>
              <FolderOpen className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-display" data-testid="metric-categories-count">
              {categories.length}
            </div>
          </div>
        </section>

        {/* Product Table & Mobile Cards */}
        <ProductTable
          products={products}
          categories={categories}
          isLoading={isLoading}
          error={error}
          pendingStatusProductIds={pendingStatusProductIds}
          onRetry={() => void fetchProducts(false, page)}
          onEdit={handleOpenEdit}
          onToggleStatus={handleOpenStatusToggle}
          onAddNew={handleOpenCreate}
          selectedStatusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          selectedCategoryId={categoryIdFilter}
          onCategoryFilterChange={handleCategoryFilterChange}
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
        <ProductFormDialog
          isOpen={isFormDialogOpen}
          mode={formMode}
          product={editingProduct}
          categories={categories}
          onClose={() => setIsFormDialogOpen(false)}
          onSubmitCreate={handleCreateSubmit}
          onSubmitUpdate={handleUpdateSubmit}
        />

        {/* Confirmation Dialog for Status Toggling */}
        <ConfirmProductStatusDialog
          isOpen={isStatusDialogOpen}
          product={statusTargetProduct}
          targetActive={statusTargetActive}
          onClose={() => setIsStatusDialogOpen(false)}
          onConfirm={handleConfirmStatus}
        />
      </main>
    </AppShell>
  );
}
