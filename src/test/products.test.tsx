import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { ProductsManagementView } from '../routes/products';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type { AdminProductDto, PagedResult } from '../lib/products-api';
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
    isActive: false, // inactive category
    productCount: 2,
    createdAt: '2026-10-11T12:00:00Z',
    updatedAt: '2026-10-13T09:00:00Z',
  },
];

const sampleProducts: AdminProductDto[] = [
  {
    id: 101,
    internalSku: 'CHATGPT_PLUS_1M',
    name: 'ChatGPT Plus 1 Month',
    description: '1 month ChatGPT Plus premium voucher',
    categoryId: 1,
    categoryName: 'AI Writing & Tools',
    categorySlug: 'ai-writing-tools',
    categoryIsActive: true,
    sellingPrice: 5500,
    sellingCurrency: 'PKR',
    isActive: true,
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-14T12:00:00Z',
  },
  {
    id: 102,
    internalSku: 'CLAUDE_PRO_1M',
    name: 'Claude Pro 1 Month',
    description: 'Anthropic Claude Pro subscription voucher',
    categoryId: 1,
    categoryName: 'AI Writing & Tools',
    categorySlug: 'ai-writing-tools',
    categoryIsActive: true,
    sellingPrice: 6200,
    sellingCurrency: 'PKR',
    isActive: false,
    createdAt: '2026-10-13T11:00:00Z',
    updatedAt: '2026-10-15T09:00:00Z',
  },
  {
    id: 103,
    internalSku: 'GITHUB_COPILOT_1Y',
    name: 'GitHub Copilot 1 Year',
    description: 'Annual AI developer assistant voucher',
    categoryId: 2,
    categoryName: 'Developer Subscriptions',
    categorySlug: 'developer-subscriptions',
    categoryIsActive: false, // category is inactive!
    sellingPrice: 28000,
    sellingCurrency: 'PKR',
    isActive: true,
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-11T14:00:00Z',
  },
];

