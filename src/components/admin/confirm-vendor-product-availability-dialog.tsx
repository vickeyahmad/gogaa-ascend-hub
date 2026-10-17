import { useState } from 'react';
import { AlertTriangle, Power, AlertCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatVendorCost, type AdminVendorProductDto } from '@/lib/vendor-products-api';

export interface ConfirmVendorProductAvailabilityDialogProps {
  mapping: AdminVendorProductDto | null;
  targetAvailable: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mapping: AdminVendorProductDto, nextAvailable: boolean) => Promise<void>;
}

export function ConfirmVendorProductAvailabilityDialog({
  mapping,
  targetAvailable,
  isOpen,
  onClose,
  onConfirm,
}: ConfirmVendorProductAvailabilityDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mapping) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(mapping, targetAvailable);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update mapping availability. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabling = !targetAvailable;
  const isParentInactive = !mapping.vendorIsActive || !mapping.productIsActive;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="confirm-vendor-product-availability-dialog">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`dialog-symbol ${
                isDisabling
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isDisabling ? <AlertTriangle className="w-5 h-5" /> : <Power className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle>
                {isDisabling ? 'Disable Mapping Availability' : 'Enable Mapping Availability'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Mapping #{mapping.id} · {mapping.productSku} ↔ {mapping.vendorName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-sm text-foreground/85 space-y-3">
          {/* Mapping Summary Card */}
          <div className="rounded-lg bg-card border border-border p-3 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Product:</span>
              <span className="font-semibold text-foreground">
                {mapping.productName} ({mapping.productSku})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Supplier:</span>
              <span className="font-semibold text-foreground">{mapping.vendorName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">External ID:</span>
              <span className="font-mono text-foreground">{mapping.externalProductId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Purchase Cost:</span>
              <span className="font-semibold text-foreground">
                {formatVendorCost(mapping.vendorCost, mapping.vendorCostCurrency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Routing Priority:</span>
              <span className="text-foreground">Priority {mapping.priority}</span>
            </div>
          </div>

          {isDisabling ? (
            <>
              <p>
                Are you sure you want to mark this supplier mapping as{' '}
                <strong className="text-foreground">unavailable</strong>?
              </p>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Excluded from order fulfillment routing
                </p>
                <p className="opacity-90">
                  This supplier will be skipped during manual or automated fulfillment routing for this product.
                  Historical orders, the supplier record, and the internal product record remain completely untouched.
                </p>
              </div>
            </>
          ) : (
            <>
              <p>
                Are you sure you want to mark this supplier mapping as{' '}
                <strong className="text-foreground">available</strong>?
              </p>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Power className="w-4 h-4 shrink-0" />
                  Eligible for fulfillment routing
                </p>
                <p className="opacity-90">
                  This supplier mapping will become active and considered for fulfillment orders of this product
                  according to its configured routing priority (Priority {mapping.priority}).
                </p>
              </div>
            </>
          )}

          {isParentInactive && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/25 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Parent entity is inactive</p>
                <p className="opacity-90 mt-0.5">
                  {!mapping.vendorIsActive && !mapping.productIsActive
                    ? 'Both the parent vendor and internal product are currently inactive.'
                    : !mapping.vendorIsActive
                      ? 'The parent vendor is currently inactive.'
                      : 'The internal product is currently inactive.'}{' '}
                  Even if this mapping is enabled, fulfillment will not proceed through this supplier until the parent
                  is also active.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="confirm-availability-cancel-button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDisabling ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="confirm-availability-submit-button"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Updating...
              </span>
            ) : isDisabling ? (
              'Disable Mapping'
            ) : (
              'Enable Mapping'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
