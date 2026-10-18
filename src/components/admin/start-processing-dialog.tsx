import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  formatOrderPrice,
  getOrderStatusBadgeInfo,
  validateProcessingReason,
} from '@/lib/orders-api';
import {
  PlayCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Receipt,
  User,
  Info,
} from 'lucide-react';

export interface StartProcessingDialogProps {
  isOpen: boolean;
  orderNumber: string | null;
  orderTotal?: number;
  currency?: string;
  customerName?: string | null;
  customerEmail?: string | null;
  currentStatus?: string;
  isSubmitting: boolean;
  error: string | null;
  isAmbiguousFailure?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function StartProcessingDialog({
  isOpen,
  orderNumber,
  orderTotal = 0,
  currency = 'PKR',
  customerName,
  customerEmail,
  currentStatus = 'Paid',
  isSubmitting,
  error,
  isAmbiguousFailure = false,
  onConfirm,
  onClose,
}: StartProcessingDialogProps) {
  const [reason, setReason] = useState<string>('');
  const [clientError, setClientError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setClientError(null);
    }
  }, [isOpen]);

  const handleReasonChange = (value: string) => {
    setReason(value);
    const err = validateProcessingReason(value);
    setClientError(err);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !orderNumber) return;

    const validationErr = validateProcessingReason(reason);
    if (validationErr) {
      setClientError(validationErr);
      return;
    }

    await onConfirm(reason);
  };

  const statusBadge = getOrderStatusBadgeInfo(currentStatus);
  const isEligible = currentStatus === 'Paid';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="max-w-xl p-0 gap-0 border-border bg-card shadow-2xl overflow-hidden"
        data-testid="start-processing-dialog"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/30">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <PlayCircle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Start Order Processing
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Advance eligible order into administrative handling.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content Form */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
          {/* Order Snapshot Card */}
          <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono font-bold text-foreground text-sm" data-testid="dialog-order-number">
                  {orderNumber || '—'}
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.badgeClass}`}
                data-testid="dialog-current-status"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                {statusBadge.label}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {customerName || customerEmail || 'Guest / Not Specified'}
              </span>
              <span className="font-mono font-bold text-foreground text-sm" data-testid="dialog-order-total">
                {formatOrderPrice(orderTotal, currency)}
              </span>
            </div>
          </div>

          {/* Lifecycle & Safety Scope Notice */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>What this action does:</span>
            </div>
            <ul className="space-y-1 text-muted-foreground text-[11px] list-disc list-inside">
              <li>
                Transitions order state from <strong className="text-foreground">Paid</strong> &rarr;{' '}
                <strong className="text-foreground">Processing</strong>.
              </li>
              <li>
                Records an auditable status history entry with your administrator ID.
              </li>
              <li>
                Backend enforces that verified payment exists matching exact order total and currency.
              </li>
            </ul>

            <div className="flex items-start gap-1.5 pt-2 border-t border-border text-[11px] text-muted-foreground italic">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span>
                Does NOT mark order delivered, does NOT trigger supplier purchases, and does NOT modify customer funds.
              </span>
            </div>
          </div>

          {/* Reason / Notes Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="processing-reason" className="font-semibold text-foreground">
                Processing Reason / Audit Notes{' '}
                <span className="font-normal text-muted-foreground">(Optional)</span>
              </label>
              <span
                className={`text-[10px] font-mono ${
                  reason.length > 500 ? 'text-destructive font-bold' : 'text-muted-foreground'
                }`}
                data-testid="character-counter"
              >
                {reason.length} / 500
              </span>
            </div>
            <textarea
              id="processing-reason"
              rows={3}
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Assigned to manual provisioning queue, verified customer requirements..."
              className="w-full p-2.5 text-xs rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              data-testid="processing-reason-input"
            />
            {clientError && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {clientError}
              </p>
            )}
          </div>

          {/* Ambiguous Network Failure Warning */}
          {error && isAmbiguousFailure && (
            <div
              className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 space-y-1.5 text-xs"
              data-testid="start-processing-ambiguous-alert"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Network Connection Interrupted</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                The request timed out or network disconnected. The server may have already processed this transition.
                Please <strong>refresh order details</strong> to verify its current status before retrying. Do not re-submit this action blindly.
              </p>
            </div>
          )}

          {/* Standard Backend Error Display */}
          {error && !isAmbiguousFailure && (
            <div
              className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive space-y-1 text-xs"
              data-testid="start-processing-error-banner"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Processing Request Rejected</span>
              </div>
              <p className="text-[11px]">{error}</p>
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isSubmitting || !isEligible || Boolean(clientError) || !orderNumber}
              className="gap-2 px-4 text-xs h-9 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm"
              data-testid="confirm-start-processing-btn"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Starting Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="w-3.5 h-3.5" />
                  Confirm Start Processing
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
