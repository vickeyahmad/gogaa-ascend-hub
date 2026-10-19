import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React, { act } from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { PaymentsManagementView } from '../routes/payments';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type { AdminPaymentSummaryDto, AdminPaymentDetailDto } from '../lib/payments-api';

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

const samplePayments: AdminPaymentSummaryDto[] = [
  {
    id: 1,
    paymentNumber: 'PAY-20261018-0001',
    purpose: 'OrderPurchase',
    customerId: 'cust-01',
    customerEmail: 'alice@example.com',
    customerFullName: 'Alice Johnson',
    orderNumber: 'ORD-20261018-001',
    walletId: null,
    amount: 5000,
    currency: 'PKR',
    paymentMethodCode: 'BANK_TRANSFER',
    status: 'Paid',
    createdAt: '2026-10-18T09:20:00Z',
    updatedAt: '2026-10-18T09:35:00Z',
    paidAt: '2026-10-18T09:35:00Z',
  },
  {
    id: 2,
    paymentNumber: 'PAY-20261018-0002',
    purpose: 'WalletTopUp',
    customerId: 'cust-02',
    customerEmail: 'bob@example.com',
    customerFullName: 'Bob Miller',
    orderNumber: null,
    walletId: 102,
    amount: 15000,
    currency: 'PKR',
    paymentMethodCode: 'JAZZCASH',
    status: 'Pending',
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:00:00Z',
    paidAt: null,
  },
  {
    id: 3,
    paymentNumber: 'PAY-20261018-0003',
    purpose: 'OrderPurchase',
    customerId: 'cust-03',
    customerEmail: 'carol@example.com',
    customerFullName: 'Carol White',
    orderNumber: 'ORD-20261018-002',
    walletId: null,
    amount: 2500,
    currency: 'PKR',
    paymentMethodCode: 'EASYPAISA',
    status: 'Failed',
    createdAt: '2026-10-18T11:00:00Z',
    updatedAt: '2026-10-18T11:20:00Z',
    paidAt: null,
  },
];

const sampleDetail: AdminPaymentDetailDto = {
  id: 1,
  paymentNumber: 'PAY-20261018-0001',
  purpose: 'OrderPurchase',
  customerId: 'cust-01',
  customerEmail: 'alice@example.com',
  customerFullName: 'Alice Johnson',
  orderId: 10,
  orderNumber: 'ORD-20261018-001',
  walletId: null,
  amount: 5000,
  currency: 'PKR',
  paymentMethodCode: 'BANK_TRANSFER',
  status: 'Paid',
  providerTransactionId: 'BANK-TRX-778899',
  customerReference: 'MEZN-REF-112233',
  customerTransferDate: '2026-10-18T09:30:00Z',
  customerSenderAccount: '***4567',
  customerNotes: 'Paid for software license.',
  customerProofSubmittedAt: '2026-10-18T09:32:00Z',
  verifiedByUserId: 'admin-001',
  verifiedByUserName: 'Gogaa Admin',
  verifiedReceivingAccount: '***9988',
  adminNotes: 'Direct bank transfer matched statement.',
  verifiedAt: '2026-10-18T09:35:00Z',
  createdAt: '2026-10-18T09:20:00Z',
  updatedAt: '2026-10-18T09:35:00Z',
  paidAt: '2026-10-18T09:35:00Z',
  statusHistory: [
    {
      id: 101,
      previousStatus: null,
      newStatus: 'Pending',
      reason: 'Order checkout initiated.',
      changedByUserId: 'cust-01',
      changedByUserName: 'Alice Johnson',
      changedAt: '2026-10-18T09:20:00Z',
    },
    {
      id: 102,
      previousStatus: 'Pending',
      newStatus: 'Paid',
      reason: 'Payment verified by administrator.',
      changedByUserId: 'admin-001',
      changedByUserName: 'Gogaa Admin',
      changedAt: '2026-10-18T09:35:00Z',
    },
  ],
};

