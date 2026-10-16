import { useState, useEffect } from 'react';
import { PackagePlus, Pencil, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  validateProductForm,
  type AdminProductDto,
  type CreateProductRequest,
  type UpdateProductRequest,
  type ProductValidationErrors,
} from '@/lib/products-api';
import type { AdminCategoryDto } from '@/lib/categories-api';
import { ApiClientError } from '@/lib/api-client';

export interface ProductFormDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  product?: AdminProductDto | null;
  categories: AdminCategoryDto[];
  onClose: () => void;
  onSubmitCreate?: (payload: CreateProductRequest) => Promise<AdminProductDto>;
  onSubmitUpdate?: (id: number, payload: UpdateProductRequest) => Promise<AdminProductDto>;
  onSuccess?: (product: AdminProductDto, mode: 'create' | 'edit') => void;
}

export function ProductFormDialog({
  isOpen,
  mode,
  product,
  categories,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onSuccess,
}: ProductFormDialogProps) {
  const [internalSku, setInternalSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [sellingCurrency, setSellingCurrency] = useState('PKR');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<ProductValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever the dialog opens or the target product changes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && product) {
      setInternalSku(product.internalSku);
      setName(product.name);
      setCategoryId(product.categoryId);
      setSellingPrice(product.sellingPrice.toString());
      setSellingCurrency(product.sellingCurrency || 'PKR');
      setDescription(product.description ?? '');
      setIsActive(product.isActive);
    } else {
      setInternalSku('');
      setName('');
      // Default to first active category if available, otherwise first category
      const defaultCat = categories.find((c) => c.isActive) || categories[0];
      setCategoryId(defaultCat ? defaultCat.id : '');
      setSellingPrice('');
      setSellingCurrency('PKR');
      setDescription('');
      setIsActive(true);
    }

    setFieldErrors({});
    setServerError(null);
    setIsSubmitting(false);
  }, [isOpen, mode, product, categories]);

  const handleSkuChange = (val: string) => {
    // Auto-uppercase SKU and strip spaces
    const upper = val.toUpperCase().replace(/\s+/g, '_');
    setInternalSku(upper);
    if (fieldErrors.internalSku) {
      setFieldErrors((prev) => ({ ...prev, internalSku: undefined }));
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleCategoryChange = (val: string) => {
    const num = parseInt(val, 10);
    setCategoryId(isNaN(num) ? '' : num);
    if (fieldErrors.categoryId) {
      setFieldErrors((prev) => ({ ...prev, categoryId: undefined }));
    }
  };

  const handlePriceChange = (val: string) => {
    setSellingPrice(val);
    if (fieldErrors.sellingPrice) {
      setFieldErrors((prev) => ({ ...prev, sellingPrice: undefined }));
    }
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (fieldErrors.description) {
      setFieldErrors((prev) => ({ ...prev, description: undefined }));
    }
  };

  const isEdit = mode === 'edit';
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevent duplicate submissions

    setServerError(null);

    const validation = validateProductForm(
      {
        internalSku,
        name,
        categoryId,
        sellingPrice,
        sellingCurrency,
        description: description.trim() ? description : null,
      },
      isEdit,
    );

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    const numericPrice = parseFloat(sellingPrice);

    try {
      if (mode === 'create') {
        if (!onSubmitCreate) {
          throw new Error('Create handler not provided.');
        }

        const payload: CreateProductRequest = {
          internalSku: internalSku.trim(),
          name: name.trim(),
          categoryId: Number(categoryId),
          sellingPrice: numericPrice,
          sellingCurrency: sellingCurrency.trim().toUpperCase() || 'PKR',
          description: description.trim() ? description.trim() : null,
          isActive,
        };

        const created = await onSubmitCreate(payload);
        onSuccess?.(created, 'create');
        onClose();
      } else if (mode === 'edit' && product) {
        if (!onSubmitUpdate) {
          throw new Error('Update handler not provided.');
        }

        const payload: UpdateProductRequest = {
          name: name.trim(),
          categoryId: Number(categoryId),
          sellingPrice: numericPrice,
          sellingCurrency: sellingCurrency.trim().toUpperCase() || 'PKR',
          description: description.trim() ? description.trim() : null,
          isActive,
        };

        const updated = await onSubmitUpdate(product.id, payload);
        onSuccess?.(updated, 'edit');
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setFieldErrors((prev) => ({
            ...prev,
            internalSku:
              err.message || `A product with internal SKU '${internalSku}' already exists.`,
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="dialog-symbol">
                {isEdit ? <Pencil className="w-5 h-5" /> : <PackagePlus className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle>{isEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                <DialogDescription className="text-xs">
                  {isEdit
                    ? `Update catalog details for product #${product?.id}. Stable identifiers are preserved.`
                    : 'Create a new catalog item with pricing and category assignment.'}
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
                data-testid="product-form-server-error"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{serverError}</div>
              </div>
            )}

            {/* Internal SKU (Creation: editable; Edit: immutable) */}
            <div className="space-y-1.5">
              <div className="field-label-row">
                <Label htmlFor="product-sku" className="text-xs font-semibold">
                  Internal SKU / Code <span className="text-destructive">*</span>
                </Label>
                <span className="field-char-count">{internalSku.length}/100</span>
              </div>
              <Input
                id="product-sku"
                data-testid="product-sku-input"
                placeholder="e.g. CHATGPT_PLUS_1M"
                value={internalSku}
                maxLength={100}
                disabled={isEdit || isSubmitting}
                onChange={(e) => handleSkuChange(e.target.value)}
                aria-invalid={!!fieldErrors.internalSku}
                aria-describedby={
                  fieldErrors.internalSku ? 'product-sku-error' : 'product-sku-help'
                }
                className={`font-mono text-xs uppercase ${
                  isEdit ? 'bg-muted/50 cursor-not-allowed opacity-80' : ''
                } ${fieldErrors.internalSku ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {fieldErrors.internalSku ? (
                <p id="product-sku-error" data-testid="product-sku-error" className="field-error-text" role="alert">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.internalSku}
                </p>
              ) : isEdit ? (
                <p id="product-sku-help" className="field-help-text">
                  Internal SKU is a permanent business identifier and cannot be modified after creation.
                </p>
              ) : (
                <p id="product-sku-help" className="field-help-text">
                  Uppercase letters, numbers, and underscores only (e.g. CHATGPT_PLUS_1M).
                </p>
              )}
            </div>

            {/* Product Name */}
            <div className="space-y-1.5">
              <div className="field-label-row">
                <Label htmlFor="product-name" className="text-xs font-semibold">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <span className="field-char-count">{name.length}/300</span>
              </div>
              <Input
                id="product-name"
                data-testid="product-name-input"
                placeholder="e.g. ChatGPT Plus 1 Month Voucher"
                value={name}
                maxLength={300}
                disabled={isSubmitting}
                onChange={(e) => handleNameChange(e.target.value)}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? 'product-name-error' : undefined}
                className={fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.name && (
                <p id="product-name-error" data-testid="product-name-error" className="field-error-text" role="alert">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Category Dropdown & Pricing Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="product-category" className="text-xs font-semibold">
                  Category <span className="text-destructive">*</span>
                </Label>
                <select
                  id="product-category"
                  data-testid="product-category-select"
                  value={categoryId}
                  disabled={isSubmitting}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  aria-invalid={!!fieldErrors.categoryId}
                  className={`w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                    fieldErrors.categoryId ? 'border-destructive' : ''
                  }`}
                >
                  <option value="" disabled>
                    Select a category...
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {!cat.isActive ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId && (
                  <p id="product-category-error" data-testid="product-category-error" className="field-error-text" role="alert">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {fieldErrors.categoryId}
                  </p>
                )}
                {selectedCategory && !selectedCategory.isActive && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    Selected category is inactive.
                  </p>
                )}
              </div>

              {/* Selling Price */}
              <div className="space-y-1.5">
                <Label htmlFor="product-price" className="text-xs font-semibold">
                  Customer Selling Price ({sellingCurrency}) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                    ₨
                  </span>
                  <Input
                    id="product-price"
                    data-testid="product-price-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="5500.00"
                    value={sellingPrice}
                    disabled={isSubmitting}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    aria-invalid={!!fieldErrors.sellingPrice}
                    aria-describedby={fieldErrors.sellingPrice ? 'product-price-error' : undefined}
                    className={`pl-8 ${
                      fieldErrors.sellingPrice
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                  />
                </div>
                {fieldErrors.sellingPrice && (
                  <p id="product-price-error" data-testid="product-price-error" className="field-error-text" role="alert">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {fieldErrors.sellingPrice}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="field-label-row">
                <Label htmlFor="product-description" className="text-xs font-semibold">
                  Description <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <span className="field-char-count">{description.length}/5000</span>
              </div>
              <Textarea
                id="product-description"
                data-testid="product-description-input"
                placeholder="Product specifications, activation instructions, and customer details..."
                value={description}
                maxLength={5000}
                rows={3}
                disabled={isSubmitting}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                aria-invalid={!!fieldErrors.description}
                className={
                  fieldErrors.description ? 'border-destructive focus-visible:ring-destructive' : ''
                }
              />
              {fieldErrors.description && (
                <p id="product-desc-error" className="field-error-text" role="alert">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.description}
                </p>
              )}
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
              <div className="space-y-0.5 pr-4">
                <Label
                  htmlFor="product-active-switch"
                  className="text-xs font-semibold cursor-pointer"
                >
                  Active Status
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {isActive
                    ? 'Product is enabled for customer purchases when category is active.'
                    : 'Product is disabled. Hidden from public storefront.'}
                </p>
              </div>
              <Switch
                id="product-active-switch"
                data-testid="product-active-switch"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isSubmitting}
              />
            </div>

            {/* Read-only Server metadata in Edit Mode */}
            {isEdit && product && (
              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground grid grid-cols-2 gap-2 border border-border/50">
                <div>
                  <span className="font-semibold text-foreground/75">Product ID:</span> #{product.id}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Category Slug:</span>{' '}
                  /{product.categorySlug}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Created:</span>{' '}
                  {new Date(product.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Last Updated:</span>{' '}
                  {new Date(product.updatedAt).toLocaleDateString()}
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
              data-testid="product-submit-button"
            >
              {isSubmitting ? (
                <>
                  <span className="button-loader" aria-hidden="true" />
                  <span>{isEdit ? 'Saving Changes...' : 'Creating Product...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'Save Changes' : 'Create Product'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
