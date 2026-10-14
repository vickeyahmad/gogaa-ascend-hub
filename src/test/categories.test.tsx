import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { CategoriesManagementView } from '../routes/categories';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type { AdminCategoryDto } from '../lib/categories-api';

// Mock TanStack Router
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  createFileRoute: () => () => ({
    component: () => null,
  }),
}));

const mockAdminUser = {
  id: 'admin-001',
  email: 'admin@gogaabyte.com',
  fullName: 'Gogaa Admin',
  roles: ['Admin'],
};

const sampleCategories: AdminCategoryDto[] = [
  {
    id: 1,
    name: 'AI Writing & Tools',
    slug: 'ai-writing-tools',
    description: 'Generative AI content tools and utilities.',
    isActive: true,
    productCount: 12,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-14T15:30:00Z',
  },
  {
    id: 2,
    name: 'Developer Subscriptions',
    slug: 'developer-subscriptions',
    description: 'Cloud hosting and developer platform accounts.',
    isActive: true,
    productCount: 5,
    createdAt: '2026-10-11T12:00:00Z',
    updatedAt: '2026-10-13T09:00:00Z',
  },
  {
    id: 3,
    name: 'Legacy Softwares',
    slug: 'legacy-softwares',
    description: 'Archived tools no longer sold.',
    isActive: false,
    productCount: 0,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-05T11:00:00Z',
  },
];

function setupAdminFetch(categories: AdminCategoryDto[] = sampleCategories) {
  setInMemoryCsrfToken('test-csrf-token-abc');

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init?.method || 'GET').toUpperCase();

    // 1. Session verification GET /api/admin/auth/me
    if (url.includes('/api/admin/auth/me')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Active administrator profile.',
            data: mockAdminUser,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    // 2. GET categories
    if (url.includes('/api/admin/categories') && method === 'GET') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Categories retrieved successfully.',
            data: categories,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ success: false, message: 'Not found', data: null }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

describe('Categories Management UI Integration', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Route Protection and Authentication', () => {
    it('redirects unauthenticated visitors to /login when accessing protected categories route', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, message: 'Unauthenticated session', data: null }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const utils = render(
        <AuthProvider>
          <ProtectedRoute>
            <CategoriesManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
      });

      expect(utils.queryByTestId('categories-page')).toBeNull();
    });

    it('rejects customers without Admin role and redirects to /login', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Customer profile',
            data: { id: 'cust-1', email: 'cust@test.com', roles: ['Customer'] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const utils = render(
        <AuthProvider>
          <ProtectedRoute>
            <CategoriesManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
      });

      expect(utils.queryByTestId('categories-page')).toBeNull();
    });
  });

  describe('2. Fetching and Displaying Real Category Data', () => {
    it('loads and displays categories from backend with summary metrics', async () => {
      setupAdminFetch();

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
        expect(utils.getAllByText('Developer Subscriptions').length).toBeGreaterThan(0);
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
      });

      // Verify URL slugs
      expect(utils.getAllByText('/ai-writing-tools').length).toBeGreaterThan(0);
      expect(utils.getAllByText('/developer-subscriptions').length).toBeGreaterThan(0);
      expect(utils.getAllByText('/legacy-softwares').length).toBeGreaterThan(0);

      // Verify summary metrics
      expect(utils.getByTestId('metric-total-categories').textContent).toBe('3');
      expect(utils.getByTestId('metric-active-categories').textContent).toBe('2');
      expect(utils.getByTestId('metric-inactive-categories').textContent).toBe('1');
      expect(utils.getByTestId('metric-linked-products').textContent).toBe('17');

      // Verify live badge
      expect(utils.getByTestId('live-catalog-badge')).toBeInTheDocument();
    });
  });

  describe('3. Loading and Empty States', () => {
    it('displays loading skeleton while categories are being fetched', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin ok', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return new Promise(() => {});
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getByTestId('table-loading-skeleton')).toBeInTheDocument();
      });
    });

    it('displays empty catalog state when database contains zero categories', async () => {
      setupAdminFetch([]);

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getByTestId('categories-empty-catalog-state')).toBeInTheDocument();
        expect(utils.getByText('No categories yet')).toBeInTheDocument();
      });

      expect(utils.getByTestId('empty-add-category-button')).toBeInTheDocument();
    });

    it('displays empty filter state when search query matches nothing', async () => {
      setupAdminFetch();

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      const searchInput = utils.getByTestId('categories-search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });

      await waitFor(() => {
        const noMatch = utils.queryByTestId('categories-no-match-state');
        if (!noMatch) {
          console.error('TABLE SHELL HTML:', utils.container.querySelector('.table-shell')?.innerHTML);
        }
        expect(noMatch).not.toBeNull();
      });

      const clearBtn = utils.getByTestId('clear-search-button');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });
    });
  });

  describe('4. Server Error and Retry', () => {
    it('displays server error state when retrieval fails and allows retry', async () => {
      let failCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin ok', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories')) {
          if (failCount === 0) {
            failCount++;
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  success: false,
                  message: 'Database connection failed.',
                  data: null,
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
              ),
            );
          }

          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Recovered',
                data: sampleCategories,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.reject(new Error('Unknown'));
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getByTestId('categories-error-state')).toBeInTheDocument();
        expect(utils.getByText('Database connection failed.')).toBeInTheDocument();
      });

      // Click Retry
      fireEvent.click(utils.getByTestId('retry-fetch-button'));

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });
    });
  });

  describe('5. Create Category Flow & Validation', () => {
    it('validates required fields client-side before submission', async () => {
      setupAdminFetch();

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      fireEvent.click(utils.getByTestId('add-category-button'));

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="category-name-input"]')).not.toBeNull();
      });

      // Submit empty form
      const submitBtn = document.body.querySelector('[data-testid="category-submit-button"]')!;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(document.body.textContent).toContain('Category name is required.');
      });

      // Invalid slug
      const slugInput = document.body.querySelector('[data-testid="category-slug-input"]')!;
      fireEvent.change(slugInput, { target: { value: 'INVALID SLUG' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(document.body.textContent).toContain('lowercase alphanumeric words');
      });

      // Cleanly dismiss modal
      fireEvent.click(utils.getByText('Cancel'));
      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="category-name-input"]')).toBeNull();
      });
    });

    it('auto-suggests slug from name and submits valid creation', async () => {
      setupAdminFetch();

      const newCat: AdminCategoryDto = {
        id: 99,
        name: 'Productivity Utilities',
        slug: 'productivity-utilities',
        description: 'Useful productivity software',
        isActive: true,
        productCount: 0,
        createdAt: '2026-10-15T00:00:00Z',
        updatedAt: '2026-10-15T00:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Category created successfully.',
                data: newCat,
              }),
              { status: 201, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: sampleCategories }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      fireEvent.click(utils.getByTestId('add-category-button'));

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="category-name-input"]')).not.toBeNull();
      });

      const nameInput = document.body.querySelector<HTMLInputElement>('[data-testid="category-name-input"]')!;
      const slugInput = document.body.querySelector<HTMLInputElement>('[data-testid="category-slug-input"]')!;
      const descInput = document.body.querySelector<HTMLInputElement>('[data-testid="category-description-input"]')!;
      const submitBtn = document.body.querySelector('[data-testid="category-submit-button"]')!;

      fireEvent.change(nameInput, { target: { value: 'Productivity Utilities' } });

      // Auto-suggested slug
      expect(slugInput.value).toBe('productivity-utilities');

      fireEvent.change(descInput, { target: { value: 'Useful productivity software' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(utils.getAllByText('Productivity Utilities').length).toBeGreaterThan(0);
        expect(utils.getAllByText('/productivity-utilities').length).toBeGreaterThan(0);
        expect(utils.getByTestId('categories-feedback-alert')).toBeInTheDocument();
      });
    });

    it('handles backend 409 Conflict (duplicate slug) and presents clear error', async () => {
      setupAdminFetch();

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                message: "A category with slug 'ai-writing-tools' already exists.",
                data: null,
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: sampleCategories }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      fireEvent.click(utils.getByTestId('add-category-button'));

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="category-name-input"]')).not.toBeNull();
      });

      const nameInput = document.body.querySelector('[data-testid="category-name-input"]')!;
      const slugInput = document.body.querySelector('[data-testid="category-slug-input"]')!;
      const submitBtn = document.body.querySelector('[data-testid="category-submit-button"]')!;

      fireEvent.change(nameInput, { target: { value: 'Duplicate Category' } });
      fireEvent.change(slugInput, { target: { value: 'ai-writing-tools' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="category-form-server-error"]')).not.toBeNull();
        expect(document.body.textContent).toContain("A category with slug 'ai-writing-tools' already exists.");
      });

      // Cleanly dismiss modal
      fireEvent.click(utils.getByText('Cancel'));
      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="category-name-input"]')).toBeNull();
      });
    });
  });

  describe('6. Edit Category Flow', () => {
    it('populates fields and sends PUT request to update category', async () => {
      setupAdminFetch();

      const updatedCategory: AdminCategoryDto = {
        id: 2,
        name: 'Developer Platforms & Tools',
        slug: 'dev-platforms-tools',
        description: 'Updated platforms description',
        isActive: true,
        productCount: 5,
        createdAt: '2026-10-11T12:00:00Z',
        updatedAt: '2026-10-15T02:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories/2') && method === 'PUT') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Category updated successfully.',
                data: updatedCategory,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: sampleCategories }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('Developer Subscriptions').length).toBeGreaterThan(0);
      });

      // Click Edit
      fireEvent.click(utils.getByTestId('edit-category-2'));

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="category-name-input"]')).not.toBeNull();
      });

      const nameInput = document.body.querySelector<HTMLInputElement>('[data-testid="category-name-input"]')!;
      const slugInput = document.body.querySelector<HTMLInputElement>('[data-testid="category-slug-input"]')!;
      const submitBtn = document.body.querySelector('[data-testid="category-submit-button"]')!;

      expect(nameInput.value).toBe('Developer Subscriptions');

      fireEvent.change(nameInput, { target: { value: 'Developer Platforms & Tools' } });
      fireEvent.change(slugInput, { target: { value: 'dev-platforms-tools' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(utils.getAllByText('Developer Platforms & Tools').length).toBeGreaterThan(0);
        expect(utils.getAllByText('/dev-platforms-tools').length).toBeGreaterThan(0);
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/categories/2',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('7. Status Toggling & Deletion Safety', () => {
    it('shows safety warning when deactivating category with linked products', async () => {
      setupAdminFetch();

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      fireEvent.click(utils.getByTestId('toggle-status-1'));

      await waitFor(() => {
        expect(document.body.textContent).toContain('Deactivate Category');
        expect(document.body.textContent).toContain('Contains 12 linked products');
        expect(document.body.textContent).toContain('Disabling this category automatically hides all its products');
      });

      // Close dialog cleanly
      const cancelBtn = utils.getByText('Cancel');
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(document.body.textContent).not.toContain('Deactivate Category');
      });
    });

    it('toggles category status via PATCH /api/admin/categories/:id/status', async () => {
      setupAdminFetch();

      const updatedCategory: AdminCategoryDto = {
        ...sampleCategories[2],
        isActive: true,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories/3/status') && method === 'PATCH') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Category status updated to active.',
                data: updatedCategory,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: sampleCategories }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
      });

      const activateBtn = utils.getByTestId('toggle-status-3');
      expect(activateBtn.textContent).toContain('Activate');
      fireEvent.click(activateBtn);

      await waitFor(() => {
        expect(document.body.textContent).toContain('Activate Category');
      });

      const confirmBtn = document.body.querySelector('[data-testid="confirm-status-button"]')!;
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(utils.getByTestId('categories-feedback-alert')).toBeInTheDocument();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/categories/3/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isActive: true }),
        }),
      );
    });

    it('confirms that NO working Delete button exists in the interface', async () => {
      setupAdminFetch();

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      const deleteButtons = utils.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons).toHaveLength(0);
      expect(utils.queryByText(/delete category/i)).toBeNull();
    });
  });

  describe('8. Filtering and Search', () => {
    it('filters categories by status tabs (Active, Inactive, All)', async () => {
      setupAdminFetch();

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      // Active tab
      fireEvent.click(utils.getByTestId('filter-tab-active'));

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
        expect(utils.getAllByText('Developer Subscriptions').length).toBeGreaterThan(0);
        expect(utils.queryAllByText('Legacy Softwares').length).toBe(0);
      });

      // Inactive tab
      fireEvent.click(utils.getByTestId('filter-tab-inactive'));

      await waitFor(() => {
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
        expect(utils.queryAllByText('AI Writing & Tools').length).toBe(0);
        expect(utils.queryAllByText('Developer Subscriptions').length).toBe(0);
      });

      // All tab
      fireEvent.click(utils.getByTestId('filter-tab-all'));

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
      });
    });

    it('filters categories by keyword search', async () => {
      setupAdminFetch();

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('AI Writing & Tools').length).toBeGreaterThan(0);
      });

      const searchInput = utils.getByTestId('categories-search-input') as HTMLInputElement;
      fireEvent.input(searchInput, { target: { value: 'Developer' } });
      fireEvent.change(searchInput, { target: { value: 'Developer' } });

      await waitFor(() => {
        expect(utils.getAllByText('Developer Subscriptions').length).toBeGreaterThan(0);
        expect(utils.queryAllByText('AI Writing & Tools').length).toBe(0);
        expect(utils.queryAllByText('Legacy Softwares').length).toBe(0);
      });
    });
  });

  describe('9. Status Concurrency & Inconsistency Safeguards (Issue 2 Regression)', () => {
    it('disables category toggle buttons across desktop and mobile while update is in flight and shows spinner', async () => {
      setInMemoryCsrfToken('test-csrf-token-abc');

      let resolvePatch: (res: any) => void = () => {};
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });

      let patchCallCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Categories', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories/3/status') && method === 'PATCH') {
          patchCallCount++;
          return patchPromise.then(() =>
            new Response(
              JSON.stringify({
                success: true,
                message: 'Activated',
                data: { ...sampleCategories[2], isActive: true },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
      });

      const desktopBtn = utils.getByTestId('toggle-status-3');
      const mobileBtn = utils.getByTestId('mobile-toggle-3');

      // Open dialog
      fireEvent.click(desktopBtn);

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="confirm-status-button"]')).not.toBeNull();
      });

      // Confirm status toggle
      const confirmBtn = document.body.querySelector('[data-testid="confirm-status-button"]')!;
      fireEvent.click(confirmBtn);

      // Verify that while PATCH is in flight, desktop and mobile buttons are disabled with aria-busy
      await waitFor(() => {
        expect(desktopBtn).toBeDisabled();
        expect(desktopBtn.getAttribute('aria-busy')).toBe('true');
        expect(desktopBtn.textContent).toContain('Updating...');

        expect(mobileBtn).toBeDisabled();
        expect(mobileBtn.getAttribute('aria-busy')).toBe('true');
        expect(mobileBtn.textContent).toContain('Updating...');
      });

      // Verify duplicate clicks on the disabled buttons are ignored
      fireEvent.click(desktopBtn);
      fireEvent.click(mobileBtn);
      expect(patchCallCount).toBe(1);

      // Resolve PATCH
      resolvePatch(null);

      // After resolution, buttons re-enable with updated state
      await waitFor(() => {
        expect(desktopBtn).not.toBeDisabled();
        expect(desktopBtn.textContent).toContain('Deactivate');
        expect(mobileBtn).not.toBeDisabled();
        expect(mobileBtn.textContent).toContain('Deactivate');
      });
    });

    it('prevents concurrent double-click on status confirmation dialog submit button', async () => {
      setInMemoryCsrfToken('test-csrf-token-abc');

      let resolvePatch: (res: any) => void = () => {};
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });

      let patchCallCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Categories', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories/3/status') && method === 'PATCH') {
          patchCallCount++;
          return patchPromise.then(() =>
            new Response(
              JSON.stringify({
                success: true,
                message: 'Activated',
                data: { ...sampleCategories[2], isActive: true },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
      });

      fireEvent.click(utils.getByTestId('toggle-status-3'));

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="confirm-status-button"]')).not.toBeNull();
      });

      const confirmBtn = document.body.querySelector('[data-testid="confirm-status-button"]')!;

      // Click rapidly twice
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);

      // Only 1 PATCH call sent
      await waitFor(() => {
        expect(patchCallCount).toBe(1);
      });

      resolvePatch(null);

      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="confirm-status-button"]')).toBeNull();
      });
    });

    it('discards stale GET responses so an out-of-order GET response cannot overwrite a newer confirmed status', async () => {
      setInMemoryCsrfToken('test-csrf-token-abc');

      let resolveSlowGet: (res: any) => void = () => {};
      const slowGetPromise = new Promise((resolve) => {
        resolveSlowGet = resolve;
      });

      let getCallCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories') && method === 'GET') {
          getCallCount++;
          if (getCallCount === 1) {
            // Initial mount GET resolves immediately with sampleCategories (where #3 isActive: false)
            return Promise.resolve(
              new Response(
                JSON.stringify({ success: true, message: 'Categories', data: sampleCategories }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
              ),
            );
          }
          // Second GET (e.g. from Refresh button) is delayed with older stale data
          return slowGetPromise.then(() =>
            new Response(
              JSON.stringify({ success: true, message: 'Stale Categories', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories/3/status') && method === 'PATCH') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Activated',
                data: { ...sampleCategories[2], isActive: true },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
      });

      // Trigger a refresh (slow GET starts in background)
      fireEvent.click(utils.getByTestId('refresh-categories-button'));
      expect(getCallCount).toBe(2);

      // Now toggle category 3 to Active
      fireEvent.click(utils.getByTestId('toggle-status-3'));
      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="confirm-status-button"]')).not.toBeNull();
      });
      fireEvent.click(document.body.querySelector('[data-testid="confirm-status-button"]')!);

      // Category 3 is now updated to Active in UI
      await waitFor(() => {
        expect(utils.getByTestId('toggle-status-3').textContent).toContain('Deactivate');
      });

      // Now the slow background GET finally resolves with the old stale data (isActive: false)
      resolveSlowGet(null);

      // The UI must NOT revert to Inactive! It was discarded due to latestFetchId
      await waitFor(() => {
        expect(utils.getByTestId('toggle-status-3').textContent).toContain('Deactivate');
      });
    });

    it('restores authoritative backend state and displays clear error feedback when status update fails', async () => {
      setInMemoryCsrfToken('test-csrf-token-abc');

      let getByIdCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Admin', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories/3/status') && method === 'PATCH') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                message: 'Database concurrency conflict: category status was modified elsewhere.',
                data: null,
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories/3') && method === 'GET') {
          getByIdCalled = true;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Authoritative record',
                data: sampleCategories[2], // still false
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        if (url.includes('/api/admin/categories') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Categories', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
        );
      });

      const utils = render(
        <AuthProvider>
          <CategoriesManagementView />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(utils.getAllByText('Legacy Softwares').length).toBeGreaterThan(0);
      });

      fireEvent.click(utils.getByTestId('toggle-status-3'));
      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="confirm-status-button"]')).not.toBeNull();
      });

      fireEvent.click(document.body.querySelector('[data-testid="confirm-status-button"]')!);

      // Error message is displayed
      await waitFor(() => {
        expect(document.body.textContent).toContain('Database concurrency conflict');
      });

      // Authoritative state was queried
      expect(getByIdCalled).toBe(true);

      // State remains Inactive ("Activate" button remains)
      expect(utils.getByTestId('toggle-status-3').textContent).toContain('Activate');

      // Dismiss dialog cleanly
      fireEvent.click(utils.getByText('Cancel'));
      await waitFor(() => {
        expect(document.body.querySelector('[data-testid="confirm-status-button"]')).toBeNull();
      });
    });
  });
});
