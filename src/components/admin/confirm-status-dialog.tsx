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
import type { AdminCategoryDto } from '@/lib/categories-api';

export interface ConfirmStatusDialogProps {
  category: AdminCategoryDto | null;
  targetActive: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (category: AdminCategoryDto, nextActive: boolean) => Promise<void>;
}

export function ConfirmStatusDialog({
  category,
  targetActive,
  isOpen,
  onClose,
  onConfirm,
}: ConfirmStatusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!category) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(category, targetActive);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update category status. Please try again.';
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
                {isDeactivating ? 'Deactivate Category' : 'Activate Category'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {category.name} ({category.slug})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-sm text-foreground/85 space-y-3">
          {isDeactivating ? (
            <>
              <p>
                Are you sure you want to deactivate{' '}
                <strong className="text-foreground">{category.name}</strong>?
              </p>
              {category.productCount > 0 ? (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Contains {category.productCount} linked product{category.productCount === 1 ? '' : 's'}
                  </p>
                  <p className="opacity-90">
                    Disabling this category automatically hides all its products from the public catalog.
                    Customers will not be able to browse or order these items.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This category currently has no products. It will be hidden from customer navigation.
                </p>
              )}
            </>
          ) : (
            <p>
              Activating <strong className="text-foreground">{category.name}</strong> will make it
              available in the product catalog and restore visibility for all active products within it.
            </p>
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
            data-testid="confirm-status-button"
          >
            {isSubmitting ? (
              <>
                <span className="button-loader" aria-hidden="true" />
                <span>Updating status...</span>
              </>
            ) : isDeactivating ? (
              'Deactivate Category'
            ) : (
              'Activate Category'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
