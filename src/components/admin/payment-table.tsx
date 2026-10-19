import {
  Eye,
  Inbox,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Calendar,
  Wallet,
  ShieldCheck,
  User,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import {
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentMethod,
  getPaymentPurposeBadge,
  getPaymentStatusBadgeInfo,
  type AdminPaymentSummaryDto,
} from '@/lib/payments-api';

export interface PaymentTableProps {
  payments: AdminPaymentSummaryDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewDetail: (paymentNumber: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedPurpose: string;
  onPurposeChange: (purpose: string) => void;
  selectedPaymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  searchQuery: string;
  onSearchChange: (search: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

const STATUS_TABS = [
  { id: 'all', label: 'All Payments' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Paid', label: 'Paid' },
  { id: 'Failed', label: 'Failed' },
  { id: 'Expired', label: 'Expired' },
  { id: 'Refunded', label: 'Refunded' },
  { id: 'PartiallyRefunded', label: 'Partially Refunded' },
];

const PURPOSE_OPTIONS = [
  { value: 'all', label: 'All Purposes' },
  { value: 'OrderPurchase', label: 'Order Purchase' },
  { value: 'WalletTopUp', label: 'Wallet Top-Up' },
];

const PAYMENT_METHODS = [
  { value: 'all', label: 'All Methods' },
  { value: 'JAZZCASH', label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'WALLET', label: 'Customer Wallet' },
  { value: 'NAYAPAY', label: 'NayaPay' },
  { value: 'SADAPAY', label: 'SadaPay' },
  { value: 'CRYPTO_BINANCE', label: 'Binance Pay' },
  { value: 'CRYPTO_USDT', label: 'USDT Transfer' },
];

export function PaymentTable({
  payments,
  isLoading,
  error,
  onRetry,
  onViewDetail,
  selectedStatus,
  onStatusChange,
  selectedPurpose,
  onPurposeChange,
  selectedPaymentMethod,
  onPaymentMethodChange,
  searchQuery,
  onSearchChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
}: PaymentTableProps) {
  const isFiltered =
    selectedStatus !== 'all' ||
    selectedPurpose !== 'all' ||
    selectedPaymentMethod !== 'all' ||
    Boolean(searchQuery.trim());

  return (
    <div className="space-y-4">
      {/* Table Shell with Toolbar & Status Tabs */}
      <div className="table-shell">
        <div className="table-toolbar flex-wrap gap-2.5">
          {/* Status Tabs */}
          <div className="table-tabs overflow-x-auto pb-1 max-w-full">
            {STATUS_TABS.map((tab) => {
              const isSelected = selectedStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`table-tab whitespace-nowrap cursor-pointer ${
                    isSelected ? 'selected' : ''
                  }`}
                  aria-pressed={isSelected}
                  onClick={() => onStatusChange(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/60 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Read-Only Audit</span>
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="p-3 border-b border-border/50 bg-muted/20 flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              className="w-full h-8 pl-8 pr-8 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search payments, customers, TID..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search payments"
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

          {/* Purpose Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="purpose-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Purpose:
            </label>
            <select
              id="purpose-filter"
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedPurpose}
              onChange={(e) => onPurposeChange(e.target.value)}
              aria-label="Filter by purpose"
            >
              {PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="method-filter" className="text-xs text-muted-foreground whitespace-nowrap">
              Method:
            </label>
            <select
              id="method-filter"
              className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedPaymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
              aria-label="Filter by payment method"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button if any filter active */}
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
          <div className="p-6 space-y-3" role="status" aria-label="Loading payments">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center gap-4 py-2">
                <SkeletonLoader className="h-5 w-32 rounded" />
                <SkeletonLoader className="h-5 w-40 rounded" />
                <SkeletonLoader className="h-5 w-24 rounded" />
                <SkeletonLoader className="h-5 w-20 rounded" />
                <SkeletonLoader className="h-5 w-24 rounded ml-auto" />
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
                Failed to load payments
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry Retrieval
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && payments.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {isFiltered ? 'No matching payments found' : 'No Payments Recorded'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {isFiltered
                  ? 'No customer payments match your current filter and search criteria. Try adjusting your parameters.'
                  : 'Customer payments across orders and wallet top-ups will appear here in chronological order.'}
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
        {!isLoading && !error && payments.length > 0 && (
          <div className="hidden md:block table-scroll">
            <table className="w-full text-left border-collapse" aria-label="Customer Payments">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {payments.map((p) => {
                  const statusInfo = getPaymentStatusBadgeInfo(p.status);
                  const purposeInfo = getPaymentPurposeBadge(p.purpose);
                  const isOrder = p.purpose === 'OrderPurchase';

                  return (
                    <tr
                      key={p.paymentNumber}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Payment Number */}
                      <td className="py-3 px-4 font-mono text-[11px] font-medium text-foreground">
                        <button
                          type="button"
                          className="hover:text-primary transition-colors underline-offset-2 hover:underline cursor-pointer"
                          onClick={() => onViewDetail(p.paymentNumber)}
                          title="View Payment Details"
                        >
                          {p.paymentNumber}
                        </button>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground">
                            {p.customerFullName || p.customerId}
                          </div>
                          {p.customerEmail && (
                            <div className="text-[11px] text-muted-foreground">
                              {p.customerEmail}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Purpose */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${purposeInfo.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${purposeInfo.dotClass}`} />
                          {purposeInfo.label}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatPaymentMethod(p.paymentMethodCode)}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-medium text-foreground">
                        {formatPaymentAmount(p.amount, p.currency)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusInfo.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Related Reference */}
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {isOrder && p.orderNumber ? (
                          <span className="font-mono text-foreground font-medium">
                            {p.orderNumber}
                          </span>
                        ) : p.walletId ? (
                          <span>Wallet #{p.walletId}</span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {formatPaymentDate(p.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => onViewDetail(p.paymentNumber)}
                          title="View Payment Details"
                          aria-label={`View details for payment ${p.paymentNumber}`}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>Details</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Responsive Cards View */}
        {!isLoading && !error && payments.length > 0 && (
          <div className="md:hidden divide-y divide-border/50">
            {payments.map((p) => {
              const statusInfo = getPaymentStatusBadgeInfo(p.status);
              const purposeInfo = getPaymentPurposeBadge(p.purpose);
              const isOrder = p.purpose === 'OrderPurchase';

              return (
                <div key={p.paymentNumber} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline cursor-pointer"
                      onClick={() => onViewDetail(p.paymentNumber)}
                    >
                      {p.paymentNumber}
                    </button>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${statusInfo.badgeClass}`}
                    >
                      <span className={`w-1 h-1 rounded-full ${statusInfo.dotClass}`} />
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Customer</span>
                      <span className="font-medium text-foreground">
                        {p.customerFullName || p.customerId}
                      </span>
                      {p.customerEmail && (
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {p.customerEmail}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Amount</span>
                      <span className="font-semibold text-foreground">
                        {formatPaymentAmount(p.amount, p.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${purposeInfo.badgeClass}`}
                      >
                        {purposeInfo.label}
                      </span>
                      <span>{formatPaymentMethod(p.paymentMethodCode)}</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => onViewDetail(p.paymentNumber)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Server Pagination Footer */}
        {!isLoading && !error && totalCount > 0 && (
          <div className="p-3 border-t border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-medium text-foreground">{payments.length}</span> of{' '}
              <span className="font-medium text-foreground">{totalCount}</span> payments
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
