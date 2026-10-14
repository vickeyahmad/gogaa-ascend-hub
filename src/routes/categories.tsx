import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  FolderOpen,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CategoryTable } from '@/components/admin/category-table';
import { CategoryFormDialog } from '@/components/admin/category-form-dialog';
import { ConfirmStatusDialog } from '@/components/admin/confirm-status-dialog';
import {
  getAdminCategories,
  getAdminCategoryById,
  createAdminCategory,
  updateAdminCategory,
  updateAdminCategoryStatus,
  type AdminCategoryDto,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@/lib/categories-api';

export const Route = createFileRoute('/categories')({
  head: () => ({
    meta: [
      { title: 'Categories · Gogaa Byte Admin' },
      {
        name: 'description',
        content: 'Manage digital product categories, URL slugs, and marketplace visibility.',
      },
      { property: 'og:title', content: 'Categories · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Product category management in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedCategoriesPage,
});

function ProtectedCategoriesPage() {
  return (
    <ProtectedRoute>
      <CategoriesManagementView />
    </ProtectedRoute>
  );
}

export function CategoriesManagementView() {
  const { isAuthenticated, isLoggingOut } = useAuth();

  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // In-flight status change tracking per category ID
  const [pendingStatusCategoryIds, setPendingStatusCategoryIds] = useState<number[]>([]);
  // Monotonic fetch counter to prevent stale GET responses from overwriting newer updates
  const latestFetchId = useRef(0);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<AdminCategoryDto | null>(null);

  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState<boolean>(false);
  const [statusTargetCategory, setStatusTargetCategory] = useState<AdminCategoryDto | null>(null);
  const [statusTargetActive, setStatusTargetActive] = useState<boolean>(false);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  /**
   * Fetches real categories from the ASP.NET Core backend.
   * Uses monotonic fetch ID to discard stale out-of-order GET responses.
   */
  const fetchCategories = useCallback(async (isRefresh = false) => {
    const currentFetchId = ++latestFetchId.current;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await getAdminCategories();
      // Discard stale GET response if a newer fetch was initiated
      if (currentFetchId !== latestFetchId.current) {
        return;
      }
      setCategories(data);
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
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

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
    setEditingCategory(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEdit = (category: AdminCategoryDto) => {
    setFormMode('edit');
    setEditingCategory(category);
    setIsFormDialogOpen(true);
  };

  const handleOpenStatusToggle = (category: AdminCategoryDto) => {
    if (pendingStatusCategoryIds.includes(category.id)) {
      return;
    }
    setStatusTargetCategory(category);
    setStatusTargetActive(!category.isActive);
    setIsStatusDialogOpen(true);
  };

  // Form submission handlers
  const handleCreateSubmit = async (payload: CreateCategoryRequest): Promise<AdminCategoryDto> => {
    const created = await createAdminCategory(payload);
    setCategories((prev) => [created, ...prev]);
    setFeedback({
      type: 'success',
      message: `Category "${created.name}" created successfully.`,
    });
    return created;
  };

  const handleUpdateSubmit = async (
    id: number,
    payload: UpdateCategoryRequest,
  ): Promise<AdminCategoryDto> => {
    const updated = await updateAdminCategory(id, payload);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setFeedback({
      type: 'success',
      message: `Category "${updated.name}" updated successfully.`,
    });
    return updated;
  };

  /**
   * Status change with concurrency guard, authoritative backend synchronization,
   * stale-response prevention, and automatic authoritative rollback on failure.
   */
  const handleConfirmStatus = async (category: AdminCategoryDto, nextActive: boolean) => {
    if (pendingStatusCategoryIds.includes(category.id)) {
      return;
    }

    // Invalidate any in-flight background GET fetches so an older response cannot overwrite newer status
    latestFetchId.current++;

    setPendingStatusCategoryIds((prev) => [...prev, category.id]);
    try {
      const updated = await updateAdminCategoryStatus(category.id, nextActive);
      // Synchronize with authoritative backend state
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
      setFeedback({
        type: 'success',
        message: `Category "${updated.name}" has been ${updated.isActive ? 'activated' : 'deactivated'}.`,
      });
    } catch (err: unknown) {
      // Re-fetch authoritative category record on error
      try {
        const authoritative = await getAdminCategoryById(category.id);
        setCategories((prev) => prev.map((c) => (c.id === category.id ? authoritative : c)));
      } catch {
        // Fallback: keep existing state
      }
      const msg =
        err instanceof Error
          ? err.message
          : `Failed to update status for "${category.name}". Please try again.`;
      setFeedback({
        type: 'error',
        message: msg,
      });
      throw err;
    } finally {
      setPendingStatusCategoryIds((prev) => prev.filter((id) => id !== category.id));
    }
  };

  // Immediately render nothing if unauthenticated
  if (!isAuthenticated) {
    return null;
  }

  // Aggregate stats
  const totalCategories = categories.length;
  const activeCount = categories.filter((c) => c.isActive).length;
  const inactiveCount = categories.filter((c) => !c.isActive).length;
  const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

  return (
    <AppShell
      activeItem="Categories"
      pageTitle="Categories"
      breadcrumbs={[
        { label: 'Control Center' },
        { label: 'Catalog' },
        { label: 'Categories' },
      ]}
      showSearch={false}
    >
      <main className="page-container" data-testid="categories-page">
        {/* Page Header */}
        <AdminPageHeader
          title="Categories"
          description="Manage product catalog categories, URL slugs, and marketplace customer visibility."
          badge={
            <span className="admin-badge-live" data-testid="live-catalog-badge">
              <span aria-hidden="true" />
              Live Catalog
            </span>
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchCategories(true)}
                disabled={isLoading || isRefreshing}
                title="Refresh categories from server"
                aria-label="Refresh categories"
                data-testid="refresh-categories-button"
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
                data-testid="add-category-button"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Category</span>
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
            data-testid="categories-feedback-alert"
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
          aria-label="Catalog summary metrics"
        >
          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Total Categories</span>
              <FolderOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="text-xl font-bold font-display" data-testid="metric-total-categories">
              {totalCategories}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Active Categories</span>
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400" data-testid="metric-active-categories">
              {activeCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Inactive Categories</span>
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xl font-bold font-display text-muted-foreground" data-testid="metric-inactive-categories">
              {inactiveCount}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-medium">Linked Products</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-display" data-testid="metric-linked-products">
              {totalProducts}
            </div>
          </div>
        </section>

        {/* Categories Data Table & Mobile Cards */}
        <CategoryTable
          categories={categories}
          isLoading={isLoading}
          error={error}
          pendingStatusCategoryIds={pendingStatusCategoryIds}
          onRetry={() => void fetchCategories()}
          onEdit={handleOpenEdit}
          onToggleStatus={handleOpenStatusToggle}
          onAddNew={handleOpenCreate}
          selectedStatusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        {/* Create / Edit Modal Dialog */}
        <CategoryFormDialog
          isOpen={isFormDialogOpen}
          mode={formMode}
          category={editingCategory}
          onClose={() => setIsFormDialogOpen(false)}
          onSubmitCreate={handleCreateSubmit}
          onSubmitUpdate={handleUpdateSubmit}
        />

        {/* Confirmation Dialog for Status Toggling */}
        <ConfirmStatusDialog
          isOpen={isStatusDialogOpen}
          category={statusTargetCategory}
          targetActive={statusTargetActive}
          onClose={() => setIsStatusDialogOpen(false)}
          onConfirm={handleConfirmStatus}
        />
      </main>
    </AppShell>
  );
}
