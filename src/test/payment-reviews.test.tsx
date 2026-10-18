import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen, within } from '@testing-library/react';
import React, { act } from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { PaymentReviewsManagementView } from '../routes/payment-reviews';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type { AdminManualPaymentDto } from '../lib/manual-payments-api';

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

const samplePayments: AdminManualPaymentDto[] = [
  {
    id: 1,
    paymentNumber: 'PAY-20261018-0001',
    purpose: 'WalletTopUp',
    walletId: 101,
    orderId: null,
    customerId: 'cust-01',
    customerEmail: 'alice@example.com',
    customerFullName: 'Alice Johnson',
    amount: 5000,
    currency: 'PKR',
    paymentMethodCode: 'BANK_TRANSFER',
    status: 'Pending',
    idempotencyKey: 'idemp-topup-001',
    providerTransactionId: null,
    customerReference: 'MEZN-TRX-88219',
    customerTransferDate: '2026-10-18T09:30:00Z',
    customerSenderAccount: '03001234567',
    customerNotes: 'Transferred via Meezan mobile app.',
    customerProofSubmittedAt: '2026-10-18T09:35:00Z',
    verifiedByUserId: null,
    verifiedByUserName: null,
    verifiedReceivingAccount: null,
    adminNotes: null,
    verifiedAt: null,
    createdAt: '2026-10-18T09:20:00Z',
    updatedAt: '2026-10-18T09:35:00Z',
    paidAt: null,
    statusHistory: [
      {
        id: 11,
        previousStatus: null,
        newStatus: 'Pending',
        reason: 'Manual top-up request initiated by customer.',
        changedByUserId: 'cust-01',
        changedByUserName: 'Alice Johnson',
        changedAt: '2026-10-18T09:20:00Z',
      },
    ],
  },
  {
    id: 2,
    paymentNumber: 'PAY-20261018-0002',
    purpose: 'WalletTopUp',
    walletId: 102,
    orderId: null,
    customerId: 'cust-02',
    customerEmail: 'bob@example.com',
    customerFullName: 'Bob Miller',
    amount: 15000,
    currency: 'PKR',
    paymentMethodCode: 'JAZZCASH',
    status: 'Paid',
    idempotencyKey: 'idemp-topup-002',
    providerTransactionId: 'JC-99881122',
    customerReference: 'JC-99881122',
    customerTransferDate: '2026-10-18T10:00:00Z',
    customerSenderAccount: '03019876543',
    customerNotes: 'JazzCash agent deposit.',
    customerProofSubmittedAt: '2026-10-18T10:05:00Z',
    verifiedByUserId: 'admin-001',
    verifiedByUserName: 'Gogaa Admin',
    verifiedReceivingAccount: 'JAZZCASH_MAIN',
    adminNotes: 'Verified against bank portal.',
    verifiedAt: '2026-10-18T10:15:00Z',
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:15:00Z',
    paidAt: '2026-10-18T10:15:00Z',
    statusHistory: [
      {
        id: 12,
        previousStatus: null,
        newStatus: 'Pending',
        reason: 'Manual top-up request initiated.',
        changedByUserId: 'cust-02',
        changedByUserName: 'Bob Miller',
        changedAt: '2026-10-18T10:00:00Z',
      },
      {
        id: 13,
        previousStatus: 'Pending',
        newStatus: 'Paid',
        reason: 'Approved by administrator (Ref: JC-99881122, Account: JAZZCASH_MAIN).',
        changedByUserId: 'admin-001',
        changedByUserName: 'Gogaa Admin',
        changedAt: '2026-10-18T10:15:00Z',
      },
    ],
  },
  {
    id: 3,
    paymentNumber: 'PAY-20261018-0003',
    purpose: 'WalletTopUp',
    walletId: 103,
    orderId: null,
    customerId: 'cust-03',
    customerEmail: 'carol@example.com',
    customerFullName: 'Carol White',
    amount: 2500,
    currency: 'PKR',
    paymentMethodCode: 'EASYPAISA',
    status: 'Failed',
    idempotencyKey: 'idemp-topup-003',
    providerTransactionId: null,
    customerReference: 'EP-INVALID-99',
    customerTransferDate: '2026-10-18T11:00:00Z',
    customerSenderAccount: '03451122334',
    customerNotes: 'Wrong screenshot attached.',
    customerProofSubmittedAt: '2026-10-18T11:05:00Z',
    verifiedByUserId: 'admin-001',
    verifiedByUserName: 'Gogaa Admin',
    verifiedReceivingAccount: null,
    adminNotes: 'Transaction ID not found in receiving account.',
    verifiedAt: '2026-10-18T11:20:00Z',
    createdAt: '2026-10-18T11:00:00Z',
    updatedAt: '2026-10-18T11:20:00Z',
    paidAt: null,
    statusHistory: [
      {
        id: 14,
        previousStatus: null,
        newStatus: 'Pending',
        reason: 'Manual top-up request initiated.',
        changedByUserId: 'cust-03',
        changedByUserName: 'Carol White',
        changedAt: '2026-10-18T11:00:00Z',
      },
      {
        id: 15,
        previousStatus: 'Pending',
        newStatus: 'Failed',
        reason: 'Rejected by administrator: Transaction reference not found in statement.',
        changedByUserId: 'admin-001',
        changedByUserName: 'Gogaa Admin',
        changedAt: '2026-10-18T11:20:00Z',
      },
    ],
  },
];