function setupProductFetch(
  products: AdminProductDto[] = sampleProducts,
  categories: AdminCategoryDto[] = sampleCategories,
) {
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

    // 3. GET products
    if (url.includes('/api/admin/products') && method === 'GET') {
      let filtered = [...products];

      if (url.includes('isActive=true')) {
        filtered = filtered.filter((p) => p.isActive);
      } else if (url.includes('isActive=false')) {
        filtered = filtered.filter((p) => !p.isActive);
      }

      if (url.includes('categoryId=1')) {
        filtered = filtered.filter((p) => p.categoryId === 1);
      } else if (url.includes('categoryId=2')) {
        filtered = filtered.filter((p) => p.categoryId === 2);
      }

      const searchMatch = url.match(/search=([^&]+)/);
      if (searchMatch) {
        const q = decodeURIComponent(searchMatch[1]).toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.internalSku.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)),
        );
      }

      const pagedResult: PagedResult<AdminProductDto> = {
        items: filtered,
        page: 1,
        pageSize: 10,
        totalCount: filtered.length,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Products retrieved successfully.',
            data: pagedResult,
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

describe('Products Management UI Integration', () => {
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
    it('redirects unauthenticated users to /login and blocks rendering', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, message: 'Unauthenticated', data: null }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unexpected fetch'));
      });

      const { container } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
      });

      expect(container.querySelector('[data-testid="products-page"]')).toBeNull();
    });

    it('renders the Products page for verified administrators', async () => {
      setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const page = await findByTestId('products-page');
      expect(page).toBeDefined();
      expect(await findByTestId('live-products-badge')).toHaveTextContent('Live Catalog');
    });
  });

  describe('2. Real API List Retrieval & Metrics Display', () => {
    it('loads and displays products with category, price in PKR, and status', async () => {
      setupProductFetch();

      const { findByTestId, findByText } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const row101 = await findByTestId('product-row-101');
      expect(row101).toBeDefined();
      expect(row101).toHaveTextContent('ChatGPT Plus 1 Month');
      expect(row101).toHaveTextContent('CHATGPT_PLUS_1M');
      expect(row101).toHaveTextContent('₨ 5,500.00');

      // Metric cards
      expect(await findByTestId('metric-total-products')).toHaveTextContent('3');
      expect(await findByTestId('metric-categories-count')).toHaveTextContent('2');
    });

    it('indicates when a product parent category is inactive', async () => {
      setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const row103 = await findByTestId('product-row-103');
      expect(row103).toHaveTextContent('Category Inactive');
      expect(row103).toHaveTextContent('Hidden (Category Off)');
    });
  });

  describe('3. Loading and Empty States', () => {
    it('shows loading skeleton while fetch is in progress', async () => {
      let resolveProductsFetch: any;
      const productsPromise = new Promise((resolve) => {
        resolveProductsFetch = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products')) {
          return productsPromise as Promise<Response>;
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const { getByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(getByTestId('table-loading-skeleton')).toBeDefined();
      });

      // Resolve fetch
      resolveProductsFetch(
        new Response(
          JSON.stringify({
            success: true,
            message: 'OK',
            data: {
              items: sampleProducts,
              page: 1,
              pageSize: 10,
              totalCount: 3,
              totalPages: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await waitFor(() => {
        expect(screen.queryByTestId('table-loading-skeleton')).toBeNull();
      });
    });

    it('displays empty catalog state when database has 0 products', async () => {
      setupProductFetch([]);

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const emptyState = await findByTestId('products-empty-catalog-state');
      expect(emptyState).toHaveTextContent('No products yet');
      expect(await findByTestId('empty-add-product-button')).toBeDefined();
    });

    it('displays empty filter state when search matches nothing', async () => {
      setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const searchInput = await findByTestId('products-search-input');
      fireEvent.change(searchInput, { target: { value: 'NonexistentProductXYZ' } });

      await waitFor(async () => {
        expect(await findByTestId('products-no-match-state')).toBeDefined();
      });
    });
  });

  describe('4. Error Handling and Retry', () => {
    it('shows server error state on network failure and allows retry', async () => {
      let fail = true;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products')) {
          if (fail) {
            return Promise.resolve(
              new Response(
                JSON.stringify({ success: false, message: 'Backend database unavailable', data: null }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
              ),
            );
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: {
                  items: sampleProducts,
                  page: 1,
                  pageSize: 10,
                  totalCount: 3,
                  totalPages: 1,
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const errorState = await findByTestId('products-error-state');
      expect(errorState).toHaveTextContent('Unable to load products');

      // Click retry
      fail = false;
      const retryBtn = await findByTestId('retry-fetch-button');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('products-error-state')).toBeNull();
        expect(screen.getByTestId('product-row-101')).toBeDefined();
      });
    });
  });

  describe('5. Create Product Flow & Validation', () => {
    it('validates required fields client-side before submission', async () => {
      setupProductFetch();

      const { findByTestId, findByText } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const addBtn = await findByTestId('add-product-button');
      fireEvent.click(addBtn);

      const submitBtn = await findByTestId('product-submit-button');
      fireEvent.click(submitBtn);

      expect(await findByText('Internal SKU is required.')).toBeDefined();
      expect(await findByText('Product name is required.')).toBeDefined();
      expect(await findByText('Selling price is required.')).toBeDefined();
    });

    it('creates product and sends POST with X-XSRF-TOKEN', async () => {
      const fetchSpy = setupProductFetch();

      const newProduct: AdminProductDto = {
        id: 200,
        internalSku: 'MIDJOURNEY_PRO_1M',
        name: 'Midjourney Pro 1 Month',
        description: 'Image generation plan',
        categoryId: 1,
        categoryName: 'AI Writing & Tools',
        categorySlug: 'ai-writing-tools',
        categoryIsActive: true,
        sellingPrice: 15000,
        sellingCurrency: 'PKR',
        isActive: true,
        createdAt: '2026-10-16T15:00:00Z',
        updatedAt: '2026-10-16T15:00:00Z',
      };

      // Mock POST handler
      fetchSpy.mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Product created successfully.',
                data: newProduct,
              }),
              { status: 201, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: {
                  items: [newProduct, ...sampleProducts],
                  page: 1,
                  pageSize: 10,
                  totalCount: 4,
                  totalPages: 1,
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      const { findByTestId, findByText } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      fireEvent.click(await findByTestId('add-product-button'));

      fireEvent.change(await findByTestId('product-sku-input'), {
        target: { value: 'midjourney_pro_1m' },
      });
      fireEvent.change(await findByTestId('product-name-input'), {
        target: { value: 'Midjourney Pro 1 Month' },
      });
      fireEvent.change(await findByTestId('product-price-input'), {
        target: { value: '15000' },
      });
      fireEvent.change(await findByTestId('product-description-input'), {
        target: { value: 'Image generation plan' },
      });

      fireEvent.click(await findByTestId('product-submit-button'));

      await waitFor(() => {
        expect(
          screen.getByText('Product "Midjourney Pro 1 Month" created successfully.'),
        ).toBeDefined();
      });

      // Verify POST call had X-XSRF-TOKEN
      const postCall = fetchSpy.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('/api/admin/products') && c[1]?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const headers = postCall![1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('test-csrf-token-abc');
    });

    it('handles backend 409 Conflict for duplicate SKU', async () => {
      const fetchSpy = setupProductFetch();

      fetchSpy.mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                message: "A product with internal SKU 'CHATGPT_PLUS_1M' already exists.",
                data: null,
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: { items: sampleProducts, totalCount: 3, totalPages: 1 },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      const { findByTestId, findByText } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      fireEvent.click(await findByTestId('add-product-button'));

      fireEvent.change(await findByTestId('product-sku-input'), {
        target: { value: 'CHATGPT_PLUS_1M' },
      });
      fireEvent.change(await findByTestId('product-name-input'), {
        target: { value: 'Duplicate Product' },
      });
      fireEvent.change(await findByTestId('product-price-input'), {
        target: { value: '5000' },
      });

      fireEvent.click(await findByTestId('product-submit-button'));

      expect(await findByTestId('product-form-server-error')).toHaveTextContent(
        "A product with internal SKU 'CHATGPT_PLUS_1M' already exists.",
      );
      expect(await findByTestId('product-sku-error')).toHaveTextContent(
        "A product with internal SKU 'CHATGPT_PLUS_1M' already exists.",
      );
    });
  });

  describe('6. Edit Product Flow & SKU Immutability', () => {
    it('populates fields and sends PUT request while keeping SKU read-only', async () => {
      const fetchSpy = setupProductFetch();

      const updatedProduct: AdminProductDto = {
        ...sampleProducts[0],
        name: 'ChatGPT Plus 1 Month (Updated)',
        sellingPrice: 5800,
      };

      fetchSpy.mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products/101') && method === 'PUT') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Product updated successfully.',
                data: updatedProduct,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: { items: sampleProducts, totalCount: 3, totalPages: 1 },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      const { findByTestId, findByText } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const editBtn = await findByTestId('edit-product-101');
      fireEvent.click(editBtn);

      const skuInput = await findByTestId('product-sku-input');
      expect(skuInput).toBeDisabled(); // SKU is immutable in edit mode

      const nameInput = await findByTestId('product-name-input');
      expect(nameInput).toHaveValue('ChatGPT Plus 1 Month');
      fireEvent.change(nameInput, { target: { value: 'ChatGPT Plus 1 Month (Updated)' } });

      const priceInput = await findByTestId('product-price-input');
      expect(priceInput).toHaveValue('5500');
      fireEvent.change(priceInput, { target: { value: '5800' } });

      fireEvent.click(await findByTestId('product-submit-button'));

      await waitFor(() => {
        expect(
          screen.getByText('Product "ChatGPT Plus 1 Month (Updated)" updated successfully.'),
        ).toBeDefined();
      });

      // Verify PUT request excluded internalSku
      const putCall = fetchSpy.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('/api/admin/products/101') && c[1]?.method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall![1]?.body as string);
      expect(body.internalSku).toBeUndefined();
      expect(body.name).toBe('ChatGPT Plus 1 Month (Updated)');
      expect(body.sellingPrice).toBe(5800);
    });
  });

  describe('7. Status Toggling & Deletion Safety', () => {
    it('confirms that NO Delete button exists in the interface', async () => {
      setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      await findByTestId('product-row-101');

      // Permanent product deletion is disallowed by backend design
      expect(screen.queryByText(/delete/i)).toBeNull();
      expect(screen.queryByTestId('delete-product-101')).toBeNull();
    });

    it('toggles product status via PATCH /api/admin/products/:id/status', async () => {
      const fetchSpy = setupProductFetch();

      const patchedProduct: AdminProductDto = {
        ...sampleProducts[0],
        isActive: false,
      };

      fetchSpy.mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products/101/status') && method === 'PATCH') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Product status updated to inactive.',
                data: patchedProduct,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: { items: sampleProducts, totalCount: 3, totalPages: 1 },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      const { findByTestId, findByText } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const toggleBtn = await findByTestId('toggle-status-101');
      expect(toggleBtn).toHaveTextContent('Deactivate');
      fireEvent.click(toggleBtn);

      const confirmBtn = await findByTestId('confirm-product-status-button');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(
          screen.getByText('Product "ChatGPT Plus 1 Month" has been deactivated.'),
        ).toBeDefined();
      });

      const patchCall = fetchSpy.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('/api/admin/products/101/status') && c[1]?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse(patchCall![1]?.body as string);
      expect(body.isActive).toBe(false);
    });
  });

  describe('8. Filtering and Search', () => {
    it('filters products by category dropdown', async () => {
      const fetchSpy = setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const categoryFilter = await findByTestId('category-filter-select');
      await waitFor(() => {
        expect(categoryFilter.querySelectorAll('option').length).toBeGreaterThan(1);
      });
      fireEvent.change(categoryFilter, { target: { value: '1' } });

      await waitFor(() => {
        const catFilterCall = fetchSpy.mock.calls.find(
          (c) => typeof c[0] === 'string' && c[0].includes('categoryId=1'),
        );
        expect(catFilterCall).toBeDefined();
      });
    });

    it('filters products by status tab (Active, Inactive, All)', async () => {
      const fetchSpy = setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const activeTab = await findByTestId('filter-tab-active');
      fireEvent.click(activeTab);

      await waitFor(() => {
        const activeCall = fetchSpy.mock.calls.find(
          (c) => typeof c[0] === 'string' && c[0].includes('isActive=true'),
        );
        expect(activeCall).toBeDefined();
      });
    });

    it('filters products by keyword search', async () => {
      const fetchSpy = setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      const searchInput = await findByTestId('products-search-input');
      fireEvent.change(searchInput, { target: { value: 'Copilot' } });

      await waitFor(() => {
        const searchCall = fetchSpy.mock.calls.find(
          (c) => typeof c[0] === 'string' && c[0].includes('search=Copilot'),
        );
        expect(searchCall).toBeDefined();
      });
    });
  });

  describe('9. Status Concurrency & Stale Response Protection', () => {
    it('disables toggle buttons while update is in flight and shows spinner', async () => {
      let resolvePatch: any;
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });

      const fetchSpy = setupProductFetch();
      fetchSpy.mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products/101/status') && method === 'PATCH') {
          return patchPromise as Promise<Response>;
        }
        if (url.includes('/api/admin/products') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: { items: sampleProducts, totalCount: 3, totalPages: 1 },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      fireEvent.click(await findByTestId('toggle-status-101'));
      fireEvent.click(await findByTestId('confirm-product-status-button'));

      // Check that button shows Updating... and is disabled
      await waitFor(() => {
        const toggleBtn = screen.getByTestId('toggle-status-101');
        expect(toggleBtn).toBeDisabled();
        expect(toggleBtn).toHaveTextContent('Updating...');
      });

      // Complete patch
      resolvePatch(
        new Response(
          JSON.stringify({
            success: true,
            message: 'OK',
            data: { ...sampleProducts[0], isActive: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await waitFor(() => {
        const toggleBtn = screen.getByTestId('toggle-status-101');
        expect(toggleBtn).not.toBeDisabled();
      });
    });

    it('restores authoritative backend state when status update fails', async () => {
      const fetchSpy = setupProductFetch();

      fetchSpy.mockImplementation((input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.url;
        const method = (init?.method || 'GET').toUpperCase();

        if (url.includes('/api/admin/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: mockAdminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/categories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'OK', data: sampleCategories }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products/101/status') && method === 'PATCH') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                message: 'Failed to update status on server.',
                data: null,
              }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products/101') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: sampleProducts[0], // authoritative state
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/products') && method === 'GET') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'OK',
                data: { items: sampleProducts, totalCount: 3, totalPages: 1 },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      fireEvent.click(await findByTestId('toggle-status-101'));
      fireEvent.click(await findByTestId('confirm-product-status-button'));

      await waitFor(() => {
        expect(screen.getByTestId('products-feedback-alert')).toHaveTextContent(
          'Failed to update status on server.',
        );
      });
    });
  });

  describe('10. Mobile Responsive Layout', () => {
    it('renders mobile cards with edit and status toggle buttons', async () => {
      setupProductFetch();

      const { findByTestId } = render(
        <AuthProvider>
          <ProtectedRoute>
            <ProductsManagementView />
          </ProtectedRoute>
        </AuthProvider>,
      );

      expect(await findByTestId('product-cards-mobile')).toBeDefined();
      expect(await findByTestId('product-card-101')).toBeDefined();
      expect(await findByTestId('mobile-edit-101')).toBeDefined();
      expect(await findByTestId('mobile-toggle-101')).toBeDefined();
    });
  });
});
