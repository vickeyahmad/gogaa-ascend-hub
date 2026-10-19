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
  getAdminPaymentDetail,
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentMethod,
  getPaymentPurposeBadge,
  getPaymentStatusBadgeInfo,
  maskAccountNumber,
  type AdminPaymentDetailDto,
} from '@/lib/payments-api';
import {
  CreditCard,
  User,
  Wallet,
  History,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Info,
  Calendar,
  Lock,
  ShoppingCart,
  FileText,
} from 'lucide-react';

export interface PaymentDetailDialogProps {
  paymentNumber: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentDetailDialog({
  paymentNumber,
  isOpen,
  onClose,
}: PaymentDetailDialogProps) {
  const [detail, setDetail] = useState<AdminPaymentDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !paymentNumber) {
      setDetail(null);
      setError(null);
      return;
    }

    let isCancelled = false;

    async function loadDetail() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAdminPaymentDetail(paymentNumber as string);
        if (!isCancelled) {
          setDetail(data);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load payment details.';
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
  }, [isOpen, paymentNumber]);

  const handleCopy = () => {
    if (!paymentNumber) return;
    void navigator.clipboard?.writeText(paymentNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = detail ? getPaymentStatusBadgeInfo(detail.status) : null;
  const purposeBadge = detail ? getPaymentPurposeBadge(detail.purpose) : null;
  const isOrder = detail?.purpose === 'OrderPurchase';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card shadow-2xl"
        aria-describedby="payment-detail-description"
      >
        {/* Dialog Header */}
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/20 sticky top-0 z-10 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <DialogTitle className="text-base font-semibold font-mono tracking-tight text-foreground">
                  {paymentNumber || 'Payment Detail'}
                </DialogTitle>
                {paymentNumber && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleCopy}
                    title="Copy payment number"
                    aria-label="Copy payment number"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
              <DialogDescription id="payment-detail-description" className="text-xs text-muted-foreground">
                Authoritative read-only payment record from the central billing system.
              </DialogDescription>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2">
              {purposeBadge && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${purposeBadge.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${purposeBadge.dotClass}`} />
                  {purposeBadge.label}
                </span>
              )}
              {statusBadge && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${statusBadge.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                  {statusBadge.label}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-4" role="status" aria-label="Loading payment details">
              <div className="grid grid-cols-2 gap-4">
                <SkeletonLoader className="h-16 rounded-lg" />
                <SkeletonLoader className="h-16 rounded-lg" />
              </div>
              <SkeletonLoader className="h-28 rounded-lg" />
              <SkeletonLoader className="h-40 rounded-lg" />
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-6 text-center space-y-3" role="alert">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                Failed to load payment details
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
            </div>
          )}

          {/* Details Content */}
          {!isLoading && !error && detail && (
            <div className="space-y-6 text-xs">
              {/* Top Highlights: Financial Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Payment Amount
                  </span>
                  <div className="text-base font-bold text-foreground">
                    {formatPaymentAmount(detail.amount, detail.currency)}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    Authoritative stored value
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Payment Method
                  </span>
                  <div className="text-sm font-semibold text-foreground">
                    {formatPaymentMethod(detail.paymentMethodCode)}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    {detail.paymentMethodCode}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Target Domain
                  </span>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {isOrder ? (
                      <>
                        <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                        <span>Order #{detail.orderNumber || detail.orderId}</span>
                      </>
                    ) : (
                      <>
                        <Wallet className="w-3.5 h-3.5 text-purple-500" />
                        <span>Wallet #{detail.walletId}</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {isOrder ? 'Funds specific customer order' : 'Funds customer wallet balance'}
                  </span>
                </div>
              </div>

              {/* Customer Identity Section */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center gap-2 font-medium text-foreground">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Customer Identity</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Customer Name</span>
                    <span className="font-medium text-foreground">
                      {detail.customerFullName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Email Address</span>
                    <span className="font-medium text-foreground">
                      {detail.customerEmail || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Customer ID</span>
                    <span className="font-mono text-foreground">{detail.customerId}</span>
                  </div>
                </div>
              </div>

              {/* Payment Verification & Transfer Reference Details */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Transfer Verification & Audit Information</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer TID Reference */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">
                      Customer-Declared Reference / TID
                    </span>
                    <div className="font-mono font-medium text-foreground bg-muted/40 px-2 py-1 rounded border border-border/40 inline-block">
                      {detail.customerReference || 'None declared'}
                    </div>
                  </div>

                  {/* Provider Transaction ID */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">
                      Provider / Bank Transaction ID
                    </span>
                    <div className="font-mono font-medium text-foreground bg-muted/40 px-2 py-1 rounded border border-border/40 inline-block">
                      {detail.providerTransactionId || 'None recorded'}
                    </div>
                  </div>

                  {/* Customer Sender Account (Safely Masked) */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                      Sender Account (Masked)
                    </span>
                    <div className="font-mono text-foreground">
                      {maskAccountNumber(detail.customerSenderAccount)}
                    </div>
                  </div>

                  {/* Receiving Bank Account (Safely Masked) */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                      Receiving Account (Masked)
                    </span>
                    <div className="font-mono text-foreground">
                      {maskAccountNumber(detail.verifiedReceivingAccount)}
                    </div>
                  </div>

                  {/* Customer Transfer Date */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Customer Transfer Date</span>
                    <div className="text-foreground">{formatPaymentDate(detail.customerTransferDate)}</div>
                  </div>

                  {/* Proof Submitted Timestamp */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Proof Submitted At</span>
                    <div className="text-foreground">
                      {formatPaymentDate(detail.customerProofSubmittedAt)}
                    </div>
                  </div>

                  {/* Verified By Administrator */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Verified By Administrator</span>
                    <div className="text-foreground">
                      {detail.verifiedByUserName || detail.verifiedByUserId || '—'}
                    </div>
                  </div>

                  {/* Verified Timestamp */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">Verified At</span>
                    <div className="text-foreground">{formatPaymentDate(detail.verifiedAt)}</div>
                  </div>

                  {/* Customer Notes */}
                  {detail.customerNotes && (
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[10px] text-muted-foreground block">Customer Notes</span>
                      <div className="p-2.5 rounded bg-muted/30 border border-border/40 text-foreground">
                        {detail.customerNotes}
                      </div>
                    </div>
                  )}

                  {/* Administrator Notes */}
                  {detail.adminNotes && (
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[10px] text-muted-foreground block">Administrator Notes</span>
                      <div className="p-2.5 rounded bg-muted/30 border border-border/40 text-foreground">
                        {detail.adminNotes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status History Timeline */}
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center gap-2 font-medium text-foreground">
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span>Status Transition Audit Trail</span>
                </div>
                <div className="p-4">
                  {detail.statusHistory && detail.statusHistory.length > 0 ? (
                    <ol className="relative border-l border-border/60 ml-3 space-y-4 py-1">
                      {detail.statusHistory.map((h) => {
                        const newBadge = getPaymentStatusBadgeInfo(h.newStatus);
                        return (
                          <li key={h.id} className="ml-4 space-y-1">
                            <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-background bg-primary" />
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${newBadge.badgeClass}`}
                              >
                                {newBadge.label}
                              </span>
                              {h.previousStatus && (
                                <span className="text-[10px] text-muted-foreground">
                                  (from {h.previousStatus})
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {formatPaymentDate(h.changedAt)}
                              </span>
                            </div>
                            {h.reason && (
                              <p className="text-muted-foreground text-[11px]">{h.reason}</p>
                            )}
                            {h.changedByUserName && (
                              <span className="text-[10px] text-muted-foreground block">
                                By: {h.changedByUserName}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      No status transitions recorded.
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[10px] text-muted-foreground border-t border-border/40">
                <span>Created: {formatPaymentDate(detail.createdAt)}</span>
                <span>Last Updated: {formatPaymentDate(detail.updatedAt)}</span>
                {detail.paidAt && <span>Paid: {formatPaymentDate(detail.paidAt)}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer - Pure Read-Only Close */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-only inspection · No mutation controls</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
