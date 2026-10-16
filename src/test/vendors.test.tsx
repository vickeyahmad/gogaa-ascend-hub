import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { VendorsManagementView } from '../routes/vendors';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type { AdminVendorDto, PagedResult } from '../lib/vendors-api';

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
    id: 201,
    internalName: 'Supplier Prime',
    isActive: true,
    productMappingCount: 14,
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-14T12:00:00Z',
  },
  {
    id: 202,
    internalName: 'Supplier Nexus',
    isActive: false,
    productMappingCount: 0,
    createdAt: '2026-10-13T11:00:00Z',
    updatedAt: '2026-10-15T09:00:00Z',
  },
  {
    id: 203,
    internalName: 'Supplier Direct',
    isActive: true,
    productMappingCount: 3,
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-11T14:00:00Z',
  },
];

function setupVendorFetch(vendors: AdminVendorDto[] = sampleVendors) {
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

    // 2. GET vendors
    if (url.includes('/api/admin/vendors') && method === 'GET') {
      let filtered = [...vendors];

      if (url.includes('isActive=true')) {
        filtered = filtered.filter((v) => v.isActive);
      } else if (url.includes('isActive=false')) {
        filtered = filtered.filter((v) => !v.isActive);
      }

      const searchMatch = url.match(/search=([^&]+)/);
      if (searchMatch) {
        const q = decodeURIComponent(searchMatch[1]).toLowerCase();
        filtered = filtered.filter((v) => v.internalName.toLowerCase().includes(q));
      }

      const pagedResult: PagedResult<AdminVendorDto> = {
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
            message: 'Vendors retrieved successfully.',
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

describe('Vendors Management UI Integration', () => {
  beforeEach(() => {
    clearCsrfToken();
    mockNavigate.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Vendors page for verified administrators', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <ProtectedRoute>
          <VendorsManagementView />
        </ProtectedRoute>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendors-page')).toBeInTheDocument();
      expect(screen.getByTestId('live-vendors-badge')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users away from the Vendors page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, message: 'Session expired', data: null }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <AuthProvider>
        <ProtectedRoute>
          <VendorsManagementView />
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
    let resolveVendors: any;
    const pendingVendors = new Promise((resolve) => {
      resolveVendors = resolve;
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

      if (url.includes('/api/admin/vendors')) {
        return pendingVendors as Promise<Response>;
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false }), { status: 404 }),
      );
    });

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('table-loading-skeleton')).toBeInTheDocument();
    });

    // Resolve vendors
    resolveVendors(
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            items: sampleVendors,
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
      expect(screen.queryByTestId('table-loading-skeleton')).not.toBeInTheDocument();
    });
  });

  it('loads and displays vendors from backend with summary metrics', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('metric-total-vendors')).toHaveTextContent('3');
      expect(screen.getByTestId('metric-active-vendors')).toHaveTextContent('2');
      expect(screen.getByTestId('metric-inactive-vendors')).toHaveTextContent('1');
      expect(screen.getByTestId('metric-mapped-products')).toHaveTextContent('17');
    });

    // Check rows exist
    expect(screen.getByTestId('vendor-row-201')).toHaveTextContent('Supplier Prime');
    expect(screen.getByTestId('vendor-row-202')).toHaveTextContent('Supplier Nexus');
    expect(screen.getByTestId('vendor-row-203')).toHaveTextContent('Supplier Direct');

    // Check mapping counts
    expect(screen.getByTestId('vendor-mapping-count-201')).toHaveTextContent('14 mappings');
    expect(screen.getByTestId('vendor-mapping-count-202')).toHaveTextContent('0 mappings');
    expect(screen.getByTestId('vendor-mapping-count-203')).toHaveTextContent('3 mappings');
  });

  it('displays empty catalog state when totalCount is 0', async () => {
    setupVendorFetch([]);

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendors-empty-catalog-state')).toBeInTheDocument();
      expect(screen.getByText('No suppliers yet')).toBeInTheDocument();
    });
  });

  it('displays empty filter state when search matches nothing', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendors-search-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('vendors-search-input'), {
      target: { value: 'NonexistentSupplierXYZ' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('vendors-no-match-state')).toBeInTheDocument();
      expect(screen.getByText(/No suppliers match your current filters/)).toBeInTheDocument();
    });

    // Reset filters button clears search
    fireEvent.click(screen.getByTestId('clear-filters-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('vendors-no-match-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('vendor-row-201')).toBeInTheDocument();
    });
  });

  it('shows server error state on network failure and allows retry', async () => {
    let shouldFail = true;

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
        if (shouldFail) {
          return Promise.reject(new Error('Network error: server unreachable.'));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'OK',
              data: {
                items: sampleVendors,
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
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendors-error-state')).toBeInTheDocument();
      expect(screen.getByText('Unable to load suppliers')).toBeInTheDocument();
    });

    // Retry recovery
    shouldFail = false;
    fireEvent.click(screen.getByTestId('retry-fetch-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('vendors-error-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('vendor-row-201')).toBeInTheDocument();
    });
  });

  it('refreshes suppliers list when clicking the header refresh button', async () => {
    const fetchSpy = setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('refresh-vendors-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('refresh-vendors-button'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/vendors'),
        expect.anything(),
      );
    });
  });

  it('validates required fields client-side before submission', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-vendor-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-vendor-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-name-input')).toBeInTheDocument();
    });

    // Attempt submit with empty name
    fireEvent.click(screen.getByTestId('vendor-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-name-error')).toHaveTextContent(
        'Vendor internal name is required.',
      );
    });
  });

  it('creates vendor and sends POST with X-XSRF-TOKEN', async () => {
    const fetchSpy = setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-vendor-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-vendor-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-name-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('vendor-name-input'), {
      target: { value: 'Supplier Echo' },
    });

    // Mock successful creation response
    fetchSpy.mockImplementationOnce((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/vendors') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Vendor created successfully.',
              data: {
                id: 204,
                internalName: 'Supplier Echo',
                isActive: true,
                productMappingCount: 0,
                createdAt: '2026-10-17T10:00:00Z',
                updatedAt: '2026-10-17T10:00:00Z',
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    fireEvent.click(screen.getByTestId('vendor-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendors-feedback-alert')).toHaveTextContent(
        'Supplier "Supplier Echo" registered successfully.',
      );
    });

    // Verify POST was made with CSRF header
    const postCall = fetchSpy.mock.calls.find(
      (call) =>
        (typeof call[0] === 'string' ? call[0] : call[0].url).includes('/api/admin/vendors') &&
        call[1]?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const headers = postCall![1]?.headers as Headers;
    expect(headers.get('X-XSRF-TOKEN')).toBe('test-csrf-token-xyz');
    expect(postCall![1]?.credentials).toBe('include');
  });

  it('handles backend 409 Conflict for duplicate vendor name', async () => {
    const fetchSpy = setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-vendor-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-vendor-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-name-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('vendor-name-input'), {
      target: { value: 'Supplier Prime' },
    });

    // Mock 409 Conflict
    fetchSpy.mockImplementationOnce((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/vendors') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              message: "A vendor with name 'Supplier Prime' already exists.",
              data: null,
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    fireEvent.click(screen.getByTestId('vendor-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-form-server-error')).toHaveTextContent(
        "A vendor with name 'Supplier Prime' already exists.",
      );
      expect(screen.getByTestId('vendor-name-error')).toHaveTextContent(
        "A vendor with name 'Supplier Prime' already exists.",
      );
    });
  });

  it('pre-fills fields in edit dialog and sends PUT request', async () => {
    const fetchSpy = setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-vendor-201')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-vendor-201'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-name-input')).toHaveValue('Supplier Prime');
      expect(screen.getByText('Vendor ID:')).toBeInTheDocument();
      expect(screen.getAllByText(/#201/).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.change(screen.getByTestId('vendor-name-input'), {
      target: { value: 'Supplier Prime Global' },
    });

    // Mock successful update response
    fetchSpy.mockImplementationOnce((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/vendors/201') && method === 'PUT') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Vendor updated successfully.',
              data: {
                id: 201,
                internalName: 'Supplier Prime Global',
                isActive: true,
                productMappingCount: 14,
                createdAt: '2026-10-12T10:00:00Z',
                updatedAt: '2026-10-17T12:00:00Z',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    fireEvent.click(screen.getByTestId('vendor-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendors-feedback-alert')).toHaveTextContent(
        'Supplier "Supplier Prime Global" updated successfully.',
      );
      expect(screen.getByTestId('vendor-row-201')).toHaveTextContent('Supplier Prime Global');
    });

    const putCall = fetchSpy.mock.calls.find(
      (call) =>
        (typeof call[0] === 'string' ? call[0] : call[0].url).includes('/api/admin/vendors/201') &&
        call[1]?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const headers = putCall![1]?.headers as Headers;
    expect(headers.get('X-XSRF-TOKEN')).toBe('test-csrf-token-xyz');
  });

  it('toggles vendor status via PATCH /api/admin/vendors/:id/status after confirmation', async () => {
    const fetchSpy = setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-status-201')).toBeInTheDocument();
    });

    // Click Deactivate for vendor 201 (currently active)
    fireEvent.click(screen.getByTestId('toggle-status-201'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Deactivate Vendor' })).toBeInTheDocument();
      expect(screen.getByText(/Supplier will be excluded from fulfillment routing/)).toBeInTheDocument();
    });

    // Mock PATCH response
    fetchSpy.mockImplementationOnce((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/vendors/201/status') && method === 'PATCH') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Vendor status updated to inactive.',
              data: {
                id: 201,
                internalName: 'Supplier Prime',
                isActive: false,
                productMappingCount: 14,
                createdAt: '2026-10-12T10:00:00Z',
                updatedAt: '2026-10-17T12:00:00Z',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    fireEvent.click(screen.getByTestId('confirm-vendor-status-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendors-feedback-alert')).toHaveTextContent(
        'Supplier "Supplier Prime" has been deactivated.',
      );
    });

    const patchCall = fetchSpy.mock.calls.find(
      (call) =>
        (typeof call[0] === 'string' ? call[0] : call[0].url).includes(
          '/api/admin/vendors/201/status',
        ) && call[1]?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall![1]?.body as string)).toEqual({ isActive: false });
  });

  it('disables toggle buttons while update is in flight and shows spinner', async () => {
    let resolvePatch: any;
    const pendingPatch = new Promise((resolve) => {
      resolvePatch = resolve;
    });

    const fetchSpy = setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-status-201')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-status-201'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-vendor-status-button')).toBeInTheDocument();
    });

    fetchSpy.mockImplementationOnce((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/vendors/201/status') && method === 'PATCH') {
        return pendingPatch as Promise<Response>;
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    fireEvent.click(screen.getByTestId('confirm-vendor-status-button'));

    // Status button in row should now show disabled and aria-busy
    await waitFor(() => {
      const btn = screen.getByTestId('toggle-status-201');
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });

    // Resolve patch
    resolvePatch(
      new Response(
        JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            id: 201,
            internalName: 'Supplier Prime',
            isActive: false,
            productMappingCount: 14,
            createdAt: '2026-10-12T10:00:00Z',
            updatedAt: '2026-10-17T12:00:00Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await waitFor(() => {
      const btn = screen.getByTestId('toggle-status-201');
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'false');
    });
  });

  it('restores authoritative backend state when status update fails', async () => {
    const fetchSpy = setupVendorFetch();

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

      if (url.includes('/api/admin/vendors/201/status') && method === 'PATCH') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              message: 'Database error: unable to update vendor.',
              data: null,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/vendors/201') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'OK',
              data: sampleVendors[0], // authoritative active state
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/vendors') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'OK',
              data: { items: sampleVendors, totalCount: 3, totalPages: 1 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    const { findByTestId } = render(
      <AuthProvider>
        <ProtectedRoute>
          <VendorsManagementView />
        </ProtectedRoute>
      </AuthProvider>,
    );

    fireEvent.click(await findByTestId('toggle-status-201'));
    fireEvent.click(await findByTestId('confirm-vendor-status-button'));

    await waitFor(() => {
      expect(screen.getByTestId('vendors-feedback-alert')).toHaveTextContent(
        'Database error: unable to update vendor.',
      );
      expect(screen.getByTestId('vendor-row-201')).toHaveTextContent('Active');
    });
  });

  it('filters vendors by status tab (All, Active, Inactive)', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('filter-tab-active')).toBeInTheDocument();
    });

    // Click Active tab
    fireEvent.click(screen.getByTestId('filter-tab-active'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-row-201')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-row-203')).toBeInTheDocument();
      expect(screen.queryByTestId('vendor-row-202')).not.toBeInTheDocument();
    });

    // Click Inactive tab
    fireEvent.click(screen.getByTestId('filter-tab-inactive'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-row-202')).toBeInTheDocument();
      expect(screen.queryByTestId('vendor-row-201')).not.toBeInTheDocument();
    });

    // Click All tab
    fireEvent.click(screen.getByTestId('filter-tab-all'));

    await waitFor(() => {
      expect(screen.getByTestId('vendor-row-201')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-row-202')).toBeInTheDocument();
      expect(screen.getByTestId('vendor-row-203')).toBeInTheDocument();
    });
  });

  it('searches vendors by query', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendors-search-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('vendors-search-input'), {
      target: { value: 'Nexus' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('vendor-row-202')).toBeInTheDocument();
      expect(screen.queryByTestId('vendor-row-201')).not.toBeInTheDocument();
    });
  });

  it('confirms that NO working Delete button exists in the interface', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendor-row-201')).toBeInTheDocument();
    });

    // Verify there are no delete buttons on the page
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-vendor-201')).not.toBeInTheDocument();
  });

  it('confirms vendor credential security: no secret values or credentials are displayed or accepted', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendors-page')).toBeInTheDocument();
    });

    // Ensure no API keys, credentials, balances, or health rates appear in headers or rows
    const pageText = screen.getByTestId('vendors-page').textContent || '';
    expect(pageText).not.toContain('API Key');
    expect(pageText).not.toContain('Secret');
    expect(pageText).not.toContain('Token');
    expect(pageText).not.toContain('Password');
    expect(pageText).not.toContain('Health');
    expect(pageText).not.toContain('Balance:');
    expect(pageText).not.toContain('Success Rate');
  });

  it('renders both desktop table and mobile cards in the DOM', async () => {
    setupVendorFetch();

    render(
      <AuthProvider>
        <VendorsManagementView />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('vendors-table-container')).toBeInTheDocument();
    });

    // Desktop row
    expect(screen.getByTestId('vendor-row-201')).toBeInTheDocument();
    // Mobile card
    expect(screen.getByTestId('vendor-card-201')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-edit-201')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-toggle-201')).toBeInTheDocument();
  });
});
