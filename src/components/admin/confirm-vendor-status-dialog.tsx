import { useState } from 'react';
import { AlertTriangle, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { AdminVendorDto } from '@/lib/vendors-api';

export interface ConfirmVendorStatusDialogProps {
  vendor: AdminVendorDto | null;
  targetActive: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (vendor: AdminVendorDto, nextActive: boolean) => Promise<void>;
}

export function ConfirmVendorStatusDialog({
  vendor,
  targetActive,
  isOpen,
  onClose,
  onConfirm,
}: ConfirmVendorStatusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!vendor) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(vendor, targetActive);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update vendor status. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDeactivating = !targetActive;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`dialog-symbol ${
                isDeactivating
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isDeactivating ? <AlertTriangle className="w-5 h-5" /> : <Power className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle>
                {isDeactivating ? 'Deactivate Vendor' : 'Activate Vendor'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {vendor.internalName} (#{vendor.id})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-sm text-foreground/85 space-y-3">
          {isDeactivating ? (
            <>
              <p>
                Are you sure you want to deactivate supplier{' '}
                <strong className="text-foreground">{vendor.internalName}</strong>?
              </p>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Supplier will be excluded from fulfillment routing
                </p>
                <p className="opacity-90">
                  Deactivating this supplier immediately stops automated or manual order fulfilment
                  routing through this vendor.
                </p>
                {vendor.productMappingCount > 0 && (
                  <p className="opacity-90 pt-1">
                    Existing <strong className="font-semibold">{vendor.productMappingCount}</strong> product
                    mapping(s) remain intact and will not be deleted.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <p>
                Activating supplier <strong className="text-foreground">{vendor.internalName}</strong> will
                restore its operational status for fulfillment routing.
              </p>
              {vendor.productMappingCount > 0 ? (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <p className="font-semibold">
                    {vendor.productMappingCount} linked product mapping(s) ready
                  </p>
                  <p className="opacity-90">
                    All previously configured product mappings for this vendor will resume being available
                    for fulfillment.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This vendor currently has 0 product mappings. You can configure product mappings in the
                  Product Mappings section.
                </p>
              )}
            </>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/25 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isDeactivating ? 'destructive' : 'brand'}
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="confirm-vendor-status-button"
          >
            {isSubmitting ? (
              <>
                <span className="button-loader" aria-hidden="true" />
                <span>Updating status...</span>
              </>
            ) : isDeactivating ? (
              'Deactivate Vendor'
            ) : (
              'Activate Vendor'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
