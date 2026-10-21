import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  startManualFulfillment,
  type AdminFulfillmentDto,
  getParentOrderStatusBadgeInfo,
  isAmbiguousFulfillmentError,
  markUnresolvedOperation,
  getUnresolvedOperation,
  clearUnresolvedOperation,
} from '@/lib/fulfillments-api';
import { ApiClientError } from '@/lib/api-client';
import {
  Workflow,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  Info,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export interface ManualFulfillmentStartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string | null;
  orderItemId: number | null;
  productName?: string;
  productSku?: string;
  quantityRequested?: number;
  parentOrderStatus?: string;
  isGloballyEnabled?: boolean | null;
  isProductApproved?: boolean | null;
  onSuccess: (updatedFulfillment: AdminFulfillmentDto) => void;
  onReconcile?: () => Promise<void>;
}

export function ManualFulfillmentStartDialog({
  isOpen,
  onClose,
  orderNumber,
  orderItemId,
  productName = 'Unknown Product',
  productSku = 'UNKNOWN',
  quantityRequested = 1,
  parentOrderStatus = 'Processing',
  isGloballyEnabled = false,
  isProductApproved = false,
  onSuccess,
  onReconcile,
}: ManualFulfillmentStartDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState<boolean>(false);
  const [isAmbiguousOutcome, setIsAmbiguousOutcome] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Restore existing unresolved ambiguous operation or reset state when opening
  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      const existingUnresolved = getUnresolvedOperation(orderNumber, orderItemId, 'start');
      if (existingUnresolved) {
        setIsAmbiguousOutcome(true);
        setError(existingUnresolved.errorSummary);
        setIsConflict(false);
      } else {
        setError(null);
        setIsConflict(false);
        setIsAmbiguousOutcome(false);
      }
    }
  }, [isOpen, orderNumber, orderItemId]);

  const isOrderProcessing = parentOrderStatus === 'Processing';
  const isFeatureAvailable = Boolean(isGloballyEnabled);
  const isSkuApproved = Boolean(isProductApproved);
  const isEligible = isOrderProcessing && isFeatureAvailable && isSkuApproved;

  const orderStatusBadge = getParentOrderStatusBadgeInfo(parentOrderStatus);

  const handleConfirmStart = async () => {
    // Synchronous multi-guard: block if invalid, in-flight, ambiguous, or ineligible
    if (
      !orderNumber ||
      !orderItemId ||
      isSubmitting ||
      isSubmittingRef.current ||
      isAmbiguousOutcome ||
      !isEligible
    ) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setIsConflict(false);

    try {
      const result = await startManualFulfillment(orderNumber, orderItemId);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      clearUnresolvedOperation(orderNumber, orderItemId, 'start');
      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      if (isAmbiguousFulfillmentError(err)) {
        const errorMsg =
          err instanceof ApiClientError && err.status !== 0
            ? `The server returned an ambiguous response (HTTP ${err.status}) before manual fulfillment could be confirmed. To prevent duplicate delivery dispatch, the action was NOT automatically re-sent. Manual review is strictly required.`
            : 'The request timed out or network was interrupted before receiving confirmation. To prevent duplicate delivery, the action was NOT automatically re-sent. Verifying server state...';

        markUnresolvedOperation({
          orderNumber,
          orderItemId,
          operationType: 'start',
          recordedAt: new Date().toISOString(),
          errorSummary: errorMsg,
        });

        setIsAmbiguousOutcome(true);
        setError(errorMsg);

        if (onReconcile) {
          void onReconcile();
        }
        return;
      }

      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setIsConflict(true);
          setError(
            err.message ||
              'A conflict occurred. Another administrator or process may have updated this fulfillment attempt.'
          );
          if (onReconcile) {
            void onReconcile();
          }
          return;
        }

        if (err.status === 403) {
          setError(
            err.message ||
              'Manual fulfillment access is forbidden. Server policy or product allowlist does not permit manual fulfillment.'
          );
          return;
        }

        setError(err.message || 'Failed to start manual fulfillment.');
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while starting manual fulfillment.'
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="max-w-lg p-0 gap-0 border-border bg-card shadow-2xl overflow-hidden"
        data-testid="manual-fulfillment-start-dialog"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/30">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Workflow className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  Start Manual Fulfillment
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  Order {orderNumber || '—'} · Item #{orderItemId || '—'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Snapshot Card */}
          <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
              <ShoppingBag className="w-3.5 h-3.5" />
              Line Item Snapshot
            </div>
            <div className="grid grid-cols-2 gap-2 text-foreground">
              <div>
                <span className="text-muted-foreground block text-[11px]">Product:</span>
                <span className="font-semibold">{productName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">SKU:</span>
                <span className="font-mono">{productSku}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Quantity:</span>
                <span className="font-mono font-semibold">{quantityRequested} item(s)</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Parent Order Status:</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${orderStatusBadge.badgeClass}`}
                >
                  {orderStatusBadge.dotClass && (
                    <span className={`w-1 h-1 rounded-full ${orderStatusBadge.dotClass}`} />
                  )}
                  {orderStatusBadge.label}
                </span>
              </div>
            </div>
          </div>

          {/* Eligibility Warnings */}
          {!isFeatureAvailable && (
            <div
              className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
              data-testid="start-dialog-feature-disabled-warning"
            >
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold block">Manual Fulfillment Disabled</span>
                <span>
                  The manual fulfillment feature gate is currently disabled by server configuration.
                  No delivery operations can be started.
                </span>
              </div>
            </div>
          )}

          {isFeatureAvailable && !isSkuApproved && (
            <div
              className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
              data-testid="start-dialog-sku-unapproved-warning"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold block">Product Not Approved for Pilot</span>
                <span>
                  Product SKU <code className="font-mono font-bold">{productSku}</code> is not on the server-approved
                  manual fulfillment allowlist.
                </span>
              </div>
            </div>
          )}

          {!isOrderProcessing && (
            <div
              className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
              data-testid="start-dialog-order-status-warning"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold block">Order Must Be In Processing</span>
                <span>
                  Parent order is currently in <strong className="font-semibold">{parentOrderStatus}</strong> status.
                  Manual fulfillment can only be initiated once the order is actively Processing.
                </span>
              </div>
            </div>
          )}

          {/* Operational Explanation */}
          {isEligible && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-300 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-purple-700 dark:text-purple-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>Tracked Administrative Action</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Starting manual fulfillment assigns this line item to an external dispatch workflow,
                records a new attempt in the database, and transitions fulfillment to{' '}
                <strong className="text-foreground">In Progress</strong>.
              </p>
            </div>
          )}

          {/* Ambiguous Network Failure Alert */}
          {isAmbiguousOutcome && (
            <div
              className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2"
              data-testid="start-dialog-ambiguous-alert"
              role="alert"
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Manual Review Required</span>
              </div>
              <p className="text-[11px]">{error}</p>
              <p className="text-[10px] text-muted-foreground italic">
                Do not attempt duplicate clicks. Check the fulfillment attempt history to see if the action registered.
              </p>
            </div>
          )}

          {/* Conflict or Error Banner */}
          {!isAmbiguousOutcome && error && (
            <div
              className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 text-xs space-y-1"
              data-testid="start-dialog-error-banner"
              role="alert"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{isConflict ? 'State Conflict' : 'Action Failed'}</span>
              </div>
              <p className="text-[11px]">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-8"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmStart}
            disabled={!isEligible || isSubmitting || isAmbiguousOutcome}
            className="text-xs h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50"
            data-testid="confirm-start-fulfillment-btn"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Starting Fulfillment...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Start</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}