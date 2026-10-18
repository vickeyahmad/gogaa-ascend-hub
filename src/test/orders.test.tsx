import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen, within } from '@testing-library/react';
import React, { act } from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { OrdersManagementView } from '../routes/orders';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type {
  AdminOrderSummaryDto,
  AdminOrderDetailDto,
} from '../lib/orders-api';

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

const sampleOrders: AdminOrderSummaryDto[] = [
  {
    orderNumber: 'ORD-20261018-0001',
    orderId: 101,
    customerId: 'cust-01',
    customerEmail: 'alice@example.com',
    customerName: 'Alice Johnson',
    productSummary: 'CHATGPT_PLUS_1M (1)',
    itemCount: 1,
    totalAmount: 1600,
    currency: 'PKR',
    status: 'Paid',
    salesChannel: 'Website',
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:05:00Z',
    paymentSummary: {
      paymentNumber: 'PAY-001',
      paymentMethod: 'CustomerWallet',
      paymentStatus: 'Paid',
      amountPaid: 1600,
      currency: 'PKR',
      paidAt: '2026-10-18T10:05:00Z',
    },
  },
  {
    orderNumber: 'ORD-20261018-0002',
    orderId: 102,
    customerId: 'cust-02',
    customerEmail: 'bob@example.com',
    customerName: 'Bob Miller',
    productSummary: 'CLAUDE_PRO_1M (2)',
    itemCount: 2,
    totalAmount: 5000,
    currency: 'PKR',
    status: 'PendingPayment',
    salesChannel: 'Telegram',
    createdAt: '2026-10-18T11:00:00Z',
    updatedAt: '2026-10-18T11:00:00Z',
    paymentSummary: null,
  },
  {
    orderNumber: 'ORD-20261018-0003',
    orderId: 103,
    customerId: 'cust-03',
    customerEmail: 'carol@example.com',
    customerName: 'Carol White',
    productSummary: 'NETFLIX_PREMIUM_1M (1)',
    itemCount: 1,
    totalAmount: 1200,
    currency: 'PKR',
    status: 'Processing',
    salesChannel: 'Smm',
    createdAt: '2026-10-18T12:00:00Z',
    updatedAt: '2026-10-18T12:15:00Z',
    paymentSummary: {
      paymentNumber: 'PAY-003',
      paymentMethod: 'BankTransfer',
      paymentStatus: 'Paid',
      amountPaid: 1200,
      currency: 'PKR',
      paidAt: '2026-10-18T12:10:00Z',
    },
  },
];

const sampleDetail: AdminOrderDetailDto = {
  orderNumber: 'ORD-20261018-0001',
  orderId: 101,
  customerId: 'cust-01',
  customerEmail: 'alice@example.com',
  customerName: 'Alice Johnson',
  customerPhoneNumber: '+923001234567',
  salesChannel: 'Website',
  status: 'Paid',
  subtotal: 1600,
  totalAmount: 1600,
  currency: 'PKR',
  customerNotes: 'Please deliver promptly to my telegram.',
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:05:00Z',
  items: [
    {
      productSku: 'CHATGPT_PLUS_1M',
      productName: 'ChatGPT Plus (1 Month)',
      quantity: 1,
      unitPrice: 1600,
      totalPrice: 1600,
      currency: 'PKR',
    },
  ],
  statusHistory: [
    {
      id: 1,
      previousStatus: null,
      newStatus: 'PendingPayment',
      reason: 'Order created by customer',
      changedByUserId: null,
      changedAt: '2026-10-18T10:00:00Z',
    },
    {
      id: 2,
      previousStatus: 'PendingPayment',
      newStatus: 'Paid',
      reason: 'Payment verified via wallet deduction',
      changedByUserId: 'SYSTEM',
      changedAt: '2026-10-18T10:05:00Z',
    },
  ],
  payments: [
    {
      paymentNumber: 'PAY-001',
      paymentMethod: 'CustomerWallet',
      amount: 1600,
      currency: 'PKR',
      status: 'Paid',
      createdAt: '2026-10-18T10:01:00Z',
      paidAt: '2026-10-18T10:05:00Z',
      expiredAt: null,
      providerTransactionId: 'WLT-TX-99881',
    },
  ],
};

function setupOrderFetch(
  orders: AdminOrderSummaryDto[] = sampleOrders.map((o) => ({ ...o })),
  detail: AdminOrderDetailDto = {
    ...sampleDetail,
    items: [...sampleDetail.items],
    statusHistory: [...sampleDetail.statusHistory],
    payments: [...sampleDetail.payments],
  }
) {
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
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // 2. POST /api/admin/orders/:orderNumber/start-processing
    const processMatch = url.match(/\/api\/admin\/orders\/([^/]+)\/start-processing$/);
    if (processMatch && method === 'POST') {
      const orderNumber = decodeURIComponent(processMatch[1]);
      let body: any = {};
      try {
        body = init?.body ? JSON.parse(init.body) : {};
      } catch {}

      const foundOrder = orders.find((o) => o.orderNumber === orderNumber);
      if (!foundOrder) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              message: `Order '${orderNumber}' was not found.`,
              data: null,
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (foundOrder.status !== 'Paid') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              message: `Cannot start processing. Current status is '${foundOrder.status}'. Only 'Paid' orders can be processed.`,
              data: null,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      foundOrder.status = 'Processing';

      const updatedDetail: AdminOrderDetailDto = {
        ...detail,
        orderNumber,
        status: 'Processing',
        statusHistory: [
          ...detail.statusHistory,
          {
            id: detail.statusHistory.length + 1,
            previousStatus: 'Paid',
            newStatus: 'Processing',
            reason: body.reason || 'Administrator started order processing.',
            changedByUserId: 'admin-001',
            changedAt: new Date().toISOString(),
          },
        ],
      };

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: `Order '${orderNumber}' transitioned to Processing successfully.`,
            data: updatedDetail,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // 3. GET /api/admin/orders/:orderNumber
    const singleMatch = url.match(/\/api\/admin\/orders\/([^?]+)$/);
    if (singleMatch && method === 'GET') {
      const orderNumber = decodeURIComponent(singleMatch[1]);
      if (orderNumber === detail.orderNumber) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Order details retrieved successfully.',
              data: detail,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            message: `Order '${orderNumber}' was not found.`,
            data: null,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // 3. GET /api/admin/orders (list)
    if (url.includes('/api/admin/orders') && method === 'GET') {
      let filtered = [...orders];

      // Status filter
      const statusMatch = url.match(/status=([^&]+)/);
      if (statusMatch) {
        const st = decodeURIComponent(statusMatch[1]);
        filtered = filtered.filter((o) => o.status === st);
      }

      // SalesChannel filter
      const channelMatch = url.match(/salesChannel=([^&]+)/);
      if (channelMatch) {
        const ch = decodeURIComponent(channelMatch[1]);
        filtered = filtered.filter((o) => o.salesChannel === ch);
      }

      // Customer / Order search
      const custMatch = url.match(/customerQuery=([^&]+)/);
      if (custMatch) {
        const q = decodeURIComponent(custMatch[1]).toLowerCase();
        filtered = filtered.filter(
          (o) =>
            (o.customerEmail && o.customerEmail.toLowerCase().includes(q)) ||
            (o.customerName && o.customerName.toLowerCase().includes(q)) ||
            o.customerId.toLowerCase().includes(q)
        );
      }

      const orderNoMatch = url.match(/orderNumber=([^&]+)/);
      if (orderNoMatch) {
        const q = decodeURIComponent(orderNoMatch[1]).toLowerCase();
        filtered = filtered.filter((o) => o.orderNumber.toLowerCase().includes(q));
      }

      const skuMatch = url.match(/productSku=([^&]+)/);
      if (skuMatch) {
        const q = decodeURIComponent(skuMatch[1]).toLowerCase();
        filtered = filtered.filter((o) => o.productSummary.toLowerCase().includes(q));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Orders retrieved.',
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
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ success: false }), { status: 404 })
    );
  });
}

describe('Orders Management View & Component Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCsrfToken();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users away from the Orders page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, message: 'Session expired', data: null }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <AuthProvider>
        <ProtectedRoute>
          <OrdersManagementView />
        </ProtectedRoute>
      </AuthProvider>
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
    let resolveOrders: any;
    const pendingOrders = new Promise((resolve) => {
      resolveOrders = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: mockAdminUser,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/api/admin/orders')) {
        return pendingOrders.then(() =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: [],
                page: 1,
                pageSize: 20,
                totalCount: 0,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    expect(screen.getByTestId('orders-loading-skeleton')).toBeInTheDocument();

    await act(async () => {
      resolveOrders();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('orders-loading-skeleton')).not.toBeInTheDocument();
    });
  });

  it('renders order list with accurate customer, channel, and financial details', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
      expect(screen.getByTestId('order-row-ORD-20261018-0002')).toBeInTheDocument();
      expect(screen.getByTestId('order-row-ORD-20261018-0003')).toBeInTheDocument();
    });

    // Verify row 1 details
    const row1 = screen.getByTestId('order-row-ORD-20261018-0001');
    expect(row1).toHaveTextContent('Alice Johnson');
    expect(row1).toHaveTextContent('alice@example.com');
    expect(row1).toHaveTextContent('1,600.00 PKR');
    expect(row1).toHaveTextContent('Web Storefront');
    expect(row1).toHaveTextContent('CustomerWallet');

    // Verify row 2 details
    const row2 = screen.getByTestId('order-row-ORD-20261018-0002');
    expect(row2).toHaveTextContent('Bob Miller');
    expect(row2).toHaveTextContent('bob@example.com');
    expect(row2).toHaveTextContent('5,000.00 PKR');
    expect(row2).toHaveTextContent('Telegram Bot');
    expect(row2).toHaveTextContent('Unpaid');
  });

  it('filters orders by status quick tab', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    // Click on "Awaiting Payment" status tab
    const pendingTab = screen.getByRole('tab', { name: 'Awaiting Payment' });
    await act(async () => {
      fireEvent.click(pendingTab);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('order-row-ORD-20261018-0001')).not.toBeInTheDocument();
      expect(screen.getByTestId('order-row-ORD-20261018-0002')).toBeInTheDocument();
      expect(screen.queryByTestId('order-row-ORD-20261018-0003')).not.toBeInTheDocument();
    });
  });

  it('filters orders by sales channel dropdown', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const channelSelect = screen.getByLabelText('Filter by sales channel');
    await act(async () => {
      fireEvent.change(channelSelect, { target: { value: 'Telegram' } });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('order-row-ORD-20261018-0001')).not.toBeInTheDocument();
      expect(screen.getByTestId('order-row-ORD-20261018-0002')).toBeInTheDocument();
    });
  });

  it('searches orders by order number or customer query', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search Order # or Customer...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'alice' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
      expect(screen.queryByTestId('order-row-ORD-20261018-0002')).not.toBeInTheDocument();
    });
  });

  it('filters orders by SKU snapshot', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const skuInput = screen.getByPlaceholderText('SKU Snapshot...');
    await act(async () => {
      fireEvent.change(skuInput, { target: { value: 'CLAUDE' } });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('order-row-ORD-20261018-0001')).not.toBeInTheDocument();
      expect(screen.getByTestId('order-row-ORD-20261018-0002')).toBeInTheDocument();
    });
  });

  it('displays empty state when database has 0 orders', async () => {
    setupOrderFetch([]);

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No orders in system')).toBeInTheDocument();
    });
  });

  it('displays filtered empty state when search matches nothing and clears filters', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search Order # or Customer...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent-customer-999' } });
    });

    await waitFor(() => {
      expect(screen.getByText('No matching orders found')).toBeInTheDocument();
    });

    // Clear filters
    const clearBtn = screen.getByRole('button', { name: 'Clear All Filters' });
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });
  });

  it('displays error banner on fetch failure and retries successfully', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: mockAdminUser }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/api/admin/orders')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, message: 'Database connection failed.' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: sampleOrders,
                page: 1,
                pageSize: 20,
                totalCount: sampleOrders.length,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('orders-error-banner')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });
  });

  it('refreshes orders list when clicking header refresh button', async () => {
    const fetchSpy = setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: 'Refresh orders' });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    await waitFor(() => {
      // 1 auth + 1 initial fetch + 1 refresh fetch = 3 calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  it('paginates orders when multiple pages exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: mockAdminUser }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/api/admin/orders')) {
        const isPage2 = url.includes('page=2');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: isPage2 ? [sampleOrders[2]] : [sampleOrders[0], sampleOrders[1]],
                page: isPage2 ? 2 : 1,
                pageSize: 2,
                totalCount: 3,
                totalPages: 2,
                hasPreviousPage: isPage2,
                hasNextPage: !isPage2,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: 'Next orders page' });
    expect(nextBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0003')).toBeInTheDocument();
      expect(screen.queryByTestId('order-row-ORD-20261018-0001')).not.toBeInTheDocument();
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
          new Response(JSON.stringify({ success: true, data: mockAdminUser }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (url.includes('/api/admin/orders')) {
        fetchCount++;
        if (fetchCount === 1) {
          // Initial GET returns all 3 orders
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  items: sampleOrders,
                  page: 1,
                  pageSize: 20,
                  totalCount: 3,
                  totalPages: 1,
                  hasPreviousPage: false,
                  hasNextPage: false,
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        if (fetchCount === 2) {
          // Delayed slow GET
          return staleGetPromise as Promise<Response>;
        }

        // Fast newer GET (fetchCount >= 3) returns only order 2
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: [sampleOrders[1]],
                page: 1,
                pageSize: 20,
                totalCount: 1,
                totalPages: 1,
                hasPreviousPage: false,
                hasNextPage: false,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    // Initial load finishes
    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
      expect(screen.getByTestId('order-row-ORD-20261018-0002')).toBeInTheDocument();
    });

    // Trigger second fetch (slow GET) by clicking refresh
    fireEvent.click(screen.getByTestId('refresh-orders-button'));

    // Trigger third fetch (fast newer GET) by changing sales channel
    const channelSelect = screen.getByLabelText('Filter by sales channel');
    fireEvent.change(channelSelect, { target: { value: 'Telegram' } });

    // Fast newer GET finishes and shows only order 2
    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0002')).toBeInTheDocument();
      expect(screen.queryByTestId('order-row-ORD-20261018-0001')).not.toBeInTheDocument();
    });

    // Now resolve the older slow GET that had all 3 orders
    resolveStaleGet(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: sampleOrders,
            page: 1,
            pageSize: 20,
            totalCount: 3,
            totalPages: 1,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    // Verify it still shows only order 2 and has NOT been overwritten by the stale slow GET
    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0002')).toBeInTheDocument();
      expect(screen.queryByTestId('order-row-ORD-20261018-0001')).not.toBeInTheDocument();
    });
  });

  it('opens OrderDetailDialog on clicking Details button and displays customer identity, items snapshot, and audit history', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const detailsBtn = screen.getByRole('button', {
      name: 'View details for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(detailsBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-detail-dialog')).toBeInTheDocument();
    });

    // Verify Customer Identity
    expect(screen.getByTestId('detail-customer-name')).toHaveTextContent('Alice Johnson');
    expect(screen.getByTestId('detail-customer-email')).toHaveTextContent('alice@example.com');
    expect(screen.getByTestId('detail-customer-phone')).toHaveTextContent('+923001234567');
    expect(screen.getByTestId('detail-customer-notes')).toHaveTextContent(
      'Please deliver promptly to my telegram.'
    );

    // Verify Historical Price Snapshot
    expect(screen.getByTestId('detail-items-table')).toBeInTheDocument();
    expect(screen.getByText('CHATGPT_PLUS_1M')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT Plus (1 Month)')).toBeInTheDocument();
    expect(screen.getByTestId('detail-total-amount')).toHaveTextContent('1,600.00 PKR');

    // Verify Status History Audit Trail
    expect(screen.getByText('Order Status History')).toBeInTheDocument();
    expect(screen.getByText(/Payment verified via wallet deduction/)).toBeInTheDocument();

    // Verify Verified Payment Attempts
    expect(screen.getByTestId('detail-payments-table')).toBeInTheDocument();
    expect(screen.getByText('WLT-TX-99881')).toBeInTheDocument();
  });

  it('guarantees that NO unauthorized order mutation buttons exist in the interface', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    // Open detail dialog
    const detailsBtn = screen.getByRole('button', {
      name: 'View details for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(detailsBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-detail-dialog')).toBeInTheDocument();
    });

    // STRICT VERIFICATION: None of the following unauthorized operations may exist as buttons
    expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refund/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit total/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adjust wallet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fulfill/i })).not.toBeInTheDocument();
  });

  it('renders mobile cards with responsive layout and inspect details button', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('orders-mobile-cards')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mobile-order-card-ORD-20261018-0001')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-order-card-ORD-20261018-0002')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-order-card-ORD-20261018-0003')).toBeInTheDocument();
  });

  /* =========================================================================
   * MILESTONE 6B-4B: CONTROLLED ADMIN ORDER PROCESSING TESTS
   * ========================================================================= */

  it('displays Start Processing button ONLY for Paid orders in table and mobile cards', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    // 1. Paid order ORD-20261018-0001 MUST have "Start Processing" button
    expect(
      screen.getByRole('button', { name: 'Start processing for ORD-20261018-0001' })
    ).toBeInTheDocument();

    // 2. PendingPayment order ORD-20261018-0002 MUST NOT have "Start Processing" button
    expect(
      screen.queryByRole('button', { name: 'Start processing for ORD-20261018-0002' })
    ).not.toBeInTheDocument();

    // 3. Already Processing order ORD-20261018-0003 MUST NOT have "Start Processing" button
    expect(
      screen.queryByRole('button', { name: 'Start processing for ORD-20261018-0003' })
    ).not.toBeInTheDocument();

    // 4. Mobile cards: check same status eligibility
    const mobilePaidCard = screen.getByTestId('mobile-order-card-ORD-20261018-0001');
    expect(mobilePaidCard.querySelector('button.bg-primary')).toHaveTextContent('Start Processing');

    const mobilePendingCard = screen.getByTestId('mobile-order-card-ORD-20261018-0002');
    expect(mobilePendingCard.querySelector('button.bg-primary')).toBeNull();

    const mobileProcessingCard = screen.getByTestId('mobile-order-card-ORD-20261018-0003');
    expect(mobileProcessingCard.querySelector('button.bg-primary')).toBeNull();
  });

  it('opens confirmation dialog when clicking Start Processing in table and displays accurate snapshot', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', {
      name: 'Start processing for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    // Verify dialog header and details
    expect(screen.getByText('Start Order Processing')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-order-number')).toHaveTextContent('ORD-20261018-0001');
    expect(screen.getByTestId('dialog-order-total')).toHaveTextContent('1,600.00 PKR');
    expect(
      within(screen.getByTestId('start-processing-dialog')).getByText('Alice Johnson')
    ).toBeInTheDocument();

    // Verify operational scope disclaimer
    expect(screen.getByText(/What this action does:/i)).toBeInTheDocument();
    expect(screen.getByText(/Does NOT mark order delivered/i)).toBeInTheDocument();

    // Test cancel dismisses dialog without mutating
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('start-processing-dialog')).not.toBeInTheDocument();
    });
  });

  it('validates processing reason character count in confirmation dialog', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', {
      name: 'Start processing for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('processing-reason-input');
    const counter = screen.getByTestId('character-counter');

    expect(counter).toHaveTextContent('0 / 500');

    // Valid text updates character count
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Verified customer payment via JazzCash' } });
    });
    expect(counter).toHaveTextContent('38 / 500');
    expect(screen.queryByText(/Processing reason cannot exceed 500 characters/i)).not.toBeInTheDocument();

    // Text exceeding 500 characters shows error and disables confirm button
    const overLimit = 'A'.repeat(501);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: overLimit } });
    });
    expect(counter).toHaveTextContent('501 / 500');
    expect(screen.getByText('Processing reason cannot exceed 500 characters.')).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('confirm-start-processing-btn');
    expect(confirmBtn).toBeDisabled();
  });

  it('submits Start Processing request with CSRF token and optional reason, updates UI and shows feedback banner', async () => {
    const fetchSpy = setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', {
      name: 'Start processing for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('processing-reason-input');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Verified payment and preparing delivery' } });
    });

    const confirmBtn = screen.getByTestId('confirm-start-processing-btn');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByTestId('start-processing-dialog')).not.toBeInTheDocument();
    });

    // Success feedback banner appears
    await waitFor(() => {
      expect(screen.getByTestId('order-processing-success-banner')).toBeInTheDocument();
      expect(screen.getByTestId('order-processing-success-banner')).toHaveTextContent(
        'Order ORD-20261018-0001 has been transitioned to Processing successfully.'
      );
    });

    // Start Processing button is no longer present for this order
    expect(
      screen.queryByRole('button', { name: 'Start processing for ORD-20261018-0001' })
    ).not.toBeInTheDocument();

    // Verify fetch call sent POST to start-processing
    const postCall = fetchSpy.mock.calls.find((call) =>
      call[0].includes('/api/admin/orders/ORD-20261018-0001/start-processing')
    );
    expect(postCall).toBeDefined();
    expect(postCall?.[1]?.method).toBe('POST');
    expect(JSON.parse(postCall?.[1]?.body)).toEqual({
      reason: 'Verified payment and preparing delivery',
    });

    // Dismiss success banner
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss success notice' });
    await act(async () => {
      fireEvent.click(dismissBtn);
    });
    expect(screen.queryByTestId('order-processing-success-banner')).not.toBeInTheDocument();
  });

  it('allows starting processing from OrderDetailDialog footer for Paid orders', async () => {
    setupOrderFetch();

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    // Open detail dialog
    const detailsBtn = screen.getByRole('button', {
      name: 'View details for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(detailsBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-detail-dialog')).toBeInTheDocument();
    });

    // Start Processing button should be visible in detail dialog footer for Paid order
    const detailFooterProcessingBtn = screen.getByRole('button', {
      name: 'Start Processing',
    });
    expect(detailFooterProcessingBtn).toBeInTheDocument();

    // Click it to open confirmation dialog
    await act(async () => {
      fireEvent.click(detailFooterProcessingBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    // Confirm transition
    const confirmBtn = screen.getByTestId('confirm-start-processing-btn');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('start-processing-dialog')).not.toBeInTheDocument();
    });

    // Details dialog closes and success banner is displayed
    await waitFor(() => {
      expect(screen.getByTestId('order-processing-success-banner')).toBeInTheDocument();
    });
  });

  it('prevents concurrent double clicks and disables buttons while submission is in flight', async () => {
    setInMemoryCsrfToken('test-csrf-token-xyz');
    let resolvePost: (value: any) => void;
    const slowPostPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: mockAdminUser }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/admin/orders') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: sampleOrders,
                page: 1,
                pageSize: 20,
                totalCount: sampleOrders.length,
                totalPages: 1,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/start-processing') && method === 'POST') {
        return slowPostPromise as Promise<Response>;
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', {
      name: 'Start processing for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId('confirm-start-processing-btn');

    // Click confirm to initiate in-flight request
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Both buttons should now be disabled to prevent double clicks
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveTextContent('Starting Processing...');

    // Resolve in-flight request
    await act(async () => {
      resolvePost!(
        new Response(
          JSON.stringify({
            success: true,
            data: { ...sampleDetail, status: 'Processing' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('start-processing-dialog')).not.toBeInTheDocument();
    });
  });

  it('handles 409 Conflict when order is concurrently transitioned and displays clear error feedback', async () => {
    setInMemoryCsrfToken('test-csrf-token-xyz');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: mockAdminUser }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/admin/orders') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: sampleOrders,
                page: 1,
                pageSize: 20,
                totalCount: sampleOrders.length,
                totalPages: 1,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/start-processing') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              message: "Order 'ORD-20261018-0001' is already in Processing status or was modified concurrently.",
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', {
      name: 'Start processing for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId('confirm-start-processing-btn');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Dialog stays open and shows the conflict message
    await waitFor(() => {
      expect(screen.getByTestId('start-processing-error-banner')).toBeInTheDocument();
      expect(screen.getByTestId('start-processing-error-banner')).toHaveTextContent(
        "Order 'ORD-20261018-0001' is already in Processing status or was modified concurrently."
      );
    });

    // Administrator can dismiss the dialog safely
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      fireEvent.click(cancelBtn);
    });
    expect(screen.queryByTestId('start-processing-dialog')).not.toBeInTheDocument();
  });

  it('handles ambiguous network failure and displays clear warning alert instead of auto-retrying', async () => {
    setInMemoryCsrfToken('test-csrf-token-xyz');
    let postCallCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: mockAdminUser }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/admin/orders') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: sampleOrders,
                page: 1,
                pageSize: 20,
                totalCount: sampleOrders.length,
                totalPages: 1,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/start-processing') && method === 'POST') {
        postCallCount++;
        // Simulate immediate network disconnect / fetch failure
        return Promise.reject(new TypeError('Failed to fetch'));
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', {
      name: 'Start processing for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId('confirm-start-processing-btn');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Ambiguous network warning alert is displayed
    await waitFor(() => {
      expect(screen.getByTestId('start-processing-ambiguous-alert')).toBeInTheDocument();
      expect(screen.getByTestId('start-processing-ambiguous-alert')).toHaveTextContent(
        /Network connection interrupted/i
      );
      expect(screen.getByTestId('start-processing-ambiguous-alert')).toHaveTextContent(
        /Do not re-submit this action blindly/i
      );
    });

    // Exactly one attempt was made — absolutely NO automatic blind retry
    expect(postCallCount).toBe(1);
  });

  it('regression: failed POST (400 Bad Request) NEVER changes order status from Paid to Processing and does not show success banner', async () => {
    setInMemoryCsrfToken('test-csrf-token-xyz');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: mockAdminUser }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/api/admin/orders') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: sampleOrders,
                page: 1,
                pageSize: 20,
                totalCount: sampleOrders.length,
                totalPages: 1,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      if (url.includes('/start-processing') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              message: 'Cannot start processing. Payment mismatch detected.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
    });

    render(
      <AuthProvider>
        <OrdersManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-row-ORD-20261018-0001')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', {
      name: 'Start processing for ORD-20261018-0001',
    });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-processing-dialog')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId('confirm-start-processing-btn');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Dialog stays open with error message
    await waitFor(() => {
      expect(screen.getByTestId('start-processing-error-banner')).toBeInTheDocument();
      expect(screen.getByTestId('start-processing-error-banner')).toHaveTextContent(
        'Cannot start processing. Payment mismatch detected.'
      );
    });

    // CRITICAL: Success banner must NOT appear
    expect(screen.queryByTestId('order-processing-success-banner')).not.toBeInTheDocument();

    // Close the dialog
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    // CRITICAL: Order status in the table MUST remain Paid, and "Start Processing" button MUST still be present
    const orderRow = screen.getByTestId('order-row-ORD-20261018-0001');
    expect(orderRow).toHaveTextContent('Paid');
    expect(
      screen.getByRole('button', { name: 'Start processing for ORD-20261018-0001' })
    ).toBeInTheDocument();
  });
});