function setupPaymentFetch(payments: AdminManualPaymentDto[] = samplePayments.map((p) => ({ ...p }))) {
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

    // 2. GET /api/admin/payments/manual/:paymentNumber
    const singleMatch = url.match(/\/api\/admin\/payments\/manual\/([^?]+)$/);
    if (singleMatch && method === 'GET') {
      const paymentNumber = decodeURIComponent(singleMatch[1]);
      const found = payments.find((p) => p.paymentNumber === paymentNumber);
      if (found) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Manual payment details retrieved successfully.',
              data: found,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            message: `Manual payment '${paymentNumber}' was not found.`,
            data: null,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // 3. GET /api/admin/payments/manual (list)
    if (url.includes('/api/admin/payments/manual') && method === 'GET') {
      let filtered = [...payments];

      // Status filter
      const statusMatch = url.match(/status=([^&]+)/);
      if (statusMatch) {
        const st = decodeURIComponent(statusMatch[1]);
        filtered = filtered.filter((p) => p.status === st);
      }

      // Page and PageSize
      const pageMatch = url.match(/page=(\d+)/);
      const pageSizeMatch = url.match(/pageSize=(\d+)/);
      const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 20;

      const totalCount = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const pagedItems = filtered.slice((page - 1) * pageSize, page * pageSize);

      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Manual payments retrieved successfully.',
            data: {
              items: pagedItems,
              page,
              pageSize,
              totalCount,
              totalPages,
              hasPreviousPage: page > 1,
              hasNextPage: page < totalPages,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    return Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 404 }));
  });
}

