import { useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw, Wallet, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedRoute, useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/gogaa/app-shell';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { WalletTable } from '@/components/admin/wallet-table';
import { WalletLedgerDialog } from '@/components/admin/wallet-ledger-dialog';
import {
  getAdminWallets,
  type AdminWalletSummaryDto,
  type AdminWalletQuery,
} from '@/lib/wallets-api';

export const Route = createFileRoute('/wallets')({
  head: () => ({
    meta: [
      { title: 'Customer Wallets · Gogaa Byte Admin' },
      {
        name: 'description',
        content:
          'Inspect real customer digital wallets, authoritative current balances, and immutable transaction ledgers.',
      },
      { property: 'og:title', content: 'Customer Wallets · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Read-only administrative customer wallets overview in Gogaa Byte Control Center.',
      },
    ],
  }),
  component: ProtectedWalletsPage,
});

function ProtectedWalletsPage() {
  return (
    <ProtectedRoute>
      <WalletsManagementView />
    </ProtectedRoute>
  );
}

export function WalletsManagementView() {
  const { isAuthenticated } = useAuth();

  const [wallets, setWallets] = useState<AdminWalletSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic fetch counter to discard out-of-order GET responses
  const latestFetchId = useRef(0);

  // Filters, search & pagination
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Ledger dialog state
  const [selectedWallet, setSelectedWallet] = useState<AdminWalletSummaryDto | null>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState<boolean>(false);

  /**
   * Fetches customer wallets with server-side filters and pagination.
   * Monotonic fetch counter guarantees that stale out-of-order responses are discarded.
   */
  const fetchWallets = useCallback(
    async (isRefresh = false, targetPage = page) => {
      const currentFetchId = ++latestFetchId.current;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query: AdminWalletQuery = {
          page: targetPage,
          pageSize,
          currency: selectedCurrency === 'all' ? undefined : selectedCurrency,
          search: searchQuery.trim() || undefined,
        };

        const result = await getAdminWallets(query);

        // Discard stale out-of-order response
        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setWallets(result.items || []);
        setTotalCount(result.totalCount || 0);
        setTotalPages(result.totalPages || 1);
        setPage(result.page || targetPage);
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to retrieve customer wallets from backend. Please verify your connection.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, pageSize, selectedCurrency, searchQuery]
  );

  // Fetch when filters or search change (resetting to page 1)
  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchWallets(false, 1);
  }, [isAuthenticated, selectedCurrency, searchQuery]);

  // Page navigation handler
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchWallets(false, newPage);
  };

  // Currency filter change handler
  const handleCurrencyChange = (currency: string) => {
    setSelectedCurrency(currency);
    setPage(1);
  };

  // Search query change handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Clear all filters handler
  const handleClearFilters = () => {
    setSelectedCurrency('all');
    setSearchQuery('');
    setPage(1);
  };

  // View transactions ledger opener
  const handleViewTransactions = (wallet: AdminWalletSummaryDto) => {
    setSelectedWallet(wallet);
    setIsLedgerOpen(true);
  };

  // Close ledger modal
  const handleCloseLedger = () => {
    setIsLedgerOpen(false);
    setSelectedWallet(null);
  };

  return (
    <AppShell activeItem="Wallets" pageTitle="Customer Wallets" showSearch={false}>
      <div className="page-container space-y-6">
        <AdminPageHeader
          title="Customer Wallets"
          description="Inspect real customer digital wallets, authoritative current balances, and immutable transaction ledgers."
          badge={
            <span className="admin-badge-live">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Read-Only</span>
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || isRefreshing}
              onClick={() => void fetchWallets(true, page)}
              className="gap-2"
              title="Refresh wallets"
              aria-label="Refresh wallets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          }
        />

        <WalletTable
          wallets={wallets}
          isLoading={isLoading}
          error={error}
          onRetry={() => void fetchWallets(false, page)}
          onViewTransactions={handleViewTransactions}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={handleCurrencyChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onClearFilters={handleClearFilters}
        />

        <WalletLedgerDialog
          wallet={selectedWallet}
          isOpen={isLedgerOpen}
          onClose={handleCloseLedger}
        />
      </div>
    </AppShell>
  );
}
