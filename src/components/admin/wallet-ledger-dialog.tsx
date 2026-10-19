import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import {
  getAdminWalletTransactions,
  formatWalletBalance,
  formatWalletDate,
  getTransactionTypeBadge,
  getTransactionSourceBadge,
  type AdminWalletSummaryDto,
  type AdminWalletTransactionDto,
  type AdminWalletTransactionQuery,
  type WalletTransactionType,
  type WalletTransactionSourceType,
} from '@/lib/wallets-api';
import {
  History,
  Wallet,
  AlertCircle,
  Inbox,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Lock,
  ArrowRight,
  ShieldCheck,
  User,
} from 'lucide-react';

export interface WalletLedgerDialogProps {
  wallet: AdminWalletSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
}

const DIRECTION_TABS = [
  { id: 'all', label: 'All Directions' },
  { id: 'Credit', label: 'Credits (+)' },
  { id: 'Debit', label: 'Debits (−)' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'DepositVerification', label: 'Deposit Verification' },
  { value: 'OrderPayment', label: 'Order Payment' },
  { value: 'Refund', label: 'Refund' },
  { value: 'AdminAdjustment', label: 'Admin Adjustment' },
  { value: 'CompensatingCorrection', label: 'Compensating Correction' },
];

export function WalletLedgerDialog({
  wallet,
  isOpen,
  onClose,
}: WalletLedgerDialogProps) {
  const [transactions, setTransactions] = useState<AdminWalletTransactionDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & server pagination
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Monotonic fetch counter to discard out-of-order or stale wallet responses
  const latestFetchId = useRef(0);

  const fetchTransactions = useCallback(
    async (
      isRefresh = false,
      targetPage = page,
      direction = selectedDirection,
      source = selectedSource
    ) => {
      if (!wallet || wallet.walletId <= 0) return;

      const currentFetchId = ++latestFetchId.current;
      const targetWalletId = wallet.walletId;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const query: AdminWalletTransactionQuery = {
          page: targetPage,
          pageSize,
          transactionType:
            direction === 'all'
              ? undefined
              : (direction as WalletTransactionType),
          sourceType:
            source === 'all'
              ? undefined
              : (source as WalletTransactionSourceType),
        };

        const result = await getAdminWalletTransactions(targetWalletId, query);

        // Discard stale out-of-order response or response for different wallet
        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setTransactions(result.items || []);
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
            : `Failed to load ledger records for wallet #${targetWalletId}.`;
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [wallet, selectedDirection, selectedSource, page, pageSize]
  );

  // When dialog opens or target wallet changes, reset state to avoid showing previous wallet's records
  useEffect(() => {
    if (!isOpen || !wallet) {
      setTransactions([]);
      setError(null);
      setSelectedDirection('all');
      setSelectedSource('all');
      setPage(1);
      return;
    }

    setTransactions([]);
    setSelectedDirection('all');
    setSelectedSource('all');
    setPage(1);
    void fetchTransactions(false, 1, 'all', 'all');
  }, [isOpen, wallet?.walletId]);

  // Handle filter changes (resets page to 1 and fetches immediately)
  const handleDirectionChange = (direction: string) => {
    setSelectedDirection(direction);
    setPage(1);
    void fetchTransactions(false, 1, direction, selectedSource);
  };

  const handleSourceChange = (source: string) => {
    setSelectedSource(source);
    setPage(1);
    void fetchTransactions(false, 1, selectedDirection, source);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchTransactions(false, newPage);
  };

  const isFiltered = selectedDirection !== 'all' || selectedSource !== 'all';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card shadow-2xl"
        aria-describedby="wallet-ledger-description"
      >
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/20 sticky top-0 z-10 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                  Wallet #{wallet?.walletId} — Immutable Transaction Ledger
                </DialogTitle>
              </div>
              <DialogDescription id="wallet-ledger-description" className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <span>Customer: <strong className="text-foreground">{wallet?.customerFullName || wallet?.customerId}</strong></span>
                {wallet?.customerEmail && <span>({wallet.customerEmail})</span>}
              </DialogDescription>
            </div>

            {/* Current Authoritative Balance Badge */}
            {wallet && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">
                    Authoritative Balance
                  </span>
                  <span className="text-sm font-bold text-foreground font-mono">
                    {formatWalletBalance(wallet.currentBalance, wallet.currency)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  disabled={isLoading || isRefreshing}
                  onClick={() => void fetchTransactions(true, page)}
                  title="Refresh ledger"
                  aria-label="Refresh ledger"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Toolbar & Filters */}
        <div className="p-3 border-b border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          {/* Direction Tabs */}
          <div className="table-tabs overflow-x-auto pb-0.5">
            {DIRECTION_TABS.map((tab) => {
              const isSelected = selectedDirection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`table-tab whitespace-nowrap cursor-pointer text-xs ${
                    isSelected ? 'selected' : ''
                  }`}
                  aria-pressed={isSelected}
                  onClick={() => handleDirectionChange(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Source Type Filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <label htmlFor="ledger-source-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Source:
            </label>
            <select
              id="ledger-source-filter"
              className="h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedSource}
              onChange={(e) => handleSourceChange(e.target.value)}
              aria-label="Filter ledger by source"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3" role="status" aria-label="Loading transactions">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="flex items-center gap-4 py-2">
                  <SkeletonLoader className="h-5 w-16 rounded" />
                  <SkeletonLoader className="h-5 w-24 rounded" />
                  <SkeletonLoader className="h-5 w-28 rounded" />
                  <SkeletonLoader className="h-5 w-40 rounded" />
                  <SkeletonLoader className="h-5 w-32 rounded ml-auto" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-8 text-center space-y-3" role="alert">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                Failed to load transaction ledger
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchTransactions(false, page)}
              >
                Retry Ledger
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && transactions.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {isFiltered ? 'No matching transactions' : 'No Transactions Recorded'}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isFiltered
                  ? 'No ledger entries match your current filter parameters.'
                  : 'This customer wallet currently has no balance mutation ledger records.'}
              </p>
              {isFiltered && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDirection('all');
                    setSelectedSource('all');
                    setPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {/* Desktop Table View */}
          {!isLoading && !error && transactions.length > 0 && (
            <div className="hidden md:block table-scroll">
              <table className="w-full text-left border-collapse" aria-label="Wallet Transactions">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                    <th className="py-2.5 px-3">Tx ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Balance Progression</th>
                    <th className="py-2.5 px-3">Source Category</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {transactions.map((tx) => {
                    const typeInfo = getTransactionTypeBadge(tx.transactionType);
                    const sourceInfo = getTransactionSourceBadge(tx.sourceType);

                    return (
                      <tr key={tx.transactionId} className="hover:bg-muted/30 transition-colors">
                        {/* Tx ID */}
                        <td className="py-2.5 px-3 font-mono text-[11px] font-medium text-foreground">
                          #{tx.transactionId}
                        </td>

                        {/* Type (Credit vs Debit) */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${typeInfo.badgeClass}`}
                          >
                            <span className={`w-1 h-1 rounded-full ${typeInfo.dotClass}`} />
                            {typeInfo.label}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-3 text-right font-medium text-foreground">
                          <span
                            className={
                              tx.transactionType === 'Credit'
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-rose-600 dark:text-rose-400 font-semibold'
                            }
                          >
                            {typeInfo.prefix}
                            {formatWalletBalance(tx.amount, tx.currency)}
                          </span>
                        </td>

                        {/* Balance Before -> Balance After */}
                        <td className="py-2.5 px-3 text-[11px] font-mono text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{formatWalletBalance(tx.balanceBefore, tx.currency)}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                            <span className="font-semibold text-foreground">
                              {formatWalletBalance(tx.balanceAfter, tx.currency)}
                            </span>
                          </div>
                        </td>

                        {/* Source Category */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${sourceInfo.badgeClass}`}
                          >
                            {sourceInfo.label}
                          </span>
                        </td>

                        {/* Source Reference & Description */}
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                          <div className="space-y-0.5">
                            {tx.sourceReferenceId ? (
                              <span className="font-mono text-foreground font-medium block">
                                {tx.sourceReferenceId}
                              </span>
                            ) : null}
                            {tx.description && (
                              <span className="text-[10px] text-muted-foreground block line-clamp-1">
                                {tx.description}
                              </span>
                            )}
                            {!tx.sourceReferenceId && !tx.description && <span>—</span>}
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                          {formatWalletDate(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Responsive Cards View */}
          {!isLoading && !error && transactions.length > 0 && (
            <div className="md:hidden divide-y divide-border/50">
              {transactions.map((tx) => {
                const typeInfo = getTransactionTypeBadge(tx.transactionType);
                const sourceInfo = getTransactionSourceBadge(tx.sourceType);

                return (
                  <div key={tx.transactionId} className="p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Tx #{tx.transactionId}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeInfo.badgeClass}`}
                      >
                        {typeInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[11px]">Amount:</span>
                      <span
                        className={
                          tx.transactionType === 'Credit'
                            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                            : 'text-rose-600 dark:text-rose-400 font-bold'
                        }
                      >
                        {typeInfo.prefix}
                        {formatWalletBalance(tx.amount, tx.currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Progression:</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span>{formatWalletBalance(tx.balanceBefore, tx.currency)}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span className="font-semibold text-foreground">
                          {formatWalletBalance(tx.balanceAfter, tx.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                      <span
                        className={`inline-flex items-center px-1 py-0.5 rounded border ${sourceInfo.badgeClass}`}
                      >
                        {sourceInfo.label}
                      </span>
                      <span>{formatWalletDate(tx.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ledger Pagination Footer */}
          {!isLoading && !error && totalCount > 0 && (
            <div className="p-3 border-t border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Showing <span className="font-medium text-foreground">{transactions.length}</span> of{' '}
                <span className="font-medium text-foreground">{totalCount}</span> ledger entries
                {totalPages > 1 && (
                  <span>
                    {' '}
                    (Page {page} of {totalPages})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={page <= 1 || isLoading}
                  onClick={() => handlePageChange(page - 1)}
                  aria-label="Previous ledger page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => handlePageChange(page + 1)}
                  aria-label="Next ledger page"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer - Pure Read-Only Close */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            <span>Immutable ledger · Strictly read-only</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
