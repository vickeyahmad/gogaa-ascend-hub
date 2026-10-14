import { useState, useEffect } from 'react';
import { FolderPlus, Pencil, AlertCircle, Sparkles } from 'lucide-react';
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
  generateSlug,
  validateCategoryForm,
  type AdminCategoryDto,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
  type CategoryValidationErrors,
} from '@/lib/categories-api';
import { ApiClientError } from '@/lib/api-client';

export interface CategoryFormDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  category?: AdminCategoryDto | null;
  onClose: () => void;
  onSubmitCreate?: (payload: CreateCategoryRequest) => Promise<AdminCategoryDto>;
  onSubmitUpdate?: (id: number, payload: UpdateCategoryRequest) => Promise<AdminCategoryDto>;
  onSuccess?: (category: AdminCategoryDto, mode: 'create' | 'edit') => void;
}

export function CategoryFormDialog({
  isOpen,
  mode,
  category,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onSuccess,
}: CategoryFormDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<CategoryValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever the dialog opens or the target category changes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && category) {
      setName(category.name);
      setSlug(category.slug);
      setDescription(category.description ?? '');
      setIsActive(category.isActive);
      setIsSlugCustomized(true);
    } else {
      setName('');
      setSlug('');
      setDescription('');
      setIsActive(true);
      setIsSlugCustomized(false);
    }

    setFieldErrors({});
    setServerError(null);
    setIsSubmitting(false);
  }, [isOpen, mode, category]);

  // Handle Name change and auto-generate slug suggestion unless user customized it
  const handleNameChange = (val: string) => {
    setName(val);
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: undefined }));
    }

    if (!isSlugCustomized && mode === 'create') {
      const suggested = generateSlug(val);
      setSlug(suggested);
      if (fieldErrors.slug) {
        setFieldErrors((prev) => ({ ...prev, slug: undefined }));
      }
    }
  };

  const handleSlugChange = (val: string) => {
    setIsSlugCustomized(true);
    setSlug(val.toLowerCase().trim());
    if (fieldErrors.slug) {
      setFieldErrors((prev) => ({ ...prev, slug: undefined }));
    }
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (fieldErrors.description) {
      setFieldErrors((prev) => ({ ...prev, description: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // Prevent duplicate submission

    setServerError(null);

    const validation = validateCategoryForm({
      name,
      slug,
      description: description.trim() ? description : null,
    });

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

        const payload: CreateCategoryRequest = {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          description: description.trim() ? description.trim() : null,
          isActive,
        };

        const created = await onSubmitCreate(payload);
        onSuccess?.(created, 'create');
        onClose();
      } else if (mode === 'edit' && category) {
        if (!onSubmitUpdate) {
          throw new Error('Update handler not provided.');
        }

        const payload: UpdateCategoryRequest = {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          description: description.trim() ? description.trim() : null,
          isActive,
        };

        const updated = await onSubmitUpdate(category.id, payload);
        onSuccess?.(updated, 'edit');
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setFieldErrors((prev) => ({
            ...prev,
            slug: err.message || `A category with slug '${slug}' already exists.`,
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

  const isEdit = mode === 'edit';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="dialog-symbol">
                {isEdit ? <Pencil className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle>{isEdit ? 'Edit Category' : 'Create Category'}</DialogTitle>
                <DialogDescription className="text-xs">
                  {isEdit
                    ? `Update details for category #${category?.id}. Server-managed fields are preserved.`
                    : 'Add a new product category to your marketplace catalog.'}
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
                data-testid="category-form-server-error"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{serverError}</div>
              </div>
            )}

            {/* Category Name */}
            <div className="space-y-1.5">
              <div className="field-label-row">
                <Label htmlFor="category-name" className="text-xs font-semibold">
                  Category Name <span className="text-destructive">*</span>
                </Label>
                <span className="field-char-count">{name.length}/200</span>
              </div>
              <Input
                id="category-name"
                data-testid="category-name-input"
                placeholder="e.g. AI Tools & Software"
                value={name}
                maxLength={200}
                disabled={isSubmitting}
                onChange={(e) => handleNameChange(e.target.value)}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? 'category-name-error' : undefined}
                className={fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.name && (
                <p id="category-name-error" className="field-error-text" role="alert">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Category Slug */}
            <div className="space-y-1.5">
              <div className="field-label-row">
                <Label htmlFor="category-slug" className="text-xs font-semibold">
                  URL Slug <span className="text-destructive">*</span>
                </Label>
                <span className="field-char-count">{slug.length}/200</span>
              </div>
              <div className="relative">
                <Input
                  id="category-slug"
                  data-testid="category-slug-input"
                  placeholder="e.g. ai-tools"
                  value={slug}
                  maxLength={200}
                  disabled={isSubmitting}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  aria-invalid={!!fieldErrors.slug}
                  aria-describedby={fieldErrors.slug ? 'category-slug-error' : 'category-slug-help'}
                  className={`font-mono text-xs ${
                    fieldErrors.slug ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                />
              </div>
              {fieldErrors.slug ? (
                <p id="category-slug-error" className="field-error-text" role="alert">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.slug}
                </p>
              ) : (
                <p id="category-slug-help" className="field-help-text">
                  Lowercase alphanumeric words separated by hyphens (e.g. &apos;ai-tools&apos;). Used in
                  public catalog URLs.
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="field-label-row">
                <Label htmlFor="category-description" className="text-xs font-semibold">
                  Description <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <span className="field-char-count">{description.length}/2000</span>
              </div>
              <Textarea
                id="category-description"
                data-testid="category-description-input"
                placeholder="Brief summary explaining what products belong in this category..."
                value={description}
                maxLength={2000}
                rows={3}
                disabled={isSubmitting}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                aria-invalid={!!fieldErrors.description}
                aria-describedby={
                  fieldErrors.description ? 'category-desc-error' : undefined
                }
                className={
                  fieldErrors.description ? 'border-destructive focus-visible:ring-destructive' : ''
                }
              />
              {fieldErrors.description && (
                <p id="category-desc-error" className="field-error-text" role="alert">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fieldErrors.description}
                </p>
              )}
            </div>

            {/* Active Status Switch */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="category-active-switch" className="text-xs font-semibold cursor-pointer">
                  Active Status
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {isActive
                    ? 'Visible in public catalog navigation when active products exist.'
                    : 'Hidden from customer catalog navigation. All products in this category are hidden.'}
                </p>
              </div>
              <Switch
                id="category-active-switch"
                data-testid="category-active-switch"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isSubmitting}
              />
            </div>

            {/* Read-only Server metadata in Edit Mode */}
            {isEdit && category && (
              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground grid grid-cols-2 gap-2 border border-border/50">
                <div>
                  <span className="font-semibold text-foreground/75">Linked Products:</span>{' '}
                  {category.productCount}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Category ID:</span> #{category.id}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Created:</span>{' '}
                  {new Date(category.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-semibold text-foreground/75">Last Updated:</span>{' '}
                  {new Date(category.updatedAt).toLocaleDateString()}
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
              data-testid="category-submit-button"
            >
              {isSubmitting ? (
                <>
                  <span className="button-loader" aria-hidden="true" />
                  <span>{isEdit ? 'Saving Changes...' : 'Creating Category...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'Save Changes' : 'Create Category'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
