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
  completeManualFulfillment,
  validateDeliveryReference,
  APPROVED_DELIVERY_CHANNELS,
  APPROVED_OPERATIONAL_NOTES,
  APPROVED_REFERENCE_PREFIXES,
  type AdminFulfillmentDto,
  type ApprovedDeliveryChannel,
  isAmbiguousFulfillmentError,
  markUnresolvedOperation,
  getUnresolvedOperation,
  clearUnresolvedOperation,
} from '@/lib/fulfillments-api';
import { ApiClientError } from '@/lib/api-client';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  Info,
  Lock,
} from 'lucide-react';

export interface ManualFulfillmentCompleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string | null;
  orderItemId: number | null;
  productName?: string;
  productSku?: string;
  quantityRequested?: number;
  attemptNumber?: number;
  attemptKey?: string;
  onSuccess: (updatedFulfillment: AdminFulfillmentDto) => void;
  onReconcile?: () => Promise<void>;
}

export function ManualFulfillmentCompleteDialog({
  isOpen,
  onClose,
  orderNumber,
  orderItemId,
  productName = 'Unknown Product',
  productSku = 'UNKNOWN',
  quantityRequested = 1,
  attemptNumber = 1,
  attemptKey = '—',
  onSuccess,
  onReconcile,
}: ManualFulfillmentCompleteDialogProps) {
  const [deliveryChannel, setDeliveryChannel] = useState<ApprovedDeliveryChannel>('EmailSupport');
  const [deliveryReference, setDeliveryReference] = useState<string>('TICKET-');
  const [selectedNote, setSelectedNote] = useState<string>('');
  const [confirmDelivered, setConfirmDelivered] = useState<boolean>(false);

  const [clientError, setClientError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConflict, setIsConflict] = useState<boolean>(false);
  const [isAmbiguousOutcome, setIsAmbiguousOutcome] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Restore existing unresolved ambiguous operation or reset form when opening
  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      const existingUnresolved = getUnresolvedOperation(orderNumber, orderItemId, 'complete');
      if (existingUnresolved) {
        setIsAmbiguousOutcome(true);
        setError(existingUnresolved.errorSummary);
        setIsConflict(false);
      } else {
        setDeliveryChannel('EmailSupport');
        setDeliveryReference('TICKET-');
        setSelectedNote('');
        setConfirmDelivered(false);
        setClientError(null);
        setError(null);
        setIsConflict(false);
        setIsAmbiguousOutcome(false);
      }
    }
  }, [isOpen, orderNumber, orderItemId]);

  const handleReferenceChange = (val: string) => {
    setDeliveryReference(val);
    if (val.trim()) {
      const check = validateDeliveryReference(val);
      if (!check.isValid) {
        setClientError(check.errorMessage || 'Invalid delivery reference format.');
      } else {
        setClientError(null);
      }
    } else {
      setClientError('Delivery reference is required.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !orderNumber ||
      !orderItemId ||
      isSubmitting ||
      isSubmittingRef.current ||
      isAmbiguousOutcome
    ) {
      return;
    }

    if (!confirmDelivered) {
      setClientError('You must explicitly confirm actual delivery before completing this fulfillment.');
      return;
    }

    const refCheck = validateDeliveryReference(deliveryReference);
    if (!refCheck.isValid) {
      setClientError(refCheck.errorMessage || 'Invalid delivery reference.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setClientError(null);
    setIsConflict(false);

    try {
      const result = await completeManualFulfillment(orderNumber, orderItemId, {
        confirmDelivered: true,
        deliveryReference: refCheck.normalized,
        deliveryChannel,
        notes: selectedNote.trim() ? selectedNote.trim() : null,
      });

      isSubmittingRef.current = false;
      setIsSubmitting(false);
      clearUnresolvedOperation(orderNumber, orderItemId, 'complete');
      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      if (isAmbiguousFulfillmentError(err)) {
        const errorMsg =
          err instanceof ApiClientError && err.status !== 0
            ? `The server returned an ambiguous response (HTTP ${err.status}) before delivery completion could be confirmed. To prevent duplicate delivery dispatch, the completion was NOT automatically re-sent. Manual review is strictly required.`
            : 'The network connection timed out or disconnected before receiving confirmation. To prevent duplicate dispatch, the completion was NOT automatically re-sent. Reconciling server state...';

        markUnresolvedOperation({
          orderNumber,
          orderItemId,
          operationType: 'complete',
          attemptNumber,
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
              'A conflict occurred: another administrator or process may have already completed or updated this fulfillment.'
          );
          if (onReconcile) {
            void onReconcile();
          }
          return;
        }

        setError(err.message || 'Failed to complete manual fulfillment.');
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while confirming fulfillment completion.'
      );
    }
  };

  const isFormValid =
    confirmDelivered &&
    deliveryReference.trim().length >= 5 &&
    !clientError;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="max-w-lg p-0 gap-0 border-border bg-card shadow-2xl overflow-hidden"
        data-testid="manual-fulfillment-complete-dialog"
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/30">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  Complete Manual Delivery
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  Order {orderNumber || '—'} · Item #{orderItemId || '—'} · Attempt #{attemptNumber} ({attemptKey})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Snapshot Summary */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
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
                  <span className="text-muted-foreground block text-[11px]">Quantity Fulfilled:</span>
                  <span className="font-mono font-semibold">{quantityRequested} item(s)</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Active Attempt:</span>
                  <span className="font-mono font-semibold">Attempt #{attemptNumber}</span>
                </div>
              </div>
            </div>

            {/* Strict Credential / Data Privacy Warning */}
            <div
              className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs space-y-1.5"
              data-testid="complete-dialog-privacy-warning"
            >
              <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Operational Evidence Only · Strict Security Policy</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                <strong>NEVER</strong> enter customer passwords, OTPs, license keys, API tokens, sensitive URLs,
                or customer login credentials. Delivery completion is an administrator attestation of external dispatch,
                not a secret storage vault.
              </p>
            </div>

            {/* Delivery Channel Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="complete-delivery-channel"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Delivery Channel *</span>
                <span className="text-[11px] text-muted-foreground font-normal">Approved external channels</span>
              </label>
              <select
                id="complete-delivery-channel"
                value={deliveryChannel}
                onChange={(e) => setDeliveryChannel(e.target.value as ApprovedDeliveryChannel)}
                disabled={isSubmitting || isAmbiguousOutcome}
                className="w-full h-9 px-3 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                data-testid="delivery-channel-select"
              >
                {APPROVED_DELIVERY_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Reference Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="complete-delivery-reference"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Delivery Reference / Support Ticket ID *</span>
                <span className="text-[11px] text-muted-foreground font-normal">5–100 characters</span>
              </label>
              <input
                id="complete-delivery-reference"
                type="text"
                value={deliveryReference}
                onChange={(e) => handleReferenceChange(e.target.value)}
                disabled={isSubmitting || isAmbiguousOutcome}
                placeholder="e.g. TICKET-12345 or DISPATCH-2026-10"
                className="w-full h-9 px-3 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono disabled:opacity-50"
                data-testid="delivery-reference-input"
              />
              <p className="text-[10px] text-muted-foreground">
                Must start with one of: <code className="font-semibold text-foreground">{APPROVED_REFERENCE_PREFIXES.join(', ')}</code>.
                No spaces or HTML tags allowed.
              </p>
            </div>

            {/* Operational Notes Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="complete-delivery-notes"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Operational Note (Optional)</span>
                <span className="text-[11px] text-muted-foreground font-normal">Controlled predefined options</span>
              </label>
              <select
                id="complete-delivery-notes"
                value={selectedNote}
                onChange={(e) => setSelectedNote(e.target.value)}
                disabled={isSubmitting || isAmbiguousOutcome}
                className="w-full h-9 px-3 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                data-testid="delivery-notes-select"
              >
                <option value="">-- None (No operational note) --</option>
                {APPROVED_OPERATIONAL_NOTES.map((note) => (
                  <option key={note} value={note}>
                    {note}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Free-text entry is strictly prohibited to prevent accidental credential leakage.
              </p>
            </div>

            {/* Delivery Confirmation Checkbox */}
            <div className="p-3 rounded-lg border border-border/80 bg-muted/30 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={confirmDelivered}
                  onChange={(e) => {
                    setConfirmDelivered(e.target.checked);
                    if (e.target.checked && clientError?.includes('confirm')) {
                      setClientError(null);
                    }
                  }}
                  disabled={isSubmitting || isAmbiguousOutcome}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                  data-testid="confirm-delivered-checkbox"
                />
                <span className="leading-snug">
                  I explicitly confirm that the purchased product was actually delivered to the customer
                  via the authorized channel selected above. *
                </span>
              </label>
            </div>

            {/* Client Validation Error */}
            {clientError && (
              <div
                className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2"
                data-testid="complete-dialog-client-error"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{clientError}</span>
              </div>
            )}

            {/* Ambiguous Network Failure Alert */}
            {isAmbiguousOutcome && (
              <div
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2"
                data-testid="complete-dialog-ambiguous-alert"
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

            {/* Server Error / Conflict Banner */}
            {!isAmbiguousOutcome && error && (
              <div
                className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 text-xs space-y-1"
                data-testid="complete-dialog-error-banner"
                role="alert"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{isConflict ? 'State Conflict' : 'Completion Failed'}</span>
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
              type="submit"
              size="sm"
              disabled={!isFormValid || isSubmitting || isAmbiguousOutcome}
              className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
              data-testid="confirm-complete-fulfillment-btn"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Confirming Completion...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Delivery & Complete</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}