import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
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
  orders: AdminOrderSummaryDto[] = sampleOrders,
  detail: AdminOrderDetailDto = sampleDetail
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

    // 2. GET /api/admin/orders/:orderNumber
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

  it('guarantees that NO mutating order buttons exist in the interface', async () => {
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

    // STRICT VERIFICATION: None of the following mutating operations may exist as buttons
    expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start processing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refund/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit total/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adjust wallet/i })).not.toBeInTheDocument();
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
});
