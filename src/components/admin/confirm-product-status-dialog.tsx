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
import type { AdminProductDto } from '@/lib/products-api';

export interface ConfirmProductStatusDialogProps {
  product: AdminProductDto | null;
  targetActive: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: AdminProductDto, nextActive: boolean) => Promise<void>;
}

export function ConfirmProductStatusDialog({
  product,
  targetActive,
  isOpen,
  onClose,
  onConfirm,
}: ConfirmProductStatusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!product) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(product, targetActive);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update product status. Please try again.';
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
                {isDeactivating ? 'Deactivate Product' : 'Activate Product'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {product.name} ({product.internalSku})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-sm text-foreground/85 space-y-3">
          {isDeactivating ? (
            <>
              <p>
                Are you sure you want to deactivate{' '}
                <strong className="text-foreground">{product.name}</strong>?
              </p>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Product will be hidden from customer store
                </p>
                <p className="opacity-90">
                  Deactivating this product immediately hides it from the public catalog. Customers
                  will not be able to browse, view details, or place orders for this item.
                </p>
              </div>
            </>
          ) : (
            <>
              <p>
                Activating <strong className="text-foreground">{product.name}</strong> will restore its
                availability in the administrative catalog.
              </p>
              {!product.categoryIsActive && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Parent Category &ldquo;{product.categoryName}&rdquo; is Inactive
                  </p>
                  <p className="opacity-90">
                    Because this product&apos;s category is currently disabled, this product will remain
                    hidden from public customer browsing until the category is activated.
                  </p>
                </div>
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
            data-testid="confirm-product-status-button"
          >
            {isSubmitting ? (
              <>
                <span className="button-loader" aria-hidden="true" />
                <span>Updating status...</span>
              </>
            ) : isDeactivating ? (
              'Deactivate Product'
            ) : (
              'Activate Product'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
