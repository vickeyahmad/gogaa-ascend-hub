import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { FulfillmentManagementView } from '../routes/fulfillment';
import { setInMemoryCsrfToken } from '../lib/api-client';
import type {
  AdminFulfillmentSummaryDto,
  AdminOrderFulfillmentsDto,
  AdminFulfillmentCapabilitiesDto,
} from '../lib/fulfillments-api';

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

const sampleFulfillments: AdminFulfillmentSummaryDto[] = [
  {
    fulfillmentId: null,
    isInitialized: false,
    orderId: 101,
    orderNumber: 'ORD-20261019-001',
    orderItemId: 1,
    customerId: 'cust-1',
    customerEmail: 'alice@example.com',
    customerName: 'Alice Johnson',
    productSku: 'VAL-VP-1000',
    productName: '1000 Valorant Points',
    quantityRequested: 1,
    quantityFulfilled: 0,
    fulfillmentMethod: 'Unassigned',
    fulfillmentStatus: null,
    queueStatus: 'Uninitialized',
    orderStatus: 'Paid',
    attemptCount: 0,
    createdAt: '2026-10-19T08:00:00Z',
    updatedAt: '2026-10-19T08:00:00Z',
    completedAt: null,
  },
  {
    fulfillmentId: null,
    isInitialized: false,
    orderId: 102,
    orderNumber: 'ORD-20261019-002',
    orderItemId: 2,
    customerId: 'cust-2',
    customerEmail: 'bob@example.com',
    customerName: 'Bob Miller',
    productSku: 'PUBG-UC-600',
    productName: '600 PUBG UC',
    quantityRequested: 2,
    quantityFulfilled: 0,
    fulfillmentMethod: 'Unassigned',
    fulfillmentStatus: null,
    queueStatus: 'Uninitialized',
    orderStatus: 'Processing',
    attemptCount: 0,
    createdAt: '2026-10-19T08:30:00Z',
    updatedAt: '2026-10-19T08:30:00Z',
    completedAt: null,
  },
  {
    fulfillmentId: 301,
    isInitialized: true,
    orderId: 103,
    orderNumber: 'ORD-20261019-003',
    orderItemId: 3,
    customerId: 'cust-3',
    customerEmail: 'charlie@example.com',
    customerName: 'Charlie Brown',
    productSku: 'DISCORD-NITRO-1M',
    productName: 'Discord Nitro 1 Month',
    quantityRequested: 1,
    quantityFulfilled: 0,
    fulfillmentMethod: 'Manual',
    fulfillmentStatus: 'InProgress',
    queueStatus: 'InProgress',
    orderStatus: 'Processing',
    attemptCount: 1,
    createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:15:00Z',
    completedAt: null,
  },
  {
    fulfillmentId: 401,
    isInitialized: true,
    orderId: 104,
    orderNumber: 'ORD-20261019-004',
    orderItemId: 4,
    customerId: 'cust-4',
    customerEmail: 'diana@example.com',
    customerName: 'Diana Prince',
    productSku: 'MLBB-DIAMONDS-500',
    productName: '500 Mobile Legends Diamonds',
    quantityRequested: 1,
    quantityFulfilled: 0,
    fulfillmentMethod: 'VendorApi',
    fulfillmentStatus: 'RequiresReview',
    queueStatus: 'RequiresReview',
    orderStatus: 'Processing',
    attemptCount: 1,
    createdAt: '2026-10-19T09:30:00Z',
    updatedAt: '2026-10-19T09:45:00Z',
    completedAt: null,
  },
  {
    fulfillmentId: 501,
    isInitialized: true,
    orderId: 105,
    orderNumber: 'ORD-20261019-005',
    orderItemId: 5,
    customerId: 'cust-5',
    customerEmail: 'evan@example.com',
    customerName: 'Evan Wright',
    productSku: 'SPOTIFY-PREM-1M',
    productName: 'Spotify Premium 1 Month',
    quantityRequested: 1,
    quantityFulfilled: 1,
    fulfillmentMethod: 'Manual',
    fulfillmentStatus: 'Completed',
    queueStatus: 'Completed',
    orderStatus: 'Completed',
    attemptCount: 1,
    createdAt: '2026-10-19T07:00:00Z',
    updatedAt: '2026-10-19T07:30:00Z',
    completedAt: '2026-10-19T07:30:00Z',
  },
];

const sampleOrderFulfillmentsMap: Record<string, AdminOrderFulfillmentsDto> = {
  'ORD-20261019-001': {
    orderNumber: 'ORD-20261019-001',
    orderId: 101,
    orderStatus: 'Paid',
    fulfillments: [],
  },
  'ORD-20261019-002': {
    orderNumber: 'ORD-20261019-002',
    orderId: 102,
    orderStatus: 'Processing',
    fulfillments: [],
  },
  'ORD-20261019-003': {
    orderNumber: 'ORD-20261019-003',
    orderId: 103,
    orderStatus: 'Processing',
    fulfillments: [
      {
        fulfillmentId: 301,
        orderId: 103,
        orderItemId: 3,
        productSku: 'DISCORD-NITRO-1M',
        productName: 'Discord Nitro 1 Month',
        unitPrice: 2500,
        currency: 'PKR',
        quantityRequested: 1,
        quantityFulfilled: 0,
        status: 'InProgress',
        fulfillmentMethod: 'Manual',
        createdAt: '2026-10-19T09:00:00Z',
        updatedAt: '2026-10-19T09:15:00Z',
        completedAt: null,
        attempts: [
          {
            attemptId: 1001,
            attemptNumber: 1,
            attemptKey: 'ATT-20261019-003-1',
            isManual: true,
            vendorProductId: null,
            vendorId: null,
            vendorName: null,
            status: 'Submitted',
            externalVendorOrderId: null,
            failureCategory: null,
            safeErrorSummary: null,
            deliveryReference: null,
            deliveryChannel: 'Discord DM',
            notes: 'Staff dispatched token code',
            initiatedByUserId: 'admin-001',
            confirmedByUserId: null,
            createdAt: '2026-10-19T09:15:00Z',
            submittedAt: '2026-10-19T09:15:00Z',
            completedAt: null,
          },
        ],
        statusHistory: [
          {
            id: 2001,
            fulfillmentId: 301,
            previousStatus: 'NotStarted',
            newStatus: 'InProgress',
            reason: 'Manual fulfillment started by administrator',
            changedByUserId: 'admin-001',
            changedAt: '2026-10-19T09:15:00Z',
          },
        ],
      },
    ],
  },
  'ORD-20261019-004': {
    orderNumber: 'ORD-20261019-004',
    orderId: 104,
    orderStatus: 'Processing',
    fulfillments: [
      {
        fulfillmentId: 401,
        orderId: 104,
        orderItemId: 4,
        productSku: 'MLBB-DIAMONDS-500',
        productName: '500 Mobile Legends Diamonds',
        unitPrice: 1500,
        currency: 'PKR',
        quantityRequested: 1,
        quantityFulfilled: 0,
        status: 'RequiresReview',
        fulfillmentMethod: 'VendorApi',
        createdAt: '2026-10-19T09:30:00Z',
        updatedAt: '2026-10-19T09:45:00Z',
        completedAt: null,
        attempts: [
          {
            attemptId: 1002,
            attemptNumber: 1,
            attemptKey: 'ATT-20261019-004-1',
            isManual: false,
            vendorProductId: 55,
            vendorId: 3,
            vendorName: 'Moogold Gateway',
            status: 'Unknown',
            externalVendorOrderId: 'MG-998822',
            failureCategory: 'NetworkTimeout',
            safeErrorSummary: 'Supplier gateway socket timed out after 30000ms. Outcome unknown.',
            deliveryReference: null,
            deliveryChannel: 'API',
            notes: null,
            initiatedByUserId: 'system',
            confirmedByUserId: null,
            createdAt: '2026-10-19T09:30:00Z',
            submittedAt: '2026-10-19T09:30:00Z',
            completedAt: null,
          },
        ],
        statusHistory: [
          {
            id: 2002,
            fulfillmentId: 401,
            previousStatus: 'InProgress',
            newStatus: 'RequiresReview',
            reason: 'Ambiguous network timeout during vendor dispatch',
            changedByUserId: 'system',
            changedAt: '2026-10-19T09:45:00Z',
          },
        ],
      },
    ],
  },
  'ORD-20261019-005': {
    orderNumber: 'ORD-20261019-005',
    orderId: 105,
    orderStatus: 'Completed',
    fulfillments: [
      {
        fulfillmentId: 501,
        orderId: 105,
        orderItemId: 5,
        productSku: 'SPOTIFY-PREM-1M',
        productName: 'Spotify Premium 1 Month',
        unitPrice: 950,
        currency: 'PKR',
        quantityRequested: 1,
        quantityFulfilled: 1,
        status: 'Completed',
        fulfillmentMethod: 'Manual',
        createdAt: '2026-10-19T07:00:00Z',
        updatedAt: '2026-10-19T07:30:00Z',
        completedAt: '2026-10-19T07:30:00Z',
        attempts: [
          {
            attemptId: 1003,
            attemptNumber: 1,
            attemptKey: 'ATT-20261019-005-1',
            isManual: true,
            vendorProductId: null,
            vendorId: null,
            vendorName: null,
            status: 'Succeeded',
            externalVendorOrderId: null,
            failureCategory: null,
            safeErrorSummary: null,
            deliveryReference: 'SPOT-INV-8877',
            deliveryChannel: 'Customer Email',
            notes: 'Invite link delivered successfully',
            initiatedByUserId: 'admin-001',
            confirmedByUserId: 'admin-001',
            createdAt: '2026-10-19T07:15:00Z',
            submittedAt: '2026-10-19T07:15:00Z',
            completedAt: '2026-10-19T07:30:00Z',
          },
        ],
        statusHistory: [
          {
            id: 2003,
            fulfillmentId: 501,
            previousStatus: 'InProgress',
            newStatus: 'Completed',
            reason: 'Manual fulfillment confirmed by administrator',
            changedByUserId: 'admin-001',
            changedAt: '2026-10-19T07:30:00Z',
          },
        ],
      },
    ],
  },
};

