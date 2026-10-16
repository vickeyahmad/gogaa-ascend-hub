import { apiRequest, ApiClientError } from './api-client';

export interface AdminProductDto {
  id: number;
  internalSku: string;
  name: string;
  description: string | null;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  categoryIsActive: boolean;
  sellingPrice: number;
  sellingCurrency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminProductFilterQuery {
  categoryId?: number;
  categorySlug?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateProductRequest {
  internalSku: string;
  name: string;
  description?: string | null;
  categoryId: number;
  sellingPrice: number;
  sellingCurrency?: string;
  isActive: boolean;
}

export interface UpdateProductRequest {
  name: string;
  description?: string | null;
  categoryId: number;
  sellingPrice: number;
  sellingCurrency?: string;
  isActive: boolean;
}

export interface UpdateProductStatusRequest {
  isActive: boolean;
}

/**
 * Fetches products for administrative management with filtering and pagination.
 * Supports query parameters: search, categoryId, categorySlug, isActive, page, pageSize.
 */
export async function getAdminProducts(
  query: AdminProductFilterQuery = {},
): Promise<PagedResult<AdminProductDto>> {
  const params = new URLSearchParams();

  if (query.categoryId !== undefined && query.categoryId !== null && query.categoryId > 0) {
    params.set('categoryId', query.categoryId.toString());
  }

  if (query.categorySlug && query.categorySlug.trim()) {
    params.set('categorySlug', query.categorySlug.trim().toLowerCase());
  }

  if (query.search && query.search.trim()) {
    params.set('search', query.search.trim());
  }

  if (typeof query.isActive === 'boolean') {
    params.set('isActive', query.isActive.toString());
  }

  if (query.page && query.page > 0) {
    params.set('page', query.page.toString());
  }

  if (query.pageSize && query.pageSize > 0) {
    params.set('pageSize', Math.min(query.pageSize, 100).toString());
  }

  const queryString = params.toString();
  const endpoint = `/api/admin/products${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<PagedResult<AdminProductDto>>(endpoint, {
    method: 'GET',
    skipCsrf: true,
  });

  return (
    response.data ?? {
      items: [],
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    }
  );
}

/**
 * Retrieves a single product by its integer ID.
 */
export async function getAdminProductById(id: number): Promise<AdminProductDto> {
  const response = await apiRequest<AdminProductDto>(`/api/admin/products/${id}`, {
    method: 'GET',
    skipCsrf: true,
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Product not found.', 404);
  }

  return response.data;
}

/**
 * Creates a new product using POST /api/admin/products.
 * Enforces unique SKU, category existence, non-negative price, X-XSRF-TOKEN and credentials: 'include'.
 */
export async function createAdminProduct(
  payload: CreateProductRequest,
): Promise<AdminProductDto> {
  const response = await apiRequest<AdminProductDto>('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to create product.');
  }

  return response.data;
}

/**
 * Updates an existing product using PUT /api/admin/products/{id}.
 * Note: InternalSku is immutable and deliberately preserved on the server.
 */
export async function updateAdminProduct(
  id: number,
  payload: UpdateProductRequest,
): Promise<AdminProductDto> {
  const response = await apiRequest<AdminProductDto>(`/api/admin/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to update product.');
  }

  return response.data;
}

/**
 * Updates product active/inactive availability using PATCH /api/admin/products/{id}/status.
 * Soft status toggle; permanent deletion is disallowed by backend architecture.
 */
export async function updateAdminProductStatus(
  id: number,
  isActive: boolean,
): Promise<AdminProductDto> {
  const response = await apiRequest<AdminProductDto>(`/api/admin/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to update product status.');
  }

  return response.data;
}

/**
 * Formats a numeric selling price with currency for user display without floating-point errors.
 * e.g., 5500.00 -> "₨ 5,500.00" or "5,500.00 PKR".
 */
export function formatPrice(price: number | string, currency = 'PKR'): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return `0.00 ${currency}`;

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (currency.toUpperCase() === 'PKR') {
    return `₨ ${formatted}`;
  }

  return `${formatted} ${currency}`;
}

export interface ProductValidationErrors {
  internalSku?: string;
  name?: string;
  categoryId?: string;
  sellingPrice?: string;
  sellingCurrency?: string;
  description?: string;
}

/**
 * Client-side validation matching ASP.NET Core backend rules:
 * - InternalSku: required on create, 2-100 characters, uppercase letters, numbers, and underscores (^[A-Z0-9_]+$)
 * - Name: required, 1-300 characters
 * - CategoryId: required, integer >= 1
 * - SellingPrice: required, number >= 0 and <= 1,000,000,000, up to 2 decimal places
 * - SellingCurrency: 3-10 characters (default 'PKR')
 * - Description: optional, max 5000 characters
 */
export function validateProductForm(
  data: {
    internalSku?: string;
    name: string;
    categoryId: number | string;
    sellingPrice: number | string;
    sellingCurrency?: string;
    description?: string | null;
  },
  isEdit = false,
): { isValid: boolean; errors: ProductValidationErrors } {
  const errors: ProductValidationErrors = {};

  // Internal SKU validation (creation only; immutable on edit)
  if (!isEdit) {
    const rawSku = (data.internalSku ?? '').trim();
    const skuRegex = /^[A-Z0-9_]+$/;

    if (!rawSku) {
      errors.internalSku = 'Internal SKU is required.';
    } else if (rawSku.length < 2 || rawSku.length > 100) {
      errors.internalSku = 'Internal SKU must be between 2 and 100 characters.';
    } else if (!skuRegex.test(rawSku)) {
      errors.internalSku =
        'Internal SKU must contain only uppercase letters, numbers, and underscores (e.g. CHATGPT_PLUS_1M).';
    }
  }

  // Name validation
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    errors.name = 'Product name is required.';
  } else if (trimmedName.length > 300) {
    errors.name = 'Product name must be between 1 and 300 characters.';
  }

  // Category ID validation
  const catId = typeof data.categoryId === 'string' ? parseInt(data.categoryId, 10) : data.categoryId;
  if (isNaN(catId) || catId < 1) {
    errors.categoryId = 'A valid category must be selected.';
  }

  // Selling Price validation
  const priceStr = String(data.sellingPrice ?? '').trim();
  if (!priceStr) {
    errors.sellingPrice = 'Selling price is required.';
  } else {
    const priceNum = parseFloat(priceStr);
    // Disallow negative numbers, non-numeric strings, or invalid decimals
    const priceRegex = /^\d+(\.\d{1,2})?$/;
    if (isNaN(priceNum) || !priceRegex.test(priceStr)) {
      errors.sellingPrice = 'Selling price must be a valid non-negative number with up to 2 decimal places.';
    } else if (priceNum < 0) {
      errors.sellingPrice = 'Selling price cannot be negative.';
    } else if (priceNum > 1000000000) {
      errors.sellingPrice = 'Selling price cannot exceed 1,000,000,000.';
    }
  }

  // Selling Currency validation
  if (data.sellingCurrency) {
    const cur = data.sellingCurrency.trim();
    if (cur.length < 3 || cur.length > 10) {
      errors.sellingCurrency = 'Selling currency must be an ISO currency code (e.g. PKR).';
    }
  }

  // Description validation
  if (data.description && data.description.length > 5000) {
    errors.description = 'Description cannot exceed 5000 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
