import { useState, useEffect } from 'react';
import { Store, Pencil, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  validateVendorForm,
  type AdminVendorDto,
  type CreateVendorRequest,
  type UpdateVendorRequest,
  type VendorValidationErrors,
} from '@/lib/vendors-api';
import { ApiClientError } from '@/lib/api-client';

export interface VendorFormDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  vendor?: AdminVendorDto | null;
  onClose: () => void;
  onSubmitCreate?: (payload: CreateVendorRequest) => Promise<AdminVendorDto>;
  onSubmitUpdate?: (id: number, payload: UpdateVendorRequest) => Promise<AdminVendorDto>;
  onSuccess?: (vendor: AdminVendorDto, mode: 'create' | 'edit') => void;
}

export function VendorFormDialog({
  isOpen,
  mode,
  vendor,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onSuccess,
}: VendorFormDialogProps) {
  const [internalName, setInternalName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<VendorValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever the dialog opens or target vendor changes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && vendor) {
      setInternalName(vendor.internalName);
      setIsActive(vendor.isActive);
    } else {
      setInternalName('');
      setIsActive(true);
    }

    setFieldErrors({});
    setServerError(null);
    setIsSubmitting(false);
  }, [isOpen, mode, vendor]);

  const handleNameChange = (val: string) => {
    setInternalName(val);
    if (fieldErrors.internalName) {
      setFieldErrors((prev) => ({ ...prev, internalName: undefined }));
    }
  };

  const isEdit = mode === 'edit';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevent duplicate submissions

    setServerError(null);

    const validation = validateVendorForm({ internalName });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        if (!onSubmitCreate) {
          throw new Error('Create handler not provided.');
        }

        const payload: CreateVendorRequest = {
          internalName: internalName.trim(),
          isActive,
        };

        const created = await onSubmitCreate(payload);
        onSuccess?.(created, 'create');
        onClose();
      } else if (mode === 'edit' && vendor) {
        if (!onSubmitUpdate) {
          throw new Error('Update handler not provided.');
        }

        const payload: UpdateVendorRequest = {
          internalName: internalName.trim(),
          isActive,
        };

        const updated = await onSubmitUpdate(vendor.id, payload);
        onSuccess?.(updated, 'edit');
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setFieldErrors((prev) => ({
            ...prev,
            internalName:
              err.message || `A vendor with name '${internalName.trim()}' already exists.`,
          }));
          setServerError(err.message);
        } else {
          setServerError(err.message || 'Operation failed. Please verify input and try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="dialog-symbol">
                {isEdit ? <Pencil className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle>{isEdit ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                <DialogDescription className="text-xs">
                  {isEdit
                    ? `Update internal supplier record #${vendor?.id}.`
                    : 'Register an internal supplier vendor for order fulfillment routing.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Global Server Error Banner */}
            {serverError && (
              <div
                className="rounded-lg bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive flex items-start gap-2.5"
                role="alert"
                data-testid="vendor-form-server-error"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{serverError}</div>
              </div>
            )}

            {/* Vendor Internal Name */}
            <div className="space-y-1.5">
              <div className="field-label-row">
                <Label htmlFor="vendor-internal-name" className="text-xs font-semibold">
                  Supplier Internal Name <span className="text-destructive">*</span>
                </Label>
                <span className="field-char-count">{internalName.length}/200</span>
              </div>
              <Input
                id="vendor-internal-name"
                data-testid="vendor-name-input"
                placeholder="e.g. Supplier Alpha (Internal)"
                value={internalName}
                maxLength={200}
                disabled={isSubmitting}
                onChange={(e) => handleNameChange(e.target.value)}
                aria-invalid={!!fieldErrors.internalName}
                aria-describedby={
                  fieldErrors.internalName ? 'vendor-name-error' : 'vendor-name-help'
                }
                className={
                  fieldErrors.internalName ? 'border-destructive focus-visible:ring-destructive' : ''
                }
              />
              {fieldErrors.internalName ? (
                <p
                  id="vendor-name-error"
                  data-testid="vendor-name-error"
                  className="field-error-text"
                  role="alert"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.internalName}
                </p>
              ) : (
                <p id="vendor-name-help" className="field-help-text">
                  Our internal reference name for this supplier. Used strictly for administrative routing.
                </p>
              )}
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
              <div className="space-y-0.5 pr-4">
                <Label
                  htmlFor="vendor-active-switch"
                  className="text-xs font-semibold cursor-pointer"
                >
                  Active Status
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {isActive
                    ? 'Supplier is active and available for order fulfillment routing.'
                    : 'Supplier is disabled. Skipped during fulfillment routing.'}
                </p>
              </div>
              <Switch
                id="vendor-active-switch"
                data-testid="vendor-active-switch"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isSubmitting}
              />
            </div>

            {/* Read-only Server metadata in Edit Mode */}
            {isEdit && vendor && (
              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground grid grid-cols-2 gap-2 border border-border/50">
                <div>
                  <span className="font-semibold text-foreground/75">Vendor ID:</span> #{vendor.id}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Product Mappings:</span>{' '}
                  {vendor.productMappingCount} linked
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Created:</span>{' '}
                  {new Date(vendor.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Last Updated:</span>{' '}
                  {new Date(vendor.updatedAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={isSubmitting}
              data-testid="vendor-submit-button"
            >
              {isSubmitting ? (
                <>
                  <span className="button-loader" aria-hidden="true" />
                  <span>{isEdit ? 'Saving Changes...' : 'Creating Supplier...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'Save Changes' : 'Create Supplier'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
