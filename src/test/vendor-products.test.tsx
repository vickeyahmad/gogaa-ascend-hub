import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { VendorProductsManagementView } from '../routes/vendor-products';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type { AdminVendorProductDto } from '../lib/vendor-products-api';
import type { AdminVendorDto } from '../lib/vendors-api';
import type { AdminProductDto } from '../lib/products-api';

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

const sampleVendors: AdminVendorDto[] = [
  {
    id: 1,
    internalName: 'Supplier Alpha',
    isActive: true,
    productMappingCount: 5,
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-14T12:00:00Z',
  },
  {
    id: 2,
    internalName: 'Supplier Inactive',
    isActive: false,
    productMappingCount: 1,
    createdAt: '2026-10-13T11:00:00Z',
    updatedAt: '2026-10-15T09:00:00Z',
  },
];

const sampleProducts: AdminProductDto[] = [
  {
    id: 10,
    internalSku: 'CHATGPT_PLUS_1M',
    name: 'ChatGPT Plus (1 Month)',
    description: 'Shared 1-month plan',
    categoryId: 1,
    categoryName: 'AI Subscriptions',
    categorySlug: 'ai-subscriptions',
    categoryIsActive: true,
    sellingPrice: 2500,
    sellingCurrency: 'PKR',
    isActive: true,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-12T12:00:00Z',
  },
  {
    id: 11,
    internalSku: 'CLAUDE_PRO_1M',
    name: 'Claude Pro (1 Month)',
    description: 'Direct team access',
    categoryId: 1,
    categoryName: 'AI Subscriptions',
    categorySlug: 'ai-subscriptions',
    categoryIsActive: true,
    sellingPrice: 2800,
    sellingCurrency: 'PKR',
    isActive: false,
    createdAt: '2026-10-11T11:00:00Z',
    updatedAt: '2026-10-13T13:00:00Z',
  },
];

const sampleMappings: AdminVendorProductDto[] = [
  {
    id: 101,
    vendorId: 1,
    vendorName: 'Supplier Alpha',
    vendorIsActive: true,
    productId: 10,
    productSku: 'CHATGPT_PLUS_1M',
    productName: 'ChatGPT Plus (1 Month)',
    productSellingPrice: 2500,
    productSellingCurrency: 'PKR',
    productIsActive: true,
    externalProductId: 'EXT-GPT-42',
    vendorCost: 1600,
    vendorCostCurrency: 'PKR',
    isAvailable: true,
    priority: 1,
    createdAt: '2026-10-14T10:00:00Z',
    updatedAt: '2026-10-14T12:00:00Z',
  },
  {
    id: 102,
    vendorId: 2,
    vendorName: 'Supplier Inactive',
    vendorIsActive: false,
    productId: 10,
    productSku: 'CHATGPT_PLUS_1M',
    productName: 'ChatGPT Plus (1 Month)',
    productSellingPrice: 2500,
    productSellingCurrency: 'PKR',
    productIsActive: true,
    externalProductId: 'EXT-GPT-99',
    vendorCost: 14.5,
    vendorCostCurrency: 'USDT',
    isAvailable: true,
    priority: 2,
    createdAt: '2026-10-14T11:00:00Z',
    updatedAt: '2026-10-14T13:00:00Z',
  },
  {
    id: 103,
    vendorId: 1,
    vendorName: 'Supplier Alpha',
    vendorIsActive: true,
    productId: 11,
    productSku: 'CLAUDE_PRO_1M',
    productName: 'Claude Pro (1 Month)',
    productSellingPrice: 2800,
    productSellingCurrency: 'PKR',
    productIsActive: false,
    externalProductId: 'EXT-CLAUDE-01',
    vendorCost: 1750,
    vendorCostCurrency: 'PKR',
    isAvailable: false,
    priority: 10,
    createdAt: '2026-10-14T12:00:00Z',
    updatedAt: '2026-10-14T14:00:00Z',
  },
];

function setupMappingFetch(mappings: AdminVendorProductDto[] = sampleMappings) {
  setInMemoryCsrfToken('test-csrf-token-xyz');

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

    // 2. GET /api/admin/vendors (for dropdown filter and form picker)
    if (url.includes('/api/admin/vendors') && method === 'GET') {
      let filtered = [...sampleVendors];
      const searchMatch = url.match(/search=([^&]+)/);
      if (searchMatch) {
        const q = decodeURIComponent(searchMatch[1]).toLowerCase();
        filtered = filtered.filter((v) => v.internalName.toLowerCase().includes(q));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendors retrieved.',
            data: {
              items: filtered,
              page: 1,
              pageSize: 20,
              totalCount: filtered.length,
              totalPages: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    // 3. GET /api/admin/products (for form picker)
    if (url.includes('/api/admin/products') && method === 'GET') {
      let filtered = [...sampleProducts];
      const searchMatch = url.match(/search=([^&]+)/);
      if (searchMatch) {
        const q = decodeURIComponent(searchMatch[1]).toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.internalSku.toLowerCase().includes(q),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Products retrieved.',
            data: {
              items: filtered,
              page: 1,
              pageSize: 20,
              totalCount: filtered.length,
              totalPages: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    // 4. GET /api/admin/vendor-products/:id
    const singleMatch = url.match(/\/api\/admin\/vendor-products\/(\d+)$/);
    if (singleMatch && method === 'GET') {
      const id = parseInt(singleMatch[1], 10);
      const found = mappings.find((m) => m.id === id);
      if (found) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Mapping found.',
              data: found,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: false, message: 'Mapping not found.', data: null }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    // 5. GET /api/admin/vendor-products (list)
    if (url.includes('/api/admin/vendor-products') && method === 'GET') {
      let filtered = [...mappings];

      if (url.includes('isAvailable=true')) {
        filtered = filtered.filter((m) => m.isAvailable);
      } else if (url.includes('isAvailable=false')) {
        filtered = filtered.filter((m) => !m.isAvailable);
      }

      const vendorMatch = url.match(/vendorId=(\d+)/);
      if (vendorMatch) {
        const vid = parseInt(vendorMatch[1], 10);
        filtered = filtered.filter((m) => m.vendorId === vid);
      }

      const currencyMatch = url.match(/currency=([^&]+)/);
      if (currencyMatch) {
        const cur = decodeURIComponent(currencyMatch[1]).toUpperCase();
        filtered = filtered.filter((m) => m.vendorCostCurrency.toUpperCase() === cur);
      }

      const skuMatch = url.match(/productSku=([^&]+)/);
      if (skuMatch) {
        const skuQ = decodeURIComponent(skuMatch[1]).toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.productSku.toLowerCase().includes(skuQ) ||
            m.productName.toLowerCase().includes(skuQ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor product mappings retrieved.',
            data: {
              items: filtered,
              page: 1,
              pageSize: 10,
              totalCount: filtered.length,
              totalPages: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ success: false }), { status: 404 }),
    );
  });
}

describe('Vendor Products Management Component and Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCsrfToken();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users away from the Product Mappings page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, message: 'Session expired', data: null }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <AuthProvider>
        <ProtectedRoute>
          <VendorProductsManagementView />
        </ProtectedRoute>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/login',
        }),
      );
    });
  });

  it('shows loading skeleton while fetch is in progress', async () => {
    let resolveMappings: any;
    const pendingMappings = new Promise((resolve) => {
      resolveMappings = resolve;
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

      if (url.includes('/api/admin/vendor-products')) {
        return pendingMappings as Promise<Response>;
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { items: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-products-loading-skeleton')).toBeInTheDocument();
    });

    resolveMappings(
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            items: sampleMappings,
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
      expect(screen.queryByTestId('vendor-products-loading-skeleton')).not.toBeInTheDocument();
    });
  });

  it('loads and displays mapping records with accurate supplier and product details', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-product-row-102')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-product-row-103')).toBeInTheDocument();
    });

    // Verify row 101 data
    const row101 = screen.getByTestId('vendor-product-row-101');
    expect(row101).toHaveTextContent('ChatGPT Plus (1 Month)');
    expect(row101).toHaveTextContent('CHATGPT_PLUS_1M');
    expect(row101).toHaveTextContent('Supplier Alpha');
    expect(screen.getByTestId('external-id-101')).toHaveTextContent('EXT-GPT-42');
    expect(screen.getByTestId('vendor-cost-101')).toHaveTextContent('1,600.00 PKR');
    expect(screen.getByTestId('priority-badge-101')).toHaveTextContent('#1');

    // Verify multi-currency cost integrity: row 102 has 14.50 USDT
    expect(screen.getByTestId('vendor-cost-102')).toHaveTextContent('14.50 USDT');
  });

  it('indicates when parent supplier or internal product is inactive', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      // Row 102 has inactive vendor: Supplier Inactive
      expect(screen.getByTestId('vendor-inactive-indicator-102')).toHaveTextContent(
        'Supplier Inactive',
      );
      // Row 103 has inactive product: Claude Pro
      expect(screen.getByTestId('product-inactive-indicator-103')).toHaveTextContent(
        'Product Inactive',
      );
    });
  });

  it('filters mappings by availability tab (All, Available, Unavailable)', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
    });

    // Click 'Unavailable' tab
    fireEvent.click(screen.getByTestId('filter-tab-unavailable'));

    await waitFor(() => {
      // Only row 103 is unavailable
      expect(screen.queryByTestId('vendor-product-row-101')).not.toBeInTheDocument();
      expect(screen.queryByTestId('vendor-product-row-102')).not.toBeInTheDocument();
      expect(screen.getByTestId('vendor-product-row-103')).toBeInTheDocument();
    });

    // Click 'Available' tab
    fireEvent.click(screen.getByTestId('filter-tab-available'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-product-row-102')).toBeInTheDocument();
      expect(screen.queryByTestId('vendor-product-row-103')).not.toBeInTheDocument();
    });
  });

  it('filters mappings by vendor and currency dropdowns', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
    });

    // Filter by Currency: USDT
    fireEvent.change(screen.getByTestId('currency-filter-select'), {
      target: { value: 'USDT' },
    });

    await waitFor(() => {
      expect(screen.queryByTestId('vendor-product-row-101')).not.toBeInTheDocument();
      expect(screen.getByTestId('vendor-product-row-102')).toBeInTheDocument();
      expect(screen.queryByTestId('vendor-product-row-103')).not.toBeInTheDocument();
    });
  });

  it('displays empty filter state when search matches nothing and resets filters', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
    });

    // Search for non-existent SKU
    fireEvent.change(screen.getByTestId('vendor-products-search-input'), {
      target: { value: 'NON_EXISTENT_SKU_QUERY' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('vendor-products-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No mappings match your filters')).toBeInTheDocument();
    });

    // Click Reset
    fireEvent.click(screen.getByTestId('empty-clear-filters-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
    });
  });

  it('validates required fields client-side in the Create Mapping dialog', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-vendor-product-button')).toBeInTheDocument();
    });

    // Open Add Mapping dialog
    fireEvent.click(screen.getByTestId('add-vendor-product-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-form-dialog')).toBeInTheDocument();
    });

    // Submit without filling fields
    fireEvent.click(screen.getByTestId('vendor-product-form-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-id-error')).toHaveTextContent('Please select a vendor.');
      expect(screen.getByTestId('product-id-error')).toHaveTextContent('Please select a product.');
      expect(screen.getByTestId('external-product-id-error')).toHaveTextContent(
        'External supplier product ID is required.',
      );
      expect(screen.getByTestId('vendor-cost-error')).toHaveTextContent(
        'Vendor purchase cost is required.',
      );
    });
  });

  it('creates product mapping and sends POST with X-XSRF-TOKEN', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-vendor-product-button')).toBeInTheDocument();
    });

    // Open Add Mapping dialog
    fireEvent.click(screen.getByTestId('add-vendor-product-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-select')).toBeInTheDocument();
      expect(screen.getByTestId('product-select')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByTestId('vendor-select'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('product-select'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('external-product-id-input'), {
      target: { value: 'SUPPLIER_NEW_ITEM_99' },
    });
    fireEvent.change(screen.getByTestId('vendor-cost-input'), { target: { value: '1450.50' } });
    fireEvent.change(screen.getByTestId('priority-input'), { target: { value: '3' } });

    // Mock POST success
    const newMapping: AdminVendorProductDto = {
      id: 104,
      vendorId: 1,
      vendorName: 'Supplier Alpha',
      vendorIsActive: true,
      productId: 10,
      productSku: 'CHATGPT_PLUS_1M',
      productName: 'ChatGPT Plus (1 Month)',
      productSellingPrice: 2500,
      productSellingCurrency: 'PKR',
      productIsActive: true,
      externalProductId: 'SUPPLIER_NEW_ITEM_99',
      vendorCost: 1450.5,
      vendorCostCurrency: 'PKR',
      isAvailable: true,
      priority: 3,
      createdAt: '2026-10-17T12:00:00Z',
      updatedAt: '2026-10-17T12:00:00Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Vendor product mapping created successfully.',
              data: newMapping,
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );

    // Submit
    fireEvent.click(screen.getByTestId('vendor-product-form-submit'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendor-products',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(screen.queryByTestId('vendor-product-form-dialog')).not.toBeInTheDocument();
    });
  });

  it('handles backend 409 Conflict for duplicate vendor-product pair', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-vendor-product-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-vendor-product-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('vendor-select'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('product-select'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('external-product-id-input'), {
      target: { value: 'DUPLICATE_EXT_ID' },
    });
    fireEvent.change(screen.getByTestId('vendor-cost-input'), { target: { value: '1500' } });

    // Mock 409 Conflict response
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              message: 'A mapping for Vendor ID 1 and Product ID 10 already exists.',
              data: null,
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );

    fireEvent.click(screen.getByTestId('vendor-product-form-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-form-server-error')).toHaveTextContent(
        'A mapping for Vendor ID 1 and Product ID 10 already exists.',
      );
      // Dialog remains open for user correction
      expect(screen.getByTestId('vendor-product-form-dialog')).toBeInTheDocument();
    });
  });

  it('opens Edit dialog with immutable vendor/product and sends PUT request', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-mapping-button-101')).toBeInTheDocument();
    });

    // Click Edit on mapping 101
    fireEvent.click(screen.getByTestId('edit-mapping-button-101'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-form-dialog')).toBeInTheDocument();
      // Immutable vendor/product display:
      expect(screen.getByText('Supplier Vendor (Immutable):')).toBeInTheDocument();
      expect(screen.getByText('Internal Product (Immutable):')).toBeInTheDocument();
      // External ID has initial value
      expect(screen.getByTestId('external-product-id-input')).toHaveValue('EXT-GPT-42');
    });

    // Update external ID, cost, and priority
    fireEvent.change(screen.getByTestId('external-product-id-input'), {
      target: { value: 'EXT-GPT-42-REVISED' },
    });
    fireEvent.change(screen.getByTestId('vendor-cost-input'), {
      target: { value: '1550.00' },
    });
    fireEvent.change(screen.getByTestId('priority-input'), {
      target: { value: '5' },
    });

    const updatedMapping = {
      ...sampleMappings[0],
      externalProductId: 'EXT-GPT-42-REVISED',
      vendorCost: 1550,
      priority: 5,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Vendor product mapping updated successfully.',
              data: updatedMapping,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );

    fireEvent.click(screen.getByTestId('vendor-product-form-submit'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendor-products/101',
        expect.objectContaining({
          method: 'PUT',
        }),
      );
      expect(screen.queryByTestId('vendor-product-form-dialog')).not.toBeInTheDocument();
    });
  });

  it('toggles mapping availability via PATCH after confirmation', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-availability-button-101')).toBeInTheDocument();
    });

    // Click toggle button for mapping 101 (currently available)
    fireEvent.click(screen.getByTestId('toggle-availability-button-101'));

    await waitFor(() => {
      expect(
        screen.getByTestId('confirm-vendor-product-availability-dialog'),
      ).toBeInTheDocument();
      expect(screen.getByText('Disable Mapping Availability')).toBeInTheDocument();
    });

    // Confirm disable
    const disabledMapping = { ...sampleMappings[0], isAvailable: false };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Availability updated.',
              data: disabledMapping,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );

    fireEvent.click(screen.getByTestId('confirm-availability-submit-button'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendor-products/101/availability',
        expect.objectContaining({
          method: 'PATCH',
        }),
      );
      expect(
        screen.queryByTestId('confirm-vendor-product-availability-dialog'),
      ).not.toBeInTheDocument();
    });
  });

  it('disables confirmation button while update is in flight to prevent duplicate submissions', async () => {
    setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-availability-button-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-availability-button-101'));

    await waitFor(() => {
      expect(
        screen.getByTestId('confirm-vendor-product-availability-dialog'),
      ).toBeInTheDocument();
    });

    let resolvePatch: any;
    const pendingPatch = new Promise((resolve) => {
      resolvePatch = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => pendingPatch as Promise<Response>);

    const submitBtn = screen.getByTestId('confirm-availability-submit-button');
    fireEvent.click(submitBtn);

    // Verify button is disabled during submission
    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    // Resolve patch
    resolvePatch(
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: { ...sampleMappings[0], isAvailable: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId('confirm-vendor-product-availability-dialog'),
      ).not.toBeInTheDocument();
    });
  });

  it('discards stale GET responses so an out-of-order response cannot overwrite newer state', async () => {
    let resolveStaleGet: any;
    const staleGetPromise = new Promise((resolve) => {
      resolveStaleGet = resolve;
    });

    let fetchCount = 0;

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

      if (url.includes('/api/admin/vendors')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: { items: sampleVendors } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/vendor-products')) {
        fetchCount++;
        if (fetchCount === 1) {
          // Initial GET returns 3 items
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Initial',
                data: {
                  items: sampleMappings,
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
        }

        if (fetchCount === 2) {
          // Delayed slow GET
          return staleGetPromise as Promise<Response>;
        }

        // Fast newer GET (e.g. after filter/refresh) returns only 1 item
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Fresh newer data',
              data: {
                items: [sampleMappings[0]],
                page: 1,
                pageSize: 10,
                totalCount: 1,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false }), { status: 404 }),
      );
    });

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    // Initial load finishes
    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-product-row-102')).toBeInTheDocument();
    });

    // Trigger second fetch (slow GET) by clicking refresh
    fireEvent.click(screen.getByTestId('refresh-vendor-products-button'));

    // Trigger third fetch (fast newer GET) by changing currency filter
    fireEvent.change(screen.getByTestId('currency-filter-select'), {
      target: { value: 'USDT' },
    });

    // Fast newer GET returns 1 item
    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
      expect(screen.queryByTestId('vendor-product-row-102')).not.toBeInTheDocument();
    });

    // Now resolve the older slow GET containing row 102
    resolveStaleGet(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Stale',
          data: {
            items: sampleMappings,
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

    // Assert the stale response was discarded and did not bring back row 102
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('vendor-product-row-102')).not.toBeInTheDocument();
  });

  it('paginates mappings when multiple pages exist', async () => {
    let requestedPage = 1;

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

      if (url.includes('/api/admin/vendors')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: { items: sampleVendors } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/vendor-products')) {
        const pageMatch = url.match(/page=(\d+)/);
        if (pageMatch) {
          requestedPage = parseInt(pageMatch[1], 10);
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'OK',
              data: {
                items: requestedPage === 1 ? [sampleMappings[0]] : [sampleMappings[1]],
                page: requestedPage,
                pageSize: 1,
                totalCount: 2,
                totalPages: 2,
                hasPreviousPage: requestedPage > 1,
                hasNextPage: requestedPage < 2,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false }), { status: 404 }),
      );
    });

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-indicator')).toHaveTextContent('Page 1 of 2');
    });

    // Click Next page
    fireEvent.click(screen.getByTestId('pagination-next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-102')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-page-indicator')).toHaveTextContent('Page 2 of 2');
    });
  });

  it('displays error banner on fetch failure and retries successfully', async () => {
    let failFetch = true;

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

      if (url.includes('/api/admin/vendors')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: { items: sampleVendors } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/vendor-products')) {
        if (failFetch) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                message: 'Failed to connect to database.',
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
              message: 'OK',
              data: {
                items: sampleMappings,
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
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false }), { status: 404 }),
      );
    });

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    // Verify error banner is shown
    await waitFor(() => {
      expect(screen.getByTestId('vendor-products-error-banner')).toBeInTheDocument();
      expect(screen.getByText('Failed to connect to database.')).toBeInTheDocument();
    });

    // Fix backend and click retry
    failFetch = false;
    fireEvent.click(screen.getByTestId('retry-fetch-button'));

    // Verify mappings load after retry
    await waitFor(() => {
      expect(screen.queryByTestId('vendor-products-error-banner')).not.toBeInTheDocument();
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
    });
  });

  it('guarantees supplier costs and IDs never leak or trigger automated orders', async () => {
    const fetchSpy = setupMappingFetch();

    render(
      <AuthProvider>
        <VendorProductsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-product-row-101')).toBeInTheDocument();
    });

    // Verify no supplier API endpoints, order placement, or wallet endpoints were called
    const calledUrls = fetchSpy.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.url,
    );

    expect(calledUrls.some((u) => u.includes('/api/orders'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('/api/customer/orders'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('/api/admin/orders'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('/fulfillment'))).toBe(false);
  });
});