describe('Payment Reviews Management View & Component Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCsrfToken();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users away from the Payment Reviews page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, message: 'Unauthenticated session.', data: null }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <AuthProvider>
        <ProtectedRoute>
          <PaymentReviewsManagementView />
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });
  });

  it('renders the Payment Reviews page for authenticated administrator with authoritative heading', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    expect(await screen.findByRole('heading', { name: /Payment Reviews/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Inspect customer PKR wallet top-up payment attempts/i)).toBeInTheDocument();
  });

  it('shows loading skeleton while fetch is in progress', async () => {
    let resolvePayments: any;
    const pendingPayments = new Promise((resolve) => {
      resolvePayments = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: mockAdminUser }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/api/admin/payments/manual')) {
        return pendingPayments.then(() =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: [],
                page: 1,
                pageSize: 20,
                totalCount: 0,
                totalPages: 1,
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
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    expect(await screen.findByTestId('payments-loading-skeleton')).toBeInTheDocument();

    await act(async () => {
      resolvePayments();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('payments-loading-skeleton')).not.toBeInTheDocument();
    });
  });

  it('loads and displays manual payment records with customer, amount, method, and status', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
      expect(screen.getByTestId('payment-row-PAY-20261018-0002')).toBeInTheDocument();
      expect(screen.getByTestId('payment-row-PAY-20261018-0003')).toBeInTheDocument();
    });

    const row1 = screen.getByTestId('payment-row-PAY-20261018-0001');
    expect(within(row1).getByText('PAY-20261018-0001')).toBeInTheDocument();
    expect(within(row1).getByText('Alice Johnson')).toBeInTheDocument();
    expect(within(row1).getByText('5,000.00 PKR')).toBeInTheDocument();
    expect(within(row1).getByText('Pending')).toBeInTheDocument();
    expect(within(row1).getByText('Bank Transfer')).toBeInTheDocument();

    const row2 = screen.getByTestId('payment-row-PAY-20261018-0002');
    expect(within(row2).getByText('PAY-20261018-0002')).toBeInTheDocument();
    expect(within(row2).getByText('Bob Miller')).toBeInTheDocument();
    expect(within(row2).getByText('15,000.00 PKR')).toBeInTheDocument();
    expect(within(row2).getByText('Paid')).toBeInTheDocument();
    expect(within(row2).getByText('JazzCash Manual')).toBeInTheDocument();

    const row3 = screen.getByTestId('payment-row-PAY-20261018-0003');
    expect(within(row3).getByText('PAY-20261018-0003')).toBeInTheDocument();
    expect(within(row3).getByText('Carol White')).toBeInTheDocument();
    expect(within(row3).getByText('Failed')).toBeInTheDocument();
  });

  it('safely masks customer sender account in table view (e.g. •••• 4567)', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
    });

    const row1 = screen.getByTestId('payment-row-PAY-20261018-0001');
    // Account 03001234567 should be masked to •••• 4567
    expect(within(row1).getByText(/Acct:\s*•••• 4567/i)).toBeInTheDocument();
    // Raw unmasked account must NOT be visible anywhere
    expect(screen.queryByText('03001234567')).not.toBeInTheDocument();
  });

  it('filters payments by status tab (Pending, Paid, Failed)', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
    });

    // Click Pending tab
    const pendingTab = screen.getByRole('button', { name: /^Pending$/i });
    await act(async () => {
      fireEvent.click(pendingTab);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('status=Pending'),
        expect.any(Object)
      );
    });

    expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-row-PAY-20261018-0002')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-row-PAY-20261018-0003')).not.toBeInTheDocument();

    // Click Paid tab
    const paidTab = screen.getByRole('button', { name: /^Paid$/i });
    await act(async () => {
      fireEvent.click(paidTab);
    });

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0002')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('payment-row-PAY-20261018-0001')).not.toBeInTheDocument();
  });

  it('displays empty state when backend returns 0 records', async () => {
    setupPaymentFetch([]);

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    expect(await screen.findByTestId('payments-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/No Manual Payment Reviews Found/i)).toBeInTheDocument();
  });

  it('displays server error state when retrieval fails and allows retry', async () => {
    setInMemoryCsrfToken('test-csrf-token-xyz');

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
      if (url.includes('/api/admin/payments/manual')) {
        if (failOnce) {
          failOnce = false;
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, message: 'Database connection timeout.' }),
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
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    expect(await screen.findByTestId('payments-error-state')).toBeInTheDocument();
    expect(screen.getByText('Database connection timeout.')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /Retry Retrieval/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
    });
  });

  it('refreshes payments list when clicking the header refresh button', async () => {
    const fetchSpy = setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTestId('refresh-payments-btn');
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3); // auth/me + initial list + refresh list
    });
  });

  it('paginates payments correctly when multiple pages exist', async () => {
    // 25 items across 2 pages (pageSize = 20)
    const manyPayments: AdminManualPaymentDto[] = Array.from({ length: 25 }, (_, i) => ({
      ...samplePayments[0],
      id: i + 1,
      paymentNumber: `PAY-20261018-PAG-${String(i + 1).padStart(3, '0')}`,
    }));

    const fetchSpy = setupPaymentFetch(manyPayments);

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-PAG-001')).toBeInTheDocument();
    });

    // Check pagination summary
    expect(screen.getByTestId('payments-pagination')).toHaveTextContent(
      /Showing\s+1\s+to\s+20\s+of\s+25\s+payments/i
    );

    // Click Next page
    const nextBtn = screen.getByTestId('pagination-next-btn');
    expect(nextBtn).toBeEnabled();

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });

    // Second page shows item 21
    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-PAG-021')).toBeInTheDocument();
    });
  });

  it('discards stale out-of-order GET responses so an older response cannot overwrite newer state', async () => {
    setInMemoryCsrfToken('test-csrf-token-xyz');

    let resolveFirstFetch: (res: Response) => void;
    const firstFetchPromise = new Promise<Response>((resolve) => {
      resolveFirstFetch = resolve;
    });

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
      if (url.includes('/api/admin/payments/manual')) {
        callCount++;
        if (callCount === 1) {
          // Slow first fetch
          return firstFetchPromise;
        }
        // Fast second fetch (Paid tab)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: [samplePayments[1]], // Paid payment only
                page: 1,
                pageSize: 20,
                totalCount: 1,
                totalPages: 1,
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
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    // Wait until AuthProvider resolves and table renders
    const paidTab = await screen.findByRole('button', { name: /^Paid$/i });

    // Switch to Paid tab while first fetch is pending
    await act(async () => {
      fireEvent.click(paidTab);
    });

    // Second fetch completes immediately with Paid payment
    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0002')).toBeInTheDocument();
    });

    // Now resolve the older, first fetch with all sample payments
    await act(async () => {
      resolveFirstFetch!(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items: samplePayments,
              page: 1,
              pageSize: 20,
              totalCount: 3,
              totalPages: 1,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });

    // The newer state must remain intact! PAY-0001 must NOT overwrite the view
    expect(screen.getByTestId('payment-row-PAY-20261018-0002')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-row-PAY-20261018-0001')).not.toBeInTheDocument();
  });

  it('opens Payment Review Detail dialog on clicking Details button and displays complete audit history and bank reference', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0002')).toBeInTheDocument();
    });

    // Click Details button for payment 2
    const detailBtn = screen.getByTestId('view-detail-btn-PAY-20261018-0002');
    await act(async () => {
      fireEvent.click(detailBtn);
    });

    // Dialog opens
    const dialog = await screen.findByTestId('manual-payment-detail-dialog');
    expect(dialog).toBeInTheDocument();

    // Verify detail fields inside dialog
    expect(within(dialog).getByText('PAY-20261018-0002')).toBeInTheDocument();
    expect(within(dialog).getByText('15,000.00 PKR')).toBeInTheDocument();
    expect(within(dialog).getByText('JC-99881122')).toBeInTheDocument();
    expect(within(dialog).getByText('JAZZCASH_MAIN')).toBeInTheDocument();
    expect(within(dialog).getByText(/Verified against bank portal/i)).toBeInTheDocument();

    // Masked sender account in dialog
    expect(within(dialog).getByText('•••• 6543')).toBeInTheDocument();
    expect(within(dialog).queryByText('03019876543')).not.toBeInTheDocument();

    // Status history / audit trail
    expect(within(dialog).getByText('Payment Status Audit Trail')).toBeInTheDocument();
    expect(within(dialog).getByText('Pending → Paid')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Approved by administrator \(Ref: JC-99881122, Account: JAZZCASH_MAIN\)/i)
    ).toBeInTheDocument();

    // Close button
    const closeBtn = within(dialog).getByTestId('detail-dialog-close-btn');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('manual-payment-detail-dialog')).not.toBeInTheDocument();
    });
  });

  it('guarantees that NO Approve, Reject, Refund, or mutation buttons exist anywhere in table or dialog', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
    });

    // Table view: verify zero mutation buttons exist
    expect(screen.queryByRole('button', { name: /^Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Refund$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Refund Payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mark Paid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit Amount/i })).not.toBeInTheDocument();

    // Open detail dialog
    const detailBtn = screen.getByTestId('view-detail-btn-PAY-20261018-0001');
    await act(async () => {
      fireEvent.click(detailBtn);
    });

    const dialog = await screen.findByTestId('manual-payment-detail-dialog');

    // Dialog view: verify zero mutation buttons exist
    expect(within(dialog).queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Refund/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Credit Wallet/i })).not.toBeInTheDocument();

    // Read-only notice confirms read-only behavior
    expect(within(dialog).getByText(/Read-Only Financial View/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Strictly Read-Only · Mutation buttons disabled/i)).toBeInTheDocument();
  });

  it('confirms removal of fake sample count "8" from Payment Reviews navigation item in AppShell', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-row-PAY-20261018-0001')).toBeInTheDocument();
    });

    // Locate the Payment Reviews navigation item
    const paymentReviewsNav = screen.getByRole('button', { name: /^Payment Reviews/i });
    expect(paymentReviewsNav).toBeInTheDocument();

    // Verify there is NO sample count badge with "8"
    expect(within(paymentReviewsNav).queryByText('8')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/8 sample items/i)).not.toBeInTheDocument();
  });

  it('renders mobile cards with responsive layout and view details button', async () => {
    setupPaymentFetch();

    render(
      <AuthProvider>
        <PaymentReviewsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('manual-payments-mobile-cards')).toBeInTheDocument();
    });

    expect(screen.getByTestId('payment-card-PAY-20261018-0001')).toBeInTheDocument();
    expect(screen.getByTestId('payment-card-PAY-20261018-0002')).toBeInTheDocument();
    expect(screen.getByTestId('payment-card-PAY-20261018-0003')).toBeInTheDocument();
  });
});
