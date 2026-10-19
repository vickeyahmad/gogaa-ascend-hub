import {
  History,
  Inbox,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
  ShieldCheck,
  Search,
  X,
  User,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import {
  formatWalletBalance,
  formatWalletDate,
  type AdminWalletSummaryDto,
} from '@/lib/wallets-api';

export interface WalletTableProps {
  wallets: AdminWalletSummaryDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewTransactions: (wallet: AdminWalletSummaryDto) => void;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  searchQuery: string;
  onSearchChange: (search: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

const CURRENCY_OPTIONS = [
  { value: 'all', label: 'All Currencies' },
  { value: 'PKR', label: 'PKR' },
  { value: 'USD', label: 'USD' },
  { value: 'USDT', label: 'USDT' },
];

export function WalletTable({
  wallets,
  isLoading,
  error,
  onRetry,
  onViewTransactions,
  selectedCurrency,
  onCurrencyChange,
  searchQuery,
  onSearchChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
}: WalletTableProps) {
  const isFiltered = selectedCurrency !== 'all' || Boolean(searchQuery.trim());

  return (
    <div className="space-y-4">
      {/* Table Shell with Toolbar */}
      <div className="table-shell">
        <div className="table-toolbar flex-wrap gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-primary" />
              <span>Customer Ledgers</span>
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/60 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Authoritative Balances</span>
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="p-3 border-b border-border/50 bg-muted/20 flex flex-wrap items-center gap-3">
          {/* Customer Search Input */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              className="w-full h-8 pl-8 pr-8 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search by customer ID, name, email..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search wallets"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Currency Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="currency-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Currency:
            </label>
            <select
              id="currency-filter"
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedCurrency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              aria-label="Filter by currency"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground ml-auto"
              onClick={onClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-6 space-y-3" role="status" aria-label="Loading wallets">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center gap-4 py-2">
                <SkeletonLoader className="h-5 w-20 rounded" />
                <SkeletonLoader className="h-5 w-44 rounded" />
                <SkeletonLoader className="h-5 w-28 rounded ml-auto" />
                <SkeletonLoader className="h-5 w-32 rounded" />
                <SkeletonLoader className="h-5 w-24 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry Button */}
        {!isLoading && error && (
          <div
            className="p-8 text-center space-y-3"
            role="alert"
            aria-live="assertive"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Failed to load customer wallets
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry Retrieval
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && wallets.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {isFiltered ? 'No matching wallets found' : 'No Customer Wallets Found'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isFiltered
                  ? 'No customer wallets match your search and currency criteria.'
                  : 'Customer digital wallets will appear here as accounts are initialized and funded.'}
              </p>
            </div>
            {isFiltered && (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Desktop Table View */}
        {!isLoading && !error && wallets.length > 0 && (
          <div className="hidden md:block table-scroll">
            <table className="w-full text-left border-collapse" aria-label="Customer Wallets">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Wallet ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {wallets.map((w) => (
                  <tr
                    key={w.walletId}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    {/* Wallet ID */}
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      <button
                        type="button"
                        className="hover:text-primary transition-colors underline-offset-2 hover:underline cursor-pointer"
                        onClick={() => onViewTransactions(w)}
                        title="View Transaction History"
                      >
                        #{w.walletId}
                      </button>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="font-medium text-foreground">
                          {w.customerFullName || w.customerId}
                        </div>
                        {w.customerEmail && (
                          <div className="text-[11px] text-muted-foreground">
                            {w.customerEmail}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-muted-foreground/80">
                          {w.customerId}
                        </div>
                      </div>
                    </td>

                    {/* Authoritative Current Balance */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-semibold text-foreground text-sm">
                        {formatWalletBalance(w.currentBalance, w.currency)}
                      </span>
                    </td>

                    {/* Currency */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-muted text-foreground border border-border/50">
                        {w.currency}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {formatWalletDate(w.createdAt)}
                    </td>

                    {/* Updated Date */}
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {formatWalletDate(w.updatedAt)}
                    </td>

                    {/* Action: View Transactions */}
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => onViewTransactions(w)}
                        title="View Ledger Transactions"
                        aria-label={`View transactions for wallet #${w.walletId}`}
                      >
                        <History className="w-3.5 h-3.5 mr-1" />
                        <span>Transactions</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Responsive Cards View */}
        {!isLoading && !error && wallets.length > 0 && (
          <div className="md:hidden divide-y divide-border/50">
            {wallets.map((w) => (
              <div key={w.walletId} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline cursor-pointer"
                    onClick={() => onViewTransactions(w)}
                  >
                    Wallet #{w.walletId}
                  </button>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-foreground border border-border/50">
                    {w.currency}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Customer</span>
                    <span className="font-medium text-foreground block">
                      {w.customerFullName || w.customerId}
                    </span>
                    {w.customerEmail && (
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {w.customerEmail}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Current Balance</span>
                    <span className="font-bold text-foreground text-sm block">
                      {formatWalletBalance(w.currentBalance, w.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[11px] text-muted-foreground">
                  <span>Updated: {formatWalletDate(w.updatedAt)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => onViewTransactions(w)}
                  >
                    <History className="w-3 h-3 mr-1" />
                    Transactions
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Server Pagination Footer */}
        {!isLoading && !error && totalCount > 0 && (
          <div className="p-3 border-t border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-medium text-foreground">{wallets.length}</span> of{' '}
              <span className="font-medium text-foreground">{totalCount}</span> customer wallets
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
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={page >= totalPages || isLoading}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