function setupPaymentFetch(
  payments: AdminPaymentSummaryDto[] = samplePayments.map((p) => ({ ...p })),
  detail: AdminPaymentDetailDto = { ...sampleDetail }
) {
  setInMemoryCsrfToken('test-csrf-token-xyz');

  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
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

    // Single payment detail
    if (url.includes('/api/admin/payments/PAY-20261018-0001')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: detail,
            message: 'Payment details retrieved successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // Payments list with query parsing
    if (url.includes('/api/admin/payments')) {
      const parsedUrl = new URL(url, 'http://localhost');
      const status = parsedUrl.searchParams.get('status');
      const purpose = parsedUrl.searchParams.get('purpose');
      const paymentMethod = parsedUrl.searchParams.get('paymentMethod');
      const search = parsedUrl.searchParams.get('search');
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(parsedUrl.searchParams.get('pageSize') || '20', 10);

      let filtered = [...payments];

      if (status && status !== 'all') {
        filtered = filtered.filter((p) => p.status.toLowerCase() === status.toLowerCase());
      }
      if (purpose && purpose !== 'all') {
        filtered = filtered.filter((p) => p.purpose.toLowerCase() === purpose.toLowerCase());
      }
      if (paymentMethod && paymentMethod !== 'all') {
        filtered = filtered.filter(
          (p) => p.paymentMethodCode.toLowerCase() === paymentMethod.toLowerCase()
        );
      }
      if (search) {
        const cleanSearch = search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.paymentNumber.toLowerCase().includes(cleanSearch) ||
            (p.customerFullName && p.customerFullName.toLowerCase().includes(cleanSearch)) ||
            (p.customerEmail && p.customerEmail.toLowerCase().includes(cleanSearch))
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
            message: 'Payments retrieved successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ success: false, message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
}

describe('Payments Overview View & Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCsrfToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users away from the Payments page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(
      <AuthProvider>
        <ProtectedRoute>
          <PaymentsManagementView />
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });
  });

  it('renders the Payments page for authenticated administrator with authoritative heading', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    expect(
      await screen.findByRole('heading', { name: /Payments Overview/i, level: 1 })
    ).toBeInTheDocument();
    const badge = screen.getByText('Read-Only');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('.admin-badge-live')).toBeInTheDocument();
  });

  it('calls correct payment-list endpoint GET /api/admin/payments and renders rows', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
      expect(screen.getAllByText('PAY-20261018-0002')[0]).toBeInTheDocument();
      expect(screen.getAllByText('PAY-20261018-0003')[0]).toBeInTheDocument();
    });

    const getPaymentsCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).includes('/api/admin/payments')
    );
    expect(getPaymentsCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('correctly displays payment purposes distinguishing OrderPurchase and WalletTopUp', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    // Multiple instances in desktop table and mobile cards
    const orderPurchaseBadges = screen.getAllByText('Order Purchase');
    expect(orderPurchaseBadges.length).toBeGreaterThanOrEqual(1);

    const walletTopUpBadges = screen.getAllByText('Wallet Top-Up');
    expect(walletTopUpBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays authoritative status badges', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    // We have Paid, Pending, and Failed
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
  });

  it('filters payments by status tab when clicked', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    const paidTab = screen.getByRole('button', { name: /^Paid$/i });
    await act(async () => {
      fireEvent.click(paidTab);
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('status=Paid'))).toBe(true);
    });
  });

  it('filters payments by purpose dropdown', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    const purposeSelect = screen.getByLabelText(/filter by purpose/i);
    await act(async () => {
      fireEvent.change(purposeSelect, { target: { value: 'WalletTopUp' } });
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('purpose=WalletTopUp'))).toBe(true);
    });
  });

  it('filters payments by payment method dropdown', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    const methodSelect = screen.getByLabelText(/filter by payment method/i);
    await act(async () => {
      fireEvent.change(methodSelect, { target: { value: 'JAZZCASH' } });
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('paymentMethod=JAZZCASH'))).toBe(true);
    });
  });

  it('searches payments by query', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search payments/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'alice' } });
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('search=alice'))).toBe(true);
    });
  });

  it('displays empty state when search matches nothing and allows clearing filters', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search payments/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent-xyz-query' } });
    });

    expect(await screen.findByText(/No matching payments found/i)).toBeInTheDocument();

    const clearBtn = screen.getAllByRole('button', { name: /clear filters/i })[0];
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });
  });

  it('displays server error state when retrieval fails and allows retry', async () => {
    let failOnce = true;
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
      if (url.includes('/api/admin/payments')) {
        if (failOnce) {
          failOnce = false;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                message: 'Database connection failed.',
              }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: samplePayments,
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
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    expect(await screen.findByText(/Failed to load payments/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry retrieval/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });
  });

  it('refreshes payments list when clicking the header refresh button', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /refresh payments/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    await waitFor(() => {
      const getPaymentsCalls = fetchSpy.mock.calls.filter((call) =>
        String(call[0]).includes('/api/admin/payments')
      );
      expect(getPaymentsCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('opens Payment Detail dialog and loads comprehensive details, masked accounts, and audit history', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    // Click the details button for the first payment
    const detailButtons = screen.getAllByRole('button', { name: /details/i });
    await act(async () => {
      fireEvent.click(detailButtons[0]);
    });

    // Check dialog opens and shows detail information
    expect(await screen.findByText('BANK-TRX-778899')).toBeInTheDocument();
    expect(screen.getByText('MEZN-REF-112233')).toBeInTheDocument();
    expect(screen.getByText('Paid for software license.')).toBeInTheDocument();
    expect(screen.getByText('Direct bank transfer matched statement.')).toBeInTheDocument();

    // Verify masking of accounts
    expect(screen.getByText('***4567')).toBeInTheDocument();
    expect(screen.getByText('***9988')).toBeInTheDocument();

    // Verify audit trail
    expect(screen.getByText('Order checkout initiated.')).toBeInTheDocument();
    expect(screen.getByText('Payment verified by administrator.')).toBeInTheDocument();

    // Close dialog
    const closeBtn = screen.getAllByRole('button', { name: /close/i })[0];
    await act(async () => {
      fireEvent.click(closeBtn);
    });
  });

  it('guarantees that NO Approve, Reject, Refund, or financial mutation buttons exist in table or dialog', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('PAY-20261018-0001')[0]).toBeInTheDocument();
    });

    // Check table for mutation buttons
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Refund$|^Issue Refund$|^Refund Payment$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel payment/i })).not.toBeInTheDocument();

    // Open detail dialog
    const detailButtons = screen.getAllByRole('button', { name: /details/i });
    await act(async () => {
      fireEvent.click(detailButtons[0]);
    });

    await screen.findByText('BANK-TRX-778899');

    // Check dialog for mutation buttons
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Refund$|^Issue Refund$|^Refund Payment$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument();
  });

  it('renders responsive read-only badge with shield icon and title layout', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentsManagementView />
      </AuthProvider>
    );

    const heading = await screen.findByRole('heading', { name: /Payments Overview/i, level: 1 });
    const badge = screen.getByText('Read-Only').closest('.admin-badge-live');
    expect(badge).toBeInTheDocument();
    expect(badge?.querySelector('svg')).toBeInTheDocument();

    const titleRow = heading.parentElement;
    expect(titleRow).toHaveClass('flex', 'flex-wrap');
  });
});