function setupFulfillmentFetch(
  fulfillments: AdminFulfillmentSummaryDto[] = sampleFulfillments.map((f) => ({ ...f })),
  orderMap: Record<string, AdminOrderFulfillmentsDto> = { ...sampleOrderFulfillmentsMap },
  capabilitiesOverride?:
    | Partial<AdminFulfillmentCapabilitiesDto>
    | ((sku: string | null) => Partial<AdminFulfillmentCapabilitiesDto>)
) {
  setInMemoryCsrfToken('test-csrf-token-xyz');

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
    const url = typeof input === 'string' ? input : input.url;

    // Admin current user profile check
    if (url.includes('/api/admin/auth/me')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: mockAdminUser,
            message: 'Authenticated',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // Operational Capabilities endpoint: /api/admin/fulfillment-capabilities
    if (url.includes('/api/admin/fulfillment-capabilities')) {
      const parsedUrl = new URL(url, 'http://localhost');
      const productSku = parsedUrl.searchParams.get('productSku');

      const defaultCaps: AdminFulfillmentCapabilitiesDto = {
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Manual fulfillment is disabled by server configuration.',
        isProductApproved: productSku ? false : null,
      };

      const resolved =
        typeof capabilitiesOverride === 'function'
          ? capabilitiesOverride(productSku)
          : (capabilitiesOverride ?? {});

      const finalCaps: AdminFulfillmentCapabilitiesDto = {
        ...defaultCaps,
        ...resolved,
        ...(productSku !== null && resolved.isProductApproved !== undefined
          ? { isProductApproved: resolved.isProductApproved }
          : {}),
      };

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: finalCaps,
            message: 'Fulfillment capabilities retrieved successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // Order-specific fulfillments endpoint: /api/admin/orders/:orderNumber/fulfillments
    const orderMatch = url.match(/\/api\/admin\/orders\/([^/]+)\/fulfillments/);
    if (orderMatch) {
      const orderNumber = decodeURIComponent(orderMatch[1]);
      const orderDto = orderMap[orderNumber];

      if (!orderDto) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              data: null,
              message: `Order '${orderNumber}' was not found.`,
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: orderDto,
            message: 'Order fulfillments retrieved successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // Global fulfillment work queue: /api/admin/fulfillments
    if (url.includes('/api/admin/fulfillments')) {
      const parsedUrl = new URL(url, 'http://localhost');
      const status = parsedUrl.searchParams.get('status');
      const fulfillmentMethod = parsedUrl.searchParams.get('fulfillmentMethod');
      const orderStatus = parsedUrl.searchParams.get('orderStatus');
      const search = parsedUrl.searchParams.get('search');
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(parsedUrl.searchParams.get('pageSize') || '20', 10);

      let filtered = [...fulfillments];

      if (status && status !== 'all') {
        filtered = filtered.filter(
          (f) => f.queueStatus.toLowerCase() === status.toLowerCase()
        );
      }
      if (fulfillmentMethod && fulfillmentMethod !== 'all') {
        filtered = filtered.filter(
          (f) => f.fulfillmentMethod.toLowerCase() === fulfillmentMethod.toLowerCase()
        );
      }
      if (orderStatus && orderStatus !== 'all') {
        filtered = filtered.filter(
          (f) => f.orderStatus.toLowerCase() === orderStatus.toLowerCase()
        );
      }
      if (search) {
        const clean = search.toLowerCase();
        filtered = filtered.filter(
          (f) =>
            f.orderNumber.toLowerCase().includes(clean) ||
            f.productSku.toLowerCase().includes(clean) ||
            f.productName.toLowerCase().includes(clean) ||
            (f.customerName && f.customerName.toLowerCase().includes(clean)) ||
            (f.customerEmail && f.customerEmail.toLowerCase().includes(clean))
        );
      }

      const totalCount = filtered.length;
      const totalPages = Math.ceil(totalCount / pageSize) || 1;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items,
              page,
              pageSize,
              totalCount,
              totalPages,
              hasPreviousPage: page > 1,
              hasNextPage: page < totalPages,
            },
            message: 'Fulfillments retrieved successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    return Promise.resolve(
      new Response(
        JSON.stringify({ success: false, data: null, message: 'Endpoint not mocked' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    );
  });
}

describe('Fulfillment Work Queue View', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  it('renders the Fulfillment Work Queue page for authenticated administrator with authoritative heading', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Fulfillment Work Queue/i })).toBeInTheDocument();
    });

    const readOnlyBadges = screen.getAllByText('Read-Only');
    expect(readOnlyBadges.length).toBeGreaterThan(0);
  });

  it('calls correct global work queue endpoint GET /api/admin/fulfillments', async () => {
    const fetchSpy = setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const fulfillmentsCall = fetchSpy.mock.calls.find((call) =>
      (typeof call[0] === 'string' ? call[0] : call[0].url).includes('/api/admin/fulfillments')
    );
    expect(fulfillmentsCall).toBeDefined();
    const callUrl = typeof fulfillmentsCall![0] === 'string' ? fulfillmentsCall![0] : fulfillmentsCall![0].url;
    expect(callUrl).toContain('/api/admin/fulfillments');
  });

  it('identifies and clearly labels Uninitialized work with null fulfillmentId and no invented records', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const uninitRow = screen.getByTestId('fulfillment-row-ORD-20261019-001-1');
    expect(uninitRow).toBeInTheDocument();
    expect(uninitRow).toHaveTextContent('Uninitialized');
    expect(uninitRow).toHaveTextContent('Awaiting Init');
    expect(uninitRow).toHaveTextContent('0 / 1');
    expect(uninitRow).toHaveTextContent('Unassigned');
    expect(uninitRow).not.toHaveTextContent('#null');
  });

  it('distinguishes Paid orders from active Processing orders (Paid marked Not in Processing)', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const paidRow = screen.getByTestId('fulfillment-row-ORD-20261019-001-1');
    expect(paidRow).toHaveTextContent('Paid');
    expect(paidRow).toHaveTextContent('Not in Processing');

    const procRow = screen.getByTestId('fulfillment-row-ORD-20261019-002-2');
    expect(procRow).toHaveTextContent('Processing');
    expect(procRow).not.toHaveTextContent('Not in Processing');
  });

  it('correctly displays historical Completed fulfillment records', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-005')[0]).toBeInTheDocument();
    });

    const completedRow = screen.getByTestId('fulfillment-row-ORD-20261019-005-5');
    expect(completedRow).toHaveTextContent('Completed');
    expect(completedRow).toHaveTextContent('1 / 1');
    expect(completedRow).toHaveTextContent('Manual');
  });

  it('filters work queue when clicking "Needs Initialization" quick view tab', async () => {
    const fetchSpy = setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const needsInitTab = screen.getByRole('tab', { name: 'Needs Initialization' });
    fireEvent.click(needsInitTab);

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => (typeof c[0] === 'string' ? c[0] : c[0].url));
      const hasNeedsInitCall = calls.some(
        (url) => url.includes('status=Uninitialized') && url.includes('orderStatus=Processing')
      );
      expect(hasNeedsInitCall).toBe(true);
    });

    expect(screen.getAllByText('ORD-20261019-002')[0]).toBeInTheDocument();
    expect(screen.queryAllByText('ORD-20261019-001')).toHaveLength(0);
  });

  it('filters work queue by method dropdown', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const methodFilter = screen.getByLabelText('Filter by fulfillment method');
    fireEvent.change(methodFilter, { target: { value: 'VendorApi' } });

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-004')[0]).toBeInTheDocument();
      expect(screen.queryAllByText('ORD-20261019-003')).toHaveLength(0);
    });
  });

  it('filters work queue by parent order status dropdown', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const orderStatusFilter = screen.getByLabelText('Filter by parent order status');
    fireEvent.change(orderStatusFilter, { target: { value: 'Paid' } });

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
      expect(screen.queryAllByText('ORD-20261019-002')).toHaveLength(0);
      expect(screen.queryAllByText('ORD-20261019-003')).toHaveLength(0);
    });
  });

  it('searches work queue by SKU or order query', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search fulfillment work queue');
    fireEvent.change(searchInput, { target: { value: 'DISCORD-NITRO-1M' } });

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-003')[0]).toBeInTheDocument();
      expect(screen.queryAllByText('ORD-20261019-001')).toHaveLength(0);
      expect(screen.queryAllByText('ORD-20261019-002')).toHaveLength(0);
    });
  });

  it('displays empty state when database has 0 fulfillment records', async () => {
    setupFulfillmentFetch([]);

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fulfillment-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Fulfillment Work Recorded')).toBeInTheDocument();
    });
  });

  it('displays filtered empty state when search matches nothing and allows clearing filters', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search fulfillment work queue');
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT-SKU-999' } });

    await waitFor(() => {
      expect(screen.getByText('No matching fulfillment work found')).toBeInTheDocument();
    });

    const clearButton = screen.getAllByRole('button', { name: /Clear Filters/i })[0];
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });
  });

  it('handles server-side pagination and displays accurate total count', async () => {
    const manyItems: AdminFulfillmentSummaryDto[] = Array.from({ length: 25 }, (_, i) => ({
      ...sampleFulfillments[0],
      orderId: 1000 + i,
      orderNumber: `ORD-PAGINATE-${i + 1}`,
      orderItemId: i + 1,
      productSku: `SKU-${i + 1}`,
    }));

    setupFulfillmentFetch(manyItems);

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-PAGINATE-1')[0]).toBeInTheDocument();
      expect(screen.getByTestId('total-count')).toHaveTextContent('25');
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getAllByText('ORD-PAGINATE-21')[0]).toBeInTheDocument();
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    });
  });

  it('displays error banner on fetch failure and retries successfully', async () => {
    let shouldFail = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: mockAdminUser, message: 'Authenticated' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/admin/fulfillment-capabilities')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                isGloballyEnabled: false,
                hasProductAllowlistPolicy: false,
                approvedProductCount: 0,
                isEffectivelyAvailable: false,
                statusMessage: 'Manual fulfillment is disabled by server configuration.',
                isProductApproved: null,
              },
              message: 'Fulfillment capabilities retrieved successfully.',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/admin/fulfillments')) {
        if (shouldFail) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, data: null, message: 'Internal Server Error' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: sampleFulfillments,
                page: 1,
                pageSize: 20,
                totalCount: 5,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              },
              message: 'Retrieved',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fulfillment-error-banner')).toBeInTheDocument();
    });

    shouldFail = false;
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });
  });

  it('opens FulfillmentDetailDialog on clicking Details button and loads order fulfillments', async () => {
    const fetchSpy = setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-003')[0]).toBeInTheDocument();
    });

    const row = screen.getByTestId('fulfillment-row-ORD-20261019-003-3');
    const detailsBtn = row.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('fulfillment-detail-dialog')).toBeInTheDocument();
    });

    const calls = fetchSpy.mock.calls.map((c) => (typeof c[0] === 'string' ? c[0] : c[0].url));
    expect(calls.some((url) => url.includes('/api/admin/orders/ORD-20261019-003/fulfillments'))).toBe(true);

    expect(screen.getByTestId('attempt-card-1')).toHaveTextContent('ATT-20261019-003-1');
    expect(screen.getByTestId('attempt-card-1')).toHaveTextContent('Discord DM');
    expect(screen.getByTestId('attempt-card-1')).toHaveTextContent('Staff dispatched token code');
    expect(screen.getByTestId('status-history-list')).toHaveTextContent('Manual fulfillment started by administrator');
  });

  it('handles completely uninitialized orders in Details dialog gracefully without false 404', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
    });

    const row = screen.getByTestId('fulfillment-row-ORD-20261019-001-1');
    const detailsBtn = row.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('dialog-uninitialized-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Uninitialized Fulfillment Work')).toBeInTheDocument();
    expect(screen.getByText(/No persisted fulfillment database record exists/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dialog-error-banner')).not.toBeInTheDocument();
  });

  it('displays safe error summaries and failure categories for ambiguous attempts without leaking credentials', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-004')[0]).toBeInTheDocument();
    });

    const row = screen.getByTestId('fulfillment-row-ORD-20261019-004-4');
    const detailsBtn = row.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('attempt-card-1')).toBeInTheDocument();
    });

    const attemptCard = screen.getByTestId('attempt-card-1');
    expect(attemptCard).toHaveTextContent('NetworkTimeout');
    expect(attemptCard).toHaveTextContent('Supplier gateway socket timed out after 30000ms. Outcome unknown.');
    expect(attemptCard).toHaveTextContent('Moogold Gateway');
    expect(attemptCard).toHaveTextContent('MG-998822');

    expect(attemptCard).not.toHaveTextContent('apiKey');
    expect(attemptCard).not.toHaveTextContent('password');
    expect(attemptCard).not.toHaveTextContent('wholesaleCost');
  });

  it('safeguards against stale data when switching between orders rapidly', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-003')[0]).toBeInTheDocument();
    });

    // Open first order
    const row1 = screen.getByTestId('fulfillment-row-ORD-20261019-003-3');
    const btn1 = row1.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(btn1);

    await waitFor(() => {
      expect(screen.getByText('ATT-20261019-003-1')).toBeInTheDocument();
    });

    // Close and open second order
    const closeBtn = screen.getAllByRole('button', { name: 'Close' })[0];
    fireEvent.click(closeBtn);

    const row2 = screen.getByTestId('fulfillment-row-ORD-20261019-004-4');
    const btn2 = row2.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(btn2);

    await waitFor(() => {
      expect(screen.getByText('ATT-20261019-004-1')).toBeInTheDocument();
      expect(screen.queryByText('ATT-20261019-003-1')).not.toBeInTheDocument();
    });
  });

  it('navigates to Orders Management when clicking "View in Orders Management" in detail dialog', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-003')[0]).toBeInTheDocument();
    });

    const row = screen.getByTestId('fulfillment-row-ORD-20261019-003-3');
    const detailsBtn = row.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View in Orders Management/i })).toBeInTheDocument();
    });

    const ordersNavBtn = screen.getByRole('button', { name: /View in Orders Management/i });
    fireEvent.click(ordersNavBtn);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/orders' });
  });

  it('guarantees that NO fulfillment or financial mutation controls exist anywhere in the interface', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-003')[0]).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Start Manual Fulfillment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Manual Fulfillment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Delivered/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Completed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry Vendor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Fulfillment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refund/i })).not.toBeInTheDocument();

    const row = screen.getByTestId('fulfillment-row-ORD-20261019-003-3');
    const detailsBtn = row.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('fulfillment-detail-dialog')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Start Manual Fulfillment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Manual Fulfillment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Delivered/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Completed/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry Vendor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Fulfillment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refund/i })).not.toBeInTheDocument();
  });

  it('renders mobile cards with responsive layout and inspect details buttons', async () => {
    setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('fulfillment-card-ORD-20261019-001-1')).toBeInTheDocument();
      expect(screen.getByTestId('fulfillment-card-ORD-20261019-003-3')).toBeInTheDocument();
    });
  });

  it('renders global capabilities banner on the work queue page and re-fetches when header refresh is clicked', async () => {
    const fetchSpy = setupFulfillmentFetch();

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-001')[0]).toBeInTheDocument();
      expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      expect(screen.getByTestId('metric-global-switch')).toHaveTextContent('Disabled');
      expect(screen.getByTestId('capability-effective-status')).toHaveTextContent('Manual Fulfillment Unavailable');
    });

    // Count calls to /api/admin/fulfillment-capabilities
    const capabilityCallsBefore = fetchSpy.mock.calls.filter((c: any) =>
      (typeof c[0] === 'string' ? c[0] : c[0].url).includes('/api/admin/fulfillment-capabilities')
    ).length;
    expect(capabilityCallsBefore).toBeGreaterThanOrEqual(1);

    // Click header refresh button
    const refreshBtn = screen.getByRole('button', { name: /Refresh fulfillment queue/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      const capabilityCallsAfter = fetchSpy.mock.calls.filter((c: any) =>
        (typeof c[0] === 'string' ? c[0] : c[0].url).includes('/api/admin/fulfillment-capabilities')
      ).length;
      expect(capabilityCallsAfter).toBeGreaterThan(capabilityCallsBefore);
    });
  });

  it('displays product capability status in FulfillmentDetailDialog for inspected order items', async () => {
    setupFulfillmentFetch(
      sampleFulfillments.map((f) => ({ ...f })),
      { ...sampleOrderFulfillmentsMap },
      (sku) => ({
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: true,
        approvedProductCount: 1,
        isEffectivelyAvailable: true,
        statusMessage: 'Manual fulfillment is active for 1 approved product(s).',
        isProductApproved: sku === 'DISCORD-NITRO-1M',
      })
    );

    render(
      <AuthProvider>
        <FulfillmentManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('ORD-20261019-003')[0]).toBeInTheDocument();
    });

    const row = screen.getByTestId('fulfillment-row-ORD-20261019-003-3');
    const detailsBtn = row.querySelector('button[title*="Inspect details"]') as HTMLElement;
    fireEvent.click(detailsBtn);

    await waitFor(() => {
      expect(screen.getByTestId('fulfillment-detail-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('product-capability-section')).toBeInTheDocument();
      expect(screen.getByTestId('product-approval-badge')).toHaveTextContent('Product Approved for Pilot');
    });
  });
});
