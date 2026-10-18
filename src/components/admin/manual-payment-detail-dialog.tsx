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
  getAdminManualPaymentDetail,
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentMethod,
  maskAccountNumber,
  maskReceivingAccount,
  getPaymentStatusBadgeInfo,
  type AdminManualPaymentDto,
} from '@/lib/manual-payments-api';
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
  Building2,
  Calendar,
  Lock,
} from 'lucide-react';

export interface ManualPaymentDetailDialogProps {
  paymentNumber: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ManualPaymentDetailDialog({
  paymentNumber,
  isOpen,
  onClose,
}: ManualPaymentDetailDialogProps) {
  const [detail, setDetail] = useState<AdminManualPaymentDto | null>(null);
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
        const data = await getAdminManualPaymentDetail(paymentNumber as string);
        if (!isCancelled) {
          setDetail(data);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load manual payment details.';
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="manual-payment-detail-dialog"
      >
        <DialogHeader className="space-y-3 pb-3 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold font-display text-foreground">
                  Manual Payment Review
                </DialogTitle>
                {detail && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold border ${statusBadge?.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge?.dotClass}`} />
                    {statusBadge?.label}
                  </span>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Authoritative financial record and status history from PostgreSQL.
              </DialogDescription>
            </div>

            {paymentNumber && (
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-md border border-border">
                <span className="font-mono text-xs font-semibold text-foreground">
                  {paymentNumber}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={handleCopy}
                  title="Copy payment number"
                  aria-label="Copy payment number"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Loading state */}
        {isLoading && (
          <div className="py-8 space-y-4" data-testid="detail-dialog-loading">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <CreditCard className="w-4 h-4 animate-pulse text-primary" />
              <span>Loading complete payment details and status history...</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-24 bg-muted/40 rounded-lg animate-pulse" />
              <div className="h-24 bg-muted/40 rounded-lg animate-pulse" />
            </div>
            <div className="h-32 bg-muted/40 rounded-lg animate-pulse" />
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="py-8 text-center space-y-3" data-testid="detail-dialog-error">
            <div className="dialog-symbol bg-destructive/10 text-destructive mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Failed to Load Details</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
          </div>
        )}

        {/* Loaded Detail Content */}
        {!isLoading && !error && detail && (
          <div className="space-y-5 py-2 text-xs">
            {/* Read-Only Notice Alert */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15 text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-xs text-primary">Read-Only Financial View</div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  This interface provides immutable administrative visibility into customer top-ups. Payment approvals, rejections, or balance mutations cannot be initiated from this view.
                </div>
              </div>
            </div>

            {/* Financial & Purpose Summary Card */}
            <div className="p-4 rounded-lg bg-card border border-border space-y-3">
              <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                <CreditCard className="w-4 h-4 text-primary" />
                <span>Financial Transaction Snapshot</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Top-Up Amount</span>
                  <span className="text-base font-bold text-foreground tabular-nums block">
                    {formatPaymentAmount(detail.amount, detail.currency)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Frozen Snapshot</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Payment Purpose</span>
                  <span className="font-semibold text-foreground block">
                    {detail.purpose === 'WalletTopUp' ? 'Wallet Top-Up' : detail.purpose}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Customer PKR Wallet</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Payment Method</span>
                  <span className="font-semibold text-foreground block">
                    {formatPaymentMethod(detail.paymentMethodCode)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {detail.paymentMethodCode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Created Timestamp</span>
                  <span className="font-medium text-foreground block">
                    {formatPaymentDate(detail.createdAt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">UTC Database Record</span>
                </div>
              </div>
            </div>

            {/* Customer Identity & Declared Transfer Details Card */}
            <div className="p-4 rounded-lg bg-card border border-border space-y-3">
              <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                <User className="w-4 h-4 text-primary" />
                <span>Customer Identity & Transfer Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Full Name</span>
                  <span className="font-medium text-foreground block">
                    {detail.customerFullName || 'Customer Account'}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {detail.customerEmail || 'No email provided'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    Customer Reference / TID
                  </span>
                  <span className="font-mono font-medium text-foreground block">
                    {detail.customerReference || 'Not provided'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Declared by customer</span>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground block">Sender Account</span>
                    <Lock className="w-2.5 h-2.5 text-muted-foreground" />
                  </div>
                  <span className="font-mono font-medium text-foreground block">
                    {maskAccountNumber(detail.customerSenderAccount)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Masked for privacy</span>
                </div>
              </div>

              {/* Transfer Date & Customer Notes */}
              {(detail.customerTransferDate || detail.customerNotes) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
                  {detail.customerTransferDate && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Customer Transfer Date
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPaymentDate(detail.customerTransferDate)}
                      </span>
                    </div>
                  )}
                  {detail.customerNotes && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Customer Notes / Memo
                      </span>
                      <p className="text-[11px] text-foreground bg-muted/40 p-2 rounded border border-border/60 mt-0.5">
                        {detail.customerNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Verification Metadata (If Verified) */}
            {(detail.verifiedByUserName || detail.verifiedReceivingAccount || detail.paidAt || detail.adminNotes) && (
              <div className="p-4 rounded-lg bg-card border border-border space-y-3">
                <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Administrative Verification Snapshot</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {detail.verifiedByUserName && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Verified By</span>
                      <span className="font-medium text-foreground block">
                        {detail.verifiedByUserName}
                      </span>
                    </div>
                  )}
                  {detail.verifiedReceivingAccount && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Receiving Account Identifier
                      </span>
                      <span className="font-medium text-foreground block font-mono">
                        {maskReceivingAccount(detail.verifiedReceivingAccount)}
                      </span>
                    </div>
                  )}
                  {detail.paidAt && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Settled Timestamp</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 block">
                        {formatPaymentDate(detail.paidAt)}
                      </span>
                    </div>
                  )}
                </div>
                {detail.adminNotes && (
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Reviewer Notes</span>
                    <p className="text-[11px] text-foreground bg-muted/40 p-2 rounded border border-border/60 mt-0.5">
                      {detail.adminNotes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Audit History Timeline */}
            <div className="p-4 rounded-lg bg-card border border-border space-y-3">
              <div className="flex items-center gap-2 font-semibold text-foreground text-xs">
                <History className="w-4 h-4 text-primary" />
                <span>Payment Status Audit Trail</span>
              </div>

              {detail.statusHistory && detail.statusHistory.length > 0 ? (
                <div className="space-y-2.5 pt-1">
                  {detail.statusHistory.map((history, idx) => {
                    const hBadge = getPaymentStatusBadgeInfo(history.newStatus);
                    return (
                      <div
                        key={history.id || idx}
                        className="flex items-start gap-3 p-2.5 rounded-md bg-muted/30 border border-border/60"
                        data-testid={`history-entry-${history.id || idx}`}
                      >
                        <div className="mt-1">
                          <span className={`w-2 h-2 rounded-full block ${hBadge.dotClass}`} />
                        </div>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-semibold text-foreground text-xs">
                              {history.previousStatus
                                ? `${history.previousStatus} → ${history.newStatus}`
                                : `Initial: ${history.newStatus}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatPaymentDate(history.changedAt)}
                            </span>
                          </div>
                          {history.reason && (
                            <p className="text-[11px] text-muted-foreground">{history.reason}</p>
                          )}
                          {history.changedByUserName && (
                            <div className="text-[10px] text-muted-foreground">
                              Actor: {history.changedByUserName}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted-foreground text-xs italic py-2">
                  No subsequent status transitions recorded.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dialog Footer - READ-ONLY (No Approve / Reject / Refund / Edit buttons) */}
        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Strictly Read-Only · Mutation buttons disabled</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="cursor-pointer text-xs"
            data-testid="detail-dialog-close-btn"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
