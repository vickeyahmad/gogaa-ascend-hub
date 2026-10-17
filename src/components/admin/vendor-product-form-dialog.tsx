import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Link2,
  Pencil,
  AlertCircle,
  AlertTriangle,
  Search,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
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
  validateVendorProductForm,
  type AdminVendorProductDto,
  type CreateVendorProductRequest,
  type UpdateVendorProductRequest,
  type VendorProductValidationErrors,
} from '@/lib/vendor-products-api';
import { getAdminVendors, type AdminVendorDto } from '@/lib/vendors-api';
import { getAdminProducts, formatPrice, type AdminProductDto } from '@/lib/products-api';
import { ApiClientError } from '@/lib/api-client';

export interface VendorProductFormDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  mapping?: AdminVendorProductDto | null;
  onClose: () => void;
  onSubmitCreate?: (payload: CreateVendorProductRequest) => Promise<AdminVendorProductDto>;
  onSubmitUpdate?: (id: number, payload: UpdateVendorProductRequest) => Promise<AdminVendorProductDto>;
  onSuccess?: (mapping: AdminVendorProductDto, mode: 'create' | 'edit') => void;
}

const COMMON_CURRENCIES = ['PKR', 'USD', 'USDT', 'EUR'];

export function VendorProductFormDialog({
  isOpen,
  mode,
  mapping,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onSuccess,
}: VendorProductFormDialogProps) {
  // Form fields
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [externalProductId, setExternalProductId] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  const [vendorCostCurrency, setVendorCostCurrency] = useState('PKR');
  const [customCurrency, setCustomCurrency] = useState('');
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);
  const [priority, setPriority] = useState('10');
  const [isAvailable, setIsAvailable] = useState(true);

  // Validation & Server state
  const [fieldErrors, setFieldErrors] = useState<VendorProductValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vendor picker state
  const [vendorsList, setVendorsList] = useState<AdminVendorDto[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [vendorTotalCount, setVendorTotalCount] = useState(0);
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorTotalPages, setVendorTotalPages] = useState(1);

  // Product picker state
  const [productsList, setProductsList] = useState<AdminProductDto[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);

  // Monotonic counters to discard out-of-order search responses
  const vendorFetchId = useRef(0);
  const productFetchId = useRef(0);

  /**
   * Loads vendors with server-side search and pagination.
   */
  const loadVendors = useCallback(async (searchQuery: string, pageNum = 1) => {
    const fetchId = ++vendorFetchId.current;
    setIsLoadingVendors(true);
    try {
      const result = await getAdminVendors({
        search: searchQuery.trim() || undefined,
        page: pageNum,
        pageSize: 15,
      });
      if (fetchId === vendorFetchId.current) {
        setVendorsList(result.items);
        setVendorTotalCount(result.totalCount);
        setVendorTotalPages(result.totalPages);
        setVendorPage(result.page);
      }
    } catch {
      // Silent error fallback for dropdown
    } finally {
      if (fetchId === vendorFetchId.current) {
        setIsLoadingVendors(false);
      }
    }
  }, []);

  /**
   * Loads products with server-side search and pagination.
   */
  const loadProducts = useCallback(async (searchQuery: string, pageNum = 1) => {
    const fetchId = ++productFetchId.current;
    setIsLoadingProducts(true);
    try {
      const result = await getAdminProducts({
        search: searchQuery.trim() || undefined,
        page: pageNum,
        pageSize: 15,
      });
      if (fetchId === productFetchId.current) {
        setProductsList(result.items);
        setProductTotalCount(result.totalCount);
        setProductTotalPages(result.totalPages);
        setProductPage(result.page);
      }
    } catch {
      // Silent error fallback for dropdown
    } finally {
      if (fetchId === productFetchId.current) {
        setIsLoadingProducts(false);
      }
    }
  }, []);

  // Sync state on open / change
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && mapping) {
      setSelectedVendorId(mapping.vendorId);
      setSelectedProductId(mapping.productId);
      setExternalProductId(mapping.externalProductId);
      setVendorCost(mapping.vendorCost.toString());
      const cur = mapping.vendorCostCurrency.toUpperCase();
      if (COMMON_CURRENCIES.includes(cur)) {
        setVendorCostCurrency(cur);
        setIsCustomCurrency(false);
        setCustomCurrency('');
      } else {
        setVendorCostCurrency('CUSTOM');
        setIsCustomCurrency(true);
        setCustomCurrency(cur);
      }
      setPriority(mapping.priority.toString());
      setIsAvailable(mapping.isAvailable);
    } else {
      setSelectedVendorId('');
      setSelectedProductId('');
      setExternalProductId('');
      setVendorCost('');
      setVendorCostCurrency('PKR');
      setIsCustomCurrency(false);
      setCustomCurrency('');
      setPriority('10');
      setIsAvailable(true);

      // Load initial vendors and products for create mode
      void loadVendors('', 1);
      void loadProducts('', 1);
    }

    setFieldErrors({});
    setServerError(null);
    setIsSubmitting(false);
  }, [isOpen, mode, mapping, loadVendors, loadProducts]);

  // Selected vendor & product entities for context
  const selectedVendor = vendorsList.find((v) => v.id === selectedVendorId);
  const selectedProduct = productsList.find((p) => p.id === selectedProductId);

  const effectiveCurrency = isCustomCurrency ? customCurrency.trim().toUpperCase() : vendorCostCurrency;

  const handleCurrencyChange = (val: string) => {
    if (val === 'CUSTOM') {
      setIsCustomCurrency(true);
      setVendorCostCurrency('CUSTOM');
    } else {
      setIsCustomCurrency(false);
      setVendorCostCurrency(val);
      setCustomCurrency('');
    }
    if (fieldErrors.vendorCostCurrency) {
      setFieldErrors((prev) => ({ ...prev, vendorCostCurrency: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setServerError(null);

    const errors = validateVendorProductForm(
      {
        vendorId: mode === 'create' ? (selectedVendorId as number) : mapping?.vendorId,
        productId: mode === 'create' ? (selectedProductId as number) : mapping?.productId,
        externalProductId,
        vendorCost,
        vendorCostCurrency: effectiveCurrency,
        priority,
      },
      mode === 'create',
    );

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const parsedCost = Number(vendorCost.trim());
      const parsedPriority = Number(priority.trim());

      if (mode === 'create') {
        if (!onSubmitCreate) {
          throw new Error('Create handler not configured.');
        }

        const newMapping = await onSubmitCreate({
          vendorId: selectedVendorId as number,
          productId: selectedProductId as number,
          externalProductId: externalProductId.trim(),
          vendorCost: parsedCost,
          vendorCostCurrency: effectiveCurrency,
          isAvailable,
          priority: parsedPriority,
        });

        onSuccess?.(newMapping, 'create');
        onClose();
      } else {
        if (!onSubmitUpdate || !mapping) {
          throw new Error('Update handler not configured.');
        }

        const updatedMapping = await onSubmitUpdate(mapping.id, {
          externalProductId: externalProductId.trim(),
          vendorCost: parsedCost,
          vendorCostCurrency: effectiveCurrency,
          isAvailable,
          priority: parsedPriority,
        });

        onSuccess?.(updatedMapping, 'edit');
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setServerError(
            err.message || 'A mapping for this Vendor and Product already exists.',
          );
        } else {
          setServerError(err.message || 'Operation failed. Please review your input.');
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="vendor-product-form-dialog">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="dialog-symbol bg-primary/10 text-primary">
              {mode === 'create' ? <Link2 className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle>
                {mode === 'create' ? 'Create Product Mapping' : 'Edit Product Mapping'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {mode === 'create'
                  ? 'Link an internal product to an external supplier with custom cost, currency, and routing priority.'
                  : `Mapping #${mapping?.id} · Supplier and internal product links are immutable.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {serverError && (
          <div
            className="rounded-lg bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive flex items-start gap-2"
            role="alert"
            data-testid="vendor-product-form-server-error"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{serverError}</p>
              {serverError.toLowerCase().includes('already exists') && (
                <p className="text-[11px] opacity-90">
                  Each vendor can only be mapped to a specific product once. Please edit the existing mapping or choose another supplier/product.
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2" data-testid="vendor-product-form">
          {/* Vendor Selection (Create mode) or Readonly Display (Edit mode) */}
          {mode === 'create' ? (
            <div className="space-y-1.5">
              <Label htmlFor="vendor-select" className="text-xs font-semibold">
                Supplier Vendor <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-1.5">
                {/* Search Box for Vendors */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers by name..."
                    value={vendorSearch}
                    onChange={(e) => {
                      setVendorSearch(e.target.value);
                      void loadVendors(e.target.value, 1);
                    }}
                    className="pl-8 h-8 text-xs"
                    data-testid="vendor-search-input"
                  />
                </div>
                {/* Select Vendor Dropdown */}
                <select
                  id="vendor-select"
                  value={selectedVendorId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVendorId(val === '' ? '' : parseInt(val, 10));
                    if (fieldErrors.vendorId) {
                      setFieldErrors((prev) => ({ ...prev, vendorId: undefined }));
                    }
                  }}
                  className={`w-full h-9 rounded-md border bg-card px-3 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    fieldErrors.vendorId ? 'border-destructive' : 'border-input'
                  }`}
                  data-testid="vendor-select"
                  aria-invalid={!!fieldErrors.vendorId}
                >
                  <option value="">-- Select a Supplier ({vendorTotalCount} available) --</option>
                  {vendorsList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.internalName} (#{v.id}) {!v.isActive ? '· [Inactive]' : '· [Active]'}
                    </option>
                  ))}
                </select>
                {/* Vendor Pagination if multiple pages */}
                {vendorTotalPages > 1 && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>
                      Page {vendorPage} of {vendorTotalPages} ({vendorTotalCount} suppliers)
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        disabled={vendorPage <= 1 || isLoadingVendors}
                        onClick={() => void loadVendors(vendorSearch, vendorPage - 1)}
                      >
                        <ChevronLeft className="w-3 h-3 mr-0.5" /> Prev
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        disabled={vendorPage >= vendorTotalPages || isLoadingVendors}
                        onClick={() => void loadVendors(vendorSearch, vendorPage + 1)}
                      >
                        Next <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {fieldErrors.vendorId && (
                <p className="text-[11px] text-destructive flex items-center gap-1" data-testid="vendor-id-error">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.vendorId}
                </p>
              )}
              {selectedVendor && !selectedVendor.isActive && (
                <div className="rounded bg-amber-500/10 border border-amber-500/25 p-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Selected supplier is inactive. Orders will not route until vendor is active.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-card border border-border p-3 text-xs space-y-1">
              <span className="text-muted-foreground font-semibold">Supplier Vendor (Immutable):</span>
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-semibold text-foreground text-sm">{mapping?.vendorName}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    mapping?.vendorIsActive
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {mapping?.vendorIsActive ? 'Vendor Active' : 'Vendor Inactive'}
                </span>
              </div>
            </div>
          )}

          {/* Product Selection (Create mode) or Readonly Display (Edit mode) */}
          {mode === 'create' ? (
            <div className="space-y-1.5">
              <Label htmlFor="product-select" className="text-xs font-semibold">
                Internal Product <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-1.5">
                {/* Search Box for Products */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search products by SKU or name..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      void loadProducts(e.target.value, 1);
                    }}
                    className="pl-8 h-8 text-xs"
                    data-testid="product-search-input"
                  />
                </div>
                {/* Select Product Dropdown */}
                <select
                  id="product-select"
                  value={selectedProductId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedProductId(val === '' ? '' : parseInt(val, 10));
                    if (fieldErrors.productId) {
                      setFieldErrors((prev) => ({ ...prev, productId: undefined }));
                    }
                  }}
                  className={`w-full h-9 rounded-md border bg-card px-3 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    fieldErrors.productId ? 'border-destructive' : 'border-input'
                  }`}
                  data-testid="product-select"
                  aria-invalid={!!fieldErrors.productId}
                >
                  <option value="">-- Select an Internal Product ({productTotalCount} available) --</option>
                  {productsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.internalSku}] · {formatPrice(p.sellingPrice, p.sellingCurrency)}{' '}
                      {!p.isActive ? '· [Inactive]' : ''}
                    </option>
                  ))}
                </select>
                {/* Product Pagination if multiple pages */}
                {productTotalPages > 1 && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>
                      Page {productPage} of {productTotalPages} ({productTotalCount} products)
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        disabled={productPage <= 1 || isLoadingProducts}
                        onClick={() => void loadProducts(productSearch, productPage - 1)}
                      >
                        <ChevronLeft className="w-3 h-3 mr-0.5" /> Prev
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        disabled={productPage >= productTotalPages || isLoadingProducts}
                        onClick={() => void loadProducts(productSearch, productPage + 1)}
                      >
                        Next <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {fieldErrors.productId && (
                <p className="text-[11px] text-destructive flex items-center gap-1" data-testid="product-id-error">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.productId}
                </p>
              )}
              {selectedProduct && !selectedProduct.isActive && (
                <div className="rounded bg-amber-500/10 border border-amber-500/25 p-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Selected internal product is inactive. Orders cannot be placed by customers.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-card border border-border p-3 text-xs space-y-1">
              <span className="text-muted-foreground font-semibold">Internal Product (Immutable):</span>
              <div className="flex items-center justify-between pt-0.5">
                <div>
                  <span className="font-semibold text-foreground text-sm">{mapping?.productName}</span>
                  <span className="ml-2 font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {mapping?.productSku}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    mapping?.productIsActive
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {mapping?.productIsActive ? 'Product Active' : 'Product Inactive'}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Customer Selling Price: {mapping?.productSellingPrice} {mapping?.productSellingCurrency}
              </div>
            </div>
          )}

          {/* External Product ID */}
          <div className="space-y-1.5">
            <Label htmlFor="external-product-id" className="text-xs font-semibold">
              External Supplier Product ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="external-product-id"
              placeholder="e.g. 221, GPT45, 9811"
              value={externalProductId}
              onChange={(e) => {
                setExternalProductId(e.target.value);
                if (fieldErrors.externalProductId) {
                  setFieldErrors((prev) => ({ ...prev, externalProductId: undefined }));
                }
              }}
              className={`font-mono text-xs ${fieldErrors.externalProductId ? 'border-destructive' : ''}`}
              data-testid="external-product-id-input"
              maxLength={200}
              aria-invalid={!!fieldErrors.externalProductId}
            />
            <p className="text-[11px] text-muted-foreground">
              The external supplier's exact catalog identifier. Stored as an opaque string; leading zeros and characters are preserved.
            </p>
            {fieldErrors.externalProductId && (
              <p className="text-[11px] text-destructive flex items-center gap-1" data-testid="external-product-id-error">
                <AlertCircle className="w-3 h-3" /> {fieldErrors.externalProductId}
              </p>
            )}
          </div>

          {/* Purchase Cost & Currency (Multi-Currency) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-cost" className="text-xs font-semibold">
                Vendor Purchase Cost <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vendor-cost"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 1450.00 or 12.50"
                value={vendorCost}
                onChange={(e) => {
                  setVendorCost(e.target.value);
                  if (fieldErrors.vendorCost) {
                    setFieldErrors((prev) => ({ ...prev, vendorCost: undefined }));
                  }
                }}
                className={`text-xs ${fieldErrors.vendorCost ? 'border-destructive' : ''}`}
                data-testid="vendor-cost-input"
                aria-invalid={!!fieldErrors.vendorCost}
              />
              <p className="text-[10px] text-muted-foreground">
                Wholesale cost paid to supplier (precision up to 4 decimal places).
              </p>
              {fieldErrors.vendorCost && (
                <p className="text-[11px] text-destructive flex items-center gap-1" data-testid="vendor-cost-error">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.vendorCost}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor-currency" className="text-xs font-semibold">
                Cost Currency <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-1.5">
                <select
                  id="vendor-currency"
                  value={isCustomCurrency ? 'CUSTOM' : vendorCostCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className={`w-full h-9 rounded-md border bg-card px-3 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    fieldErrors.vendorCostCurrency ? 'border-destructive' : 'border-input'
                  }`}
                  data-testid="vendor-currency-select"
                >
                  {COMMON_CURRENCIES.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                  <option value="CUSTOM">Other currency code...</option>
                </select>
                {isCustomCurrency && (
                  <Input
                    placeholder="Enter ISO code (e.g. GBP, AED)"
                    value={customCurrency}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase();
                      setCustomCurrency(upper);
                      if (fieldErrors.vendorCostCurrency) {
                        setFieldErrors((prev) => ({ ...prev, vendorCostCurrency: undefined }));
                      }
                    }}
                    className="text-xs uppercase h-8"
                    maxLength={10}
                    data-testid="custom-currency-input"
                  />
                )}
              </div>
              {fieldErrors.vendorCostCurrency && (
                <p className="text-[11px] text-destructive flex items-center gap-1" data-testid="vendor-currency-error">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.vendorCostCurrency}
                </p>
              )}
            </div>
          </div>

          {/* Routing Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="priority" className="text-xs font-semibold">
              Routing Priority <span className="text-destructive">*</span>
            </Label>
            <Input
              id="priority"
              type="number"
              min={0}
              max={10000}
              step={1}
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                if (fieldErrors.priority) {
                  setFieldErrors((prev) => ({ ...prev, priority: undefined }));
                }
              }}
              className={`text-xs ${fieldErrors.priority ? 'border-destructive' : ''}`}
              data-testid="priority-input"
              aria-invalid={!!fieldErrors.priority}
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              <span>
                Lower numbers mean higher priority (e.g. Priority 1 = preferred supplier, 10 = standard default, 99 = last resort).
              </span>
            </p>
            {fieldErrors.priority && (
              <p className="text-[11px] text-destructive flex items-center gap-1" data-testid="priority-error">
                <AlertCircle className="w-3 h-3" /> {fieldErrors.priority}
              </p>
            )}
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-card">
            <div className="space-y-0.5">
              <Label htmlFor="mapping-availability-switch" className="text-xs font-semibold cursor-pointer">
                Mapping Available
              </Label>
              <p className="text-[11px] text-muted-foreground">
                When enabled, this supplier mapping is eligible for fulfillment order routing.
              </p>
            </div>
            <Switch
              id="mapping-availability-switch"
              checked={isAvailable}
              onCheckedChange={setIsAvailable}
              data-testid="mapping-availability-switch"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="vendor-product-form-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="vendor-product-form-submit"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {mode === 'create' ? 'Creating...' : 'Saving...'}
                </span>
              ) : mode === 'create' ? (
                'Create Mapping'
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
