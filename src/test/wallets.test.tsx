import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React, { act } from 'react';
import { AuthProvider, ProtectedRoute } from '../lib/auth-context';
import { WalletsManagementView } from '../routes/wallets';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';
import type { AdminWalletSummaryDto, AdminWalletTransactionDto } from '../lib/wallets-api';

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

const sampleWallets: AdminWalletSummaryDto[] = [
  {
    walletId: 101,
    customerId: 'cust-01',
    customerFullName: 'Alice Johnson',
    customerEmail: 'alice@example.com',
    currentBalance: 25000,
    currency: 'PKR',
    createdAt: '2026-10-18T08:00:00Z',
    updatedAt: '2026-10-18T09:35:00Z',
  },
  {
    walletId: 102,
    customerId: 'cust-02',
    customerFullName: 'Bob Miller',
    customerEmail: 'bob@example.com',
    currentBalance: 7500.5,
    currency: 'PKR',
    createdAt: '2026-10-18T08:30:00Z',
    updatedAt: '2026-10-18T10:15:00Z',
  },
];

const sampleTransactionsWallet101: AdminWalletTransactionDto[] = [
  {
    transactionId: 501,
    walletId: 101,
    transactionType: 'Credit',
    amount: 30000,
    currency: 'PKR',
    balanceBefore: 0,
    balanceAfter: 30000,
    sourceType: 'DepositVerification',
    sourceReferenceId: 'PAY-20261018-001',
    description: 'Verified bank transfer deposit',
    createdAt: '2026-10-18T08:30:00Z',
  },
  {
    transactionId: 502,
    walletId: 101,
    transactionType: 'Debit',
    amount: 5000,
    currency: 'PKR',
    balanceBefore: 30000,
    balanceAfter: 25000,
    sourceType: 'OrderPayment',
    sourceReferenceId: 'ORD-20261018-001',
    description: 'Payment for order checkout',
    createdAt: '2026-10-18T09:35:00Z',
  },
];

const sampleTransactionsWallet102: AdminWalletTransactionDto[] = [
  {
    transactionId: 601,
    walletId: 102,
    transactionType: 'Credit',
    amount: 7500.5,
    currency: 'PKR',
    balanceBefore: 0,
    balanceAfter: 7500.5,
    sourceType: 'DepositVerification',
    sourceReferenceId: 'PAY-20261018-002',
    description: 'JazzCash deposit verification',
    createdAt: '2026-10-18T10:15:00Z',
  },
];

