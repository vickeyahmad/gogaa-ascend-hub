import { useState, useEffect } from 'react';
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
  getAdminOrderDetail,
  formatOrderPrice,
  formatOrderDate,
  getOrderStatusBadgeInfo,
  getPaymentStatusBadgeInfo,
  getSalesChannelBadgeInfo,
  type AdminOrderDetailDto,
} from '@/lib/orders-api';
import {
  Receipt,
  User,
  ShoppingBag,
  CreditCard,
  History,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Info,
} from 'lucide-react';

export interface OrderDetailDialogProps {
  orderNumber: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailDialog({
  orderNumber,
  isOpen,
  onClose,
}: OrderDetailDialogProps) {
  const [detail, setDetail] = useState<AdminOrderDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !orderNumber) {
      setDetail(null);
      setError(null);
      return;
    }

    let isCancelled = false;

    async function loadDetail() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAdminOrderDetail(orderNumber as string);
        if (!isCancelled) {
          setDetail(data);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load order details.';
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, orderNumber]);

  const handleCopyOrderNumber = () => {
    if (!orderNumber) return;
    navigator.clipboard?.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = detail ? getOrderStatusBadgeInfo(detail.status) : null;
  const channelBadge = detail ? getSalesChannelBadgeInfo(detail.salesChannel) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card shadow-2xl"
        data-testid="order-detail-dialog"
      >
        {/* Header Banner */}
        <div className="p-6 border-b border-border bg-muted/30">
          <DialogHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-bold tracking-tight">
                      Order {orderNumber || ''}
                    </DialogTitle>
                    {orderNumber && (
                      <button
                        type="button"
                        onClick={handleCopyOrderNumber}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                        title="Copy Order Number"
                        aria-label="Copy order number"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Historical order snapshot · Read-only administrator view
                  </DialogDescription>
                </div>
              </div>

              {detail && (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${channelBadge?.badgeClass}`}
                    data-testid="detail-sales-channel"
                  >
                    {channelBadge?.label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge?.badgeClass}`}
                    data-testid="detail-order-status"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge?.dotClass}`} />
                    {statusBadge?.label}
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="py-12 space-y-4" data-testid="detail-loading-skeleton">
              <SkeletonLoader />
              <p className="text-xs text-center text-muted-foreground">
                Loading order details from database...
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div
              className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-3"
              data-testid="detail-error-banner"
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Failed to load order snapshot</span>
              </div>
              <p className="text-xs">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (orderNumber) {
                    setIsLoading(true);
                    setError(null);
                    getAdminOrderDetail(orderNumber)
                      .then((data) => setDetail(data))
                      .catch((err: unknown) => {
                        const msg =
                          err instanceof Error ? err.message : 'Failed to load order.';
                        setError(msg);
                      })
                      .finally(() => setIsLoading(false));
                  }
                }}
                className="gap-1.5 text-xs h-8"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            </div>
          )}

          {detail && !isLoading && (
            <div className="space-y-6">
              {/* Order Meta Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Identity Card */}
                <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    Customer Identity
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-semibold text-foreground" data-testid="detail-customer-name">
                        {detail.customerName || 'Guest / Not Specified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-mono text-foreground" data-testid="detail-customer-email">
                        {detail.customerEmail || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-mono text-foreground" data-testid="detail-customer-phone">
                        {detail.customerPhoneNumber || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer ID:</span>
                      <span className="font-mono text-xs text-muted-foreground" data-testid="detail-customer-id">
                        {detail.customerId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Summary & Timestamps Card */}
                <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Order Timestamps & ID
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="font-mono font-medium text-foreground">
                        #{detail.orderId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created At:</span>
                      <span className="text-foreground" data-testid="detail-created-at">
                        {formatOrderDate(detail.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span className="text-foreground" data-testid="detail-updated-at">
                        {formatOrderDate(detail.updatedAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sales Channel:</span>
                      <span className="font-semibold text-foreground">
                        {channelBadge?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Notes (if provided) */}
              {detail.customerNotes && (
                <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Customer Notes:
                  </span>
                  <p className="text-xs text-foreground italic" data-testid="detail-customer-notes">
                    &ldquo;{detail.customerNotes}&rdquo;
                  </p>
                </div>
              )}

              {/* Purchased Products (Historical Snapshots) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    <span>Purchased Items Snapshot</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Historical unit prices locked at order placement
                  </span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs" data-testid="detail-items-table">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Product SKU</th>
                        <th className="py-2.5 px-3 text-left">Product Name</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.items && detail.items.length > 0 ? (
                        detail.items.map((item, idx) => (
                          <tr key={`${item.productSku}-${idx}`} className="hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                              {item.productSku}
                            </td>
                            <td className="py-2.5 px-3 text-foreground font-medium">
                              {item.productName}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                              {formatOrderPrice(item.unitPrice, item.currency)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                              {formatOrderPrice(item.totalPrice, item.currency)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground">
                            No product line items recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-muted/40 border-t border-border font-semibold">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right text-muted-foreground">
                          Order Total:
                        </td>
                        <td
                          className="py-2.5 px-3 text-right font-mono font-bold text-sm text-foreground"
                          data-testid="detail-total-amount"
                        >
                          {formatOrderPrice(detail.totalAmount, detail.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Verified OrderPurchase Payment Attempts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span>Verified Payment Attempts</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    OrderPurchase payments only · Wallet top-ups isolated
                  </span>
                </div>

                {detail.payments && detail.payments.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs" data-testid="detail-payments-table">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Payment #</th>
                          <th className="py-2.5 px-3 text-left">Method</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-left">Paid At</th>
                          <th className="py-2.5 px-3 text-left">Provider Ref</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detail.payments.map((p, idx) => {
                          const pBadge = getPaymentStatusBadgeInfo(p.status);
                          return (
                            <tr key={p.paymentNumber || idx} className="hover:bg-muted/20">
                              <td className="py-2.5 px-3 font-mono text-foreground font-medium">
                                {p.paymentNumber}
                              </td>
                              <td className="py-2.5 px-3 text-foreground font-medium">
                                {p.paymentMethod}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                {formatOrderPrice(p.amount, p.currency)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${pBadge.badgeClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${pBadge.dotClass}`} />
                                  {pBadge.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {p.paidAt ? formatOrderDate(p.paidAt) : '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">
                                {p.providerTransactionId || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground"
                    data-testid="detail-no-payments"
                  >
                    No verified payment records found for this order.
                  </div>
                )}
              </div>

              {/* Order Status History Audit Trail */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <History className="w-4 h-4 text-primary" />
                  <span>Order Status History</span>
                </div>

                {detail.statusHistory && detail.statusHistory.length > 0 ? (
                  <div className="border border-border rounded-lg divide-y divide-border bg-card">
                    {detail.statusHistory.map((h) => {
                      const prevBadge = h.previousStatus
                        ? getOrderStatusBadgeInfo(h.previousStatus)
                        : null;
                      const nextBadge = getOrderStatusBadgeInfo(h.newStatus);
                      return (
                        <div
                          key={h.id}
                          className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/10"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {prevBadge ? (
                                <>
                                  <span className="text-muted-foreground">From</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${prevBadge.badgeClass}`}
                                  >
                                    {prevBadge.label}
                                  </span>
                                  <span className="text-muted-foreground">&rarr;</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">Initial status:</span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${nextBadge.badgeClass}`}
                              >
                                {nextBadge.label}
                              </span>
                            </div>
                            {h.reason && (
                              <p className="text-muted-foreground text-[11px]">
                                Note: {h.reason}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-muted-foreground font-mono">
                              {formatOrderDate(h.changedAt)}
                            </div>
                            {h.changedByUserId && (
                              <div className="text-[10px] text-muted-foreground">
                                Actor: {h.changedByUserId}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                    No status transition history recorded yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Read-only inspection · Order processing workflow reserved for Milestone 6B-4B</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="px-5">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
