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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import {
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentMethod,
  maskAccountNumber,
  getPaymentStatusBadgeInfo,
  type AdminManualPaymentDto,
} from '@/lib/manual-payments-api';

export interface ManualPaymentTableProps {
  payments: AdminManualPaymentDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewDetail: (paymentNumber: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
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

export function ManualPaymentTable({
  payments,
  isLoading,
  error,
  onRetry,
  onViewDetail,
  selectedStatus,
  onStatusChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onClearFilters,
}: ManualPaymentTableProps) {
  const isFiltered = selectedStatus !== 'all';

  return (
    <div className="space-y-4">
      {/* Table Shell with Toolbar & Status Tabs */}
      <div className="table-shell">
        <div className="table-toolbar flex-wrap gap-2">
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

        {/* Loading State */}
        {isLoading && (
          <div className="p-6 space-y-4" data-testid="payments-loading-skeleton">
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <CreditCard className="w-4 h-4 animate-pulse text-primary" />
              <span>Fetching manual payment records...</span>
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 border border-border/40 rounded-lg animate-pulse bg-muted/20"
                >
                  <div className="space-y-2 col-span-1">
                    <div className="h-4 bg-muted/60 rounded w-28" />
                    <div className="h-3 bg-muted/40 rounded w-16" />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <div className="h-4 bg-muted/60 rounded w-32" />
                    <div className="h-3 bg-muted/40 rounded w-24" />
                  </div>
                  <div className="space-y-2 col-span-1 hidden md:block">
                    <div className="h-4 bg-muted/60 rounded w-20" />
                    <div className="h-3 bg-muted/40 rounded w-14" />
                  </div>
                  <div className="space-y-2 col-span-1 hidden md:block">
                    <div className="h-4 bg-muted/60 rounded w-24" />
                  </div>
                  <div className="space-y-2 col-span-1 hidden md:block">
                    <div className="h-4 bg-muted/60 rounded w-20" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <div className="h-8 bg-muted/60 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Server Error State */}
        {!isLoading && error && (
          <div className="p-8 text-center space-y-4" data-testid="payments-error-state">
            <div className="dialog-symbol bg-destructive/10 text-destructive mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Unable to Load Payment Reviews
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="cursor-pointer text-xs"
            >
              Retry Retrieval
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && payments.length === 0 && (
          <div className="p-12 text-center space-y-4" data-testid="payments-empty-state">
            <div className="dialog-symbol bg-muted text-muted-foreground mx-auto">
              <Inbox className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {isFiltered
                  ? 'No Payment Reviews Match the Selected Filter'
                  : 'No Manual Payment Reviews Found'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {isFiltered
                  ? `There are currently no top-up payment attempts in "${selectedStatus}" status.`
                  : 'There are currently no manual PKR wallet top-up payment attempts recorded in the database.'}
              </p>
            </div>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="cursor-pointer text-xs"
              >
                Clear Filter
              </Button>
            )}
          </div>
        )}

        {/* Desktop Table View */}
        {!isLoading && !error && payments.length > 0 && (
          <>
            <div className="table-scroll hidden md:block">
              <table className="w-full text-left" data-testid="manual-payments-table">
                <thead>
                  <tr>
                    <th>Payment Reference</th>
                    <th>Customer Identity</th>
                    <th>Monetary Amount</th>
                    <th>Method & Proof</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const statusInfo = getPaymentStatusBadgeInfo(payment.status);
                    return (
                      <tr
                        key={payment.id}
                        className="transition-colors hover:bg-muted/30"
                        data-testid={`payment-row-${payment.paymentNumber}`}
                      >
                        {/* Reference & Purpose */}
                        <td>
                          <div className="space-y-1">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {payment.paymentNumber}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <Wallet className="w-3 h-3 text-primary shrink-0" />
                              <span>Wallet Top-Up</span>
                            </div>
                          </div>
                        </td>

                        {/* Customer */}
                        <td>
                          <div className="space-y-0.5">
                            <div className="font-medium text-foreground text-xs">
                              {payment.customerFullName || 'Customer Account'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {payment.customerEmail || 'No email registered'}
                            </div>
                            {payment.customerSenderAccount && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Acct: {maskAccountNumber(payment.customerSenderAccount)}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td>
                          <div className="space-y-0.5">
                            <div className="font-semibold text-foreground text-xs tabular-nums">
                              {formatPaymentAmount(payment.Amount ?? payment.amount, payment.currency)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Authoritative Snapshot
                            </div>
                          </div>
                        </td>

                        {/* Method & Proof */}
                        <td>
                          <div className="space-y-0.5">
                            <div className="text-xs font-medium text-foreground">
                              {formatPaymentMethod(payment.paymentMethodCode)}
                            </div>
                            {payment.customerReference && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Ref: {payment.customerReference}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusInfo.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Created Date */}
                        <td>
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            <div>{formatPaymentDate(payment.createdAt)}</div>
                            {payment.paidAt && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                Paid: {formatPaymentDate(payment.paidAt)}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Action: View Details (READ-ONLY) */}
                        <td className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                            onClick={() => onViewDetail(payment.paymentNumber)}
                            aria-label={`View details for payment ${payment.paymentNumber}`}
                            data-testid={`view-detail-btn-${payment.paymentNumber}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="p-4 space-y-3 md:hidden" data-testid="manual-payments-mobile-cards">
              {payments.map((payment) => {
                const statusInfo = getPaymentStatusBadgeInfo(payment.status);
                return (
                  <div
                    key={payment.id}
                    className="p-4 rounded-lg border border-border bg-card space-y-3 shadow-xs"
                    data-testid={`payment-card-${payment.paymentNumber}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {payment.paymentNumber}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Wallet className="w-3 h-3 text-primary" />
                          <span>Wallet Top-Up</span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${statusInfo.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-border/60">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Customer</span>
                        <span className="font-medium text-foreground truncate block">
                          {payment.customerFullName || 'Customer'}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {payment.customerEmail || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Amount</span>
                        <span className="font-semibold text-foreground tabular-nums block">
                          {formatPaymentAmount(payment.Amount ?? payment.amount, payment.currency)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatPaymentMethod(payment.paymentMethodCode)}
                        </span>
                      </div>
                    </div>

                    {payment.customerSenderAccount && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Sender Acct: {maskAccountNumber(payment.customerSenderAccount)}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{formatPaymentDate(payment.createdAt)}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 cursor-pointer"
                        onClick={() => onViewDetail(payment.paymentNumber)}
                        aria-label={`Inspect ${payment.paymentNumber}`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Details</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Server-Side Pagination Footer */}
        {!isLoading && !error && totalCount > 0 && (
          <div className="table-footer flex-wrap gap-2" data-testid="payments-pagination">
            <div className="text-xs text-muted-foreground">
              Showing{' '}
              <span className="font-medium text-foreground">
                {(page - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-foreground">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-medium text-foreground">{totalCount}</span> payments
            </div>

            <div className="pagination ml-auto flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs cursor-pointer"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
                data-testid="pagination-prev-btn"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </Button>

              <span className="text-xs text-muted-foreground px-2">
                Page <span className="font-semibold text-foreground">{page}</span> of{' '}
                <span className="font-semibold text-foreground">{totalPages || 1}</span>
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs cursor-pointer"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
                data-testid="pagination-next-btn"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