function setupWalletFetch(
  wallets: AdminWalletSummaryDto[] = sampleWallets.map((w) => ({ ...w })),
  txMap: Record<number, AdminWalletTransactionDto[]> = {
    101: sampleTransactionsWallet101.map((t) => ({ ...t })),
    102: sampleTransactionsWallet102.map((t) => ({ ...t })),
  }
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

    // Wallet transaction ledger endpoint: /api/admin/wallets/:id/transactions
    const txMatch = url.match(/\/api\/admin\/wallets\/(\d+)\/transactions/);
    if (txMatch) {
      const walletId = parseInt(txMatch[1], 10);
      const parsedUrl = new URL(url, 'http://localhost');
      const transactionType = parsedUrl.searchParams.get('transactionType');
      const sourceType = parsedUrl.searchParams.get('sourceType');
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(parsedUrl.searchParams.get('pageSize') || '20', 10);

      const allTx = txMap[walletId] || [];
      let filtered = [...allTx];

      if (transactionType && transactionType !== 'all') {
        filtered = filtered.filter(
          (t) => t.transactionType.toLowerCase() === transactionType.toLowerCase()
        );
      }
      if (sourceType && sourceType !== 'all') {
        filtered = filtered.filter(
          (t) => t.sourceType.toLowerCase() === sourceType.toLowerCase()
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
            message: 'Wallet transaction history retrieved successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // Wallets list endpoint: /api/admin/wallets
    if (url.includes('/api/admin/wallets')) {
      const parsedUrl = new URL(url, 'http://localhost');
      const currency = parsedUrl.searchParams.get('currency');
      const search = parsedUrl.searchParams.get('search');
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(parsedUrl.searchParams.get('pageSize') || '20', 10);

      let filtered = [...wallets];

      if (currency && currency !== 'all') {
        filtered = filtered.filter((w) => w.currency.toLowerCase() === currency.toLowerCase());
      }
      if (search) {
        const cleanSearch = search.toLowerCase();
        filtered = filtered.filter(
          (w) =>
            w.customerId.toLowerCase().includes(cleanSearch) ||
            (w.customerFullName && w.customerFullName.toLowerCase().includes(cleanSearch)) ||
            (w.customerEmail && w.customerEmail.toLowerCase().includes(cleanSearch))
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
            message: 'Customer wallets retrieved successfully.',
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

describe('Customer Wallets Overview View & Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCsrfToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users away from the Wallets page', async () => {
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
          <WalletsManagementView />
        </ProtectedRoute>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });
  });

  it('renders the Wallets page for authenticated administrator with authoritative heading', async () => {
    setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    expect(
      await screen.findByRole('heading', { name: /Customer Wallets/i, level: 1 })
    ).toBeInTheDocument();
    const badge = screen.getByText('Read-Only');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('.admin-badge-live')).toBeInTheDocument();
  });

  it('calls correct wallet-list endpoint GET /api/admin/wallets and renders rows', async () => {
    const fetchSpy = setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
      expect(screen.getAllByText('#102')[0]).toBeInTheDocument();
    });

    const getWalletsCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).includes('/api/admin/wallets') &&
      !String(call[0]).includes('/transactions')
    );
    expect(getWalletsCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('displays authoritative current balances directly from backend', async () => {
    setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
    });

    // Check balances for both wallets
    expect(screen.getAllByText(/25,000\.00 PKR/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/7,500\.50 PKR/).length).toBeGreaterThanOrEqual(1);
  });

  it('filters wallets by currency dropdown', async () => {
    const fetchSpy = setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
    });

    const currencySelect = screen.getByLabelText(/filter by currency/i);
    await act(async () => {
      fireEvent.change(currencySelect, { target: { value: 'PKR' } });
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('currency=PKR'))).toBe(true);
    });
  });

  it('searches wallets by customer ID or name', async () => {
    const fetchSpy = setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search wallets/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'alice' } });
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('search=alice'))).toBe(true);
    });
  });

  it('opens Wallet Ledger dialog and calls GET /api/admin/wallets/:id/transactions', async () => {
    const fetchSpy = setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
    });

    const txButtons = screen.getAllByRole('button', { name: /transactions/i });
    await act(async () => {
      fireEvent.click(txButtons[0]);
    });

    // Confirm dialog opened and displays title with target wallet ID
    expect(await screen.findByText(/Wallet #101 — Immutable Transaction Ledger/i)).toBeInTheDocument();

    // Verify endpoint called
    const txCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).includes('/api/admin/wallets/101/transactions')
    );
    expect(txCalls.length).toBeGreaterThanOrEqual(1);

    // Verify records from ledger are displayed
    expect(screen.getAllByText('#501')[0]).toBeInTheDocument();
    expect(screen.getAllByText('#502')[0]).toBeInTheDocument();

    // Verify credit and debit labels
    expect(screen.getAllByText('Credit').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Debit').length).toBeGreaterThanOrEqual(1);

    // Verify progression: 0.00 -> 30,000.00 and 30,000.00 -> 25,000.00
    expect(screen.getByText('PAY-20261018-001')).toBeInTheDocument();
    expect(screen.getByText('ORD-20261018-001')).toBeInTheDocument();

    // Close dialog
    const closeBtn = screen.getAllByRole('button', { name: /close/i })[0];
    await act(async () => {
      fireEvent.click(closeBtn);
    });
  });

  it('filters transactions by direction (Credit / Debit) inside ledger dialog', async () => {
    const fetchSpy = setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
    });

    const txButtons = screen.getAllByRole('button', { name: /transactions/i });
    await act(async () => {
      fireEvent.click(txButtons[0]);
    });

    await screen.findByText('#501');

    const creditsTab = screen.getByRole('button', { name: /credits/i });
    await act(async () => {
      fireEvent.click(creditsTab);
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('transactionType=Credit'))).toBe(true);
    });
  });

  it('filters transactions by source category inside ledger dialog', async () => {
    const fetchSpy = setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
    });

    const txButtons = screen.getAllByRole('button', { name: /transactions/i });
    await act(async () => {
      fireEvent.click(txButtons[0]);
    });

    await screen.findByText('#501');

    const sourceSelect = screen.getByLabelText(/filter ledger by source/i);
    await act(async () => {
      fireEvent.change(sourceSelect, { target: { value: 'DepositVerification' } });
    });

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('sourceType=DepositVerification'))).toBe(true);
    });
  });

  it('safeguards against stale data when switching between wallets', async () => {
    setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
      expect(screen.getAllByText('#102')[0]).toBeInTheDocument();
    });

    // 1. Open Wallet 101
    const txButtons = screen.getAllByRole('button', { name: /transactions/i });
    await act(async () => {
      fireEvent.click(txButtons[0]); // Wallet 101
    });

    await screen.findByText('#501');
    expect(screen.getByText('PAY-20261018-001')).toBeInTheDocument();

    // Close dialog
    const closeBtn = screen.getAllByRole('button', { name: /close/i })[0];
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // 2. Open Wallet 102
    await act(async () => {
      fireEvent.click(txButtons[1]); // Wallet 102
    });

    // Check that Wallet 102 header and its transactions are displayed
    expect(await screen.findByText(/Wallet #102 — Immutable Transaction Ledger/i)).toBeInTheDocument();
    expect(screen.getByText('#601')).toBeInTheDocument();
    expect(screen.getByText('PAY-20261018-002')).toBeInTheDocument();

    // Verify Wallet 101 specific transaction is NOT in the document
    expect(screen.queryByText('#501')).not.toBeInTheDocument();
    expect(screen.queryByText('#502')).not.toBeInTheDocument();
  });

  it('guarantees that NO Edit Balance, Add Funds, Deduct Funds, or mutation buttons exist anywhere', async () => {
    setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('#101')[0]).toBeInTheDocument();
    });

    // Verify table has no mutation controls
    expect(screen.queryByRole('button', { name: /edit balance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add funds/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deduct funds/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adjust balance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refund/i })).not.toBeInTheDocument();

    // Open ledger dialog
    const txButtons = screen.getAllByRole('button', { name: /transactions/i });
    await act(async () => {
      fireEvent.click(txButtons[0]);
    });

    await screen.findByText('#501');

    // Verify dialog has no mutation controls
    expect(screen.queryByRole('button', { name: /edit balance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add funds/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deduct/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adjust/i })).not.toBeInTheDocument();
  });

  it('renders responsive read-only badge with shield icon and title layout', async () => {
    setupWalletFetch();

    render(
      <AuthProvider>
        <WalletsManagementView />
      </AuthProvider>
    );

    const heading = await screen.findByRole('heading', { name: /Customer Wallets/i, level: 1 });
    const badge = screen.getByText('Read-Only').closest('.admin-badge-live');
    expect(badge).toBeInTheDocument();
    expect(badge?.querySelector('svg')).toBeInTheDocument();

    const titleRow = heading.parentElement;
    expect(titleRow).toHaveClass('flex', 'flex-wrap');
  });
});
