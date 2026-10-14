import { apiRequest, ApiClientError } from './api-client';

export interface AdminCategoryDto {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
}

export interface UpdateCategoryRequest {
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
}

export interface UpdateCategoryStatusRequest {
  isActive: boolean;
}

/**
 * Fetches all categories for administrative overview.
 * Accepts optional isActive filter: null/undefined = all; true = active only; false = inactive only.
 */
export async function getAdminCategories(isActive?: boolean): Promise<AdminCategoryDto[]> {
  const query = typeof isActive === 'boolean' ? `?isActive=${isActive}` : '';
  const response = await apiRequest<AdminCategoryDto[]>(`/api/admin/categories${query}`, {
    method: 'GET',
    skipCsrf: true,
  });

  return response.data ?? [];
}

/**
 * Retrieves a single category by its ID.
 */
export async function getAdminCategoryById(id: number): Promise<AdminCategoryDto> {
  const response = await apiRequest<AdminCategoryDto>(`/api/admin/categories/${id}`, {
    method: 'GET',
    skipCsrf: true,
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Category not found.', 404);
  }

  return response.data;
}

/**
 * Creates a new product category using POST /api/admin/categories.
 * Enforces X-XSRF-TOKEN and credentials: 'include'.
 */
export async function createAdminCategory(payload: CreateCategoryRequest): Promise<AdminCategoryDto> {
  const response = await apiRequest<AdminCategoryDto>('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to create category.');
  }

  return response.data;
}

/**
 * Updates an existing category's name, slug, description, and status using PUT /api/admin/categories/{id}.
 * Enforces X-XSRF-TOKEN and credentials: 'include'.
 */
export async function updateAdminCategory(
  id: number,
  payload: UpdateCategoryRequest,
): Promise<AdminCategoryDto> {
  const response = await apiRequest<AdminCategoryDto>(`/api/admin/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to update category.');
  }

  return response.data;
}

/**
 * Updates category active/inactive status using PATCH /api/admin/categories/{id}/status.
 * Soft status toggle; permanent deletion is disallowed by backend design.
 */
export async function updateAdminCategoryStatus(
  id: number,
  isActive: boolean,
): Promise<AdminCategoryDto> {
  const response = await apiRequest<AdminCategoryDto>(`/api/admin/categories/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to update category status.');
  }

  return response.data;
}

/**
 * Generates a clean URL-friendly slug suggestion from a category name.
 * Lowercase alphanumeric words separated by single hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface CategoryValidationErrors {
  name?: string;
  slug?: string;
  description?: string;
}

/**
 * Client-side validation matching ASP.NET Core backend rules:
 * - Name: required, 1-200 characters
 * - Slug: required, 1-200 characters, lowercase alphanumeric words separated by hyphens (^[a-z0-9]+(?:-[a-z0-9]+)*$)
 * - Description: optional, max 2000 characters
 */
export function validateCategoryForm(data: {
  name: string;
  slug: string;
  description?: string | null;
}): { isValid: boolean; errors: CategoryValidationErrors } {
  const errors: CategoryValidationErrors = {};

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    errors.name = 'Category name is required.';
  } else if (trimmedName.length > 200) {
    errors.name = 'Category name must be between 1 and 200 characters.';
  }

  const trimmedSlug = data.slug.trim();
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!trimmedSlug) {
    errors.slug = 'Category slug is required.';
  } else if (trimmedSlug.length > 200) {
    errors.slug = 'Category slug must be between 1 and 200 characters.';
  } else if (!slugRegex.test(trimmedSlug)) {
    errors.slug = "Slug must be lowercase alphanumeric words separated by hyphens (e.g. 'ai-tools').";
  }

  if (data.description && data.description.length > 2000) {
    errors.description = 'Description cannot exceed 2000 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
