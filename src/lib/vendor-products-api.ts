import { apiRequest, ApiClientError } from './api-client';
import type { PagedResult } from './products-api';

export interface AdminVendorProductDto {
  id: number;
  vendorId: number;
  vendorName: string;
  vendorIsActive: boolean;
  productId: number;
  productSku: string;
  productName: string;
  productSellingPrice: number;
  productSellingCurrency: string;
  productIsActive: boolean;
  externalProductId: string;
  vendorCost: number;
  vendorCostCurrency: string;
  isAvailable: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export type { PagedResult };

export interface AdminVendorProductFilterQuery {
  vendorId?: number;
  productId?: number;
  productSku?: string;
  isAvailable?: boolean;
  currency?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateVendorProductRequest {
  vendorId: number;
  productId: number;
  externalProductId: string;
  vendorCost: number;
  vendorCostCurrency: string;
  isAvailable?: boolean;
  priority?: number;
}

export interface UpdateVendorProductRequest {
  externalProductId: string;
  vendorCost: number;
  vendorCostCurrency: string;
  isAvailable: boolean;
  priority: number;
}

export interface UpdateVendorProductAvailabilityRequest {
  isAvailable: boolean;
}

export interface VendorProductValidationErrors {
  vendorId?: string;
  productId?: string;
  externalProductId?: string;
  vendorCost?: string;
  vendorCostCurrency?: string;
  priority?: string;
}

/**
 * Validates a cost string against decimal(18,4) constraints:
 * - Must be a valid, non-negative number.
 * - Maximum value: 1,000,000,000.
 * - Precision: maximum 4 decimal places.
 */
export function validateCostDecimal(costStr: string): string | null {
  if (!costStr || costStr.trim() === '') {
    return 'Vendor purchase cost is required.';
  }

  const trimmed = costStr.trim();
  // Valid decimal regex: optional digits, dot, optional digits, but must have numbers
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return 'Vendor cost must be a valid non-negative number.';
  }

  const num = Number(trimmed);
  if (isNaN(num)) {
    return 'Vendor cost must be a valid number.';
  }

  if (num < 0) {
    return 'Vendor purchase cost cannot be negative.';
  }

  if (num > 1000000000) {
    return 'Vendor cost cannot exceed 1,000,000,000.';
  }

  // Check decimal places
  const parts = trimmed.split('.');
  if (parts.length === 2 && parts[1].length > 4) {
    return 'Vendor cost precision cannot exceed 4 decimal places.';
  }

  return null;
}

/**
 * Validates currency code:
 * - 3 to 10 alphanumeric characters.
 */
export function validateCurrencyCode(currency: string): string | null {
  if (!currency || currency.trim() === '') {
    return 'Vendor cost currency is required.';
  }

  const trimmed = currency.trim().toUpperCase();
  if (trimmed.length < 3 || trimmed.length > 10) {
    return 'Currency code must be between 3 and 10 characters (e.g. PKR, USD, USDT).';
  }

  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    return 'Currency code must contain only letters and digits.';
  }

  return null;
}

/**
 * Validates routing priority:
 * - Non-negative integer between 0 and 10000.
 */
export function validatePriority(priority: number | string | undefined | null): string | null {
  if (priority === undefined || priority === null || (typeof priority === 'string' && priority.trim() === '')) {
    return 'Priority must be an integer.';
  }

  const num = typeof priority === 'string' ? Number(priority.trim()) : priority;

  if (isNaN(num) || !Number.isInteger(num)) {
    return 'Priority must be an integer.';
  }

  if (num < 0 || num > 10000) {
    return 'Priority must be between 0 and 10,000.';
  }

  return null;
}

/**
 * Formats a financial vendor purchase cost with its dedicated currency.
 * Never converts or combines with different currencies.
 */
export function formatVendorCost(cost: number, currency: string): string {
  if (typeof cost !== 'number' || isNaN(cost)) {
    return `0.00 ${currency}`;
  }

  // Determine decimal places: show up to 4 if precision exists, otherwise standard 2
  const formatted = cost.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  return `${formatted} ${currency}`;
}

/**
 * Validates the vendor product mapping form client-side.
 */
export function validateVendorProductForm(
  data: {
    vendorId?: number;
    productId?: number;
    externalProductId: string;
    vendorCost: string;
    vendorCostCurrency: string;
    priority: number | string;
  },
  isCreate = true,
): VendorProductValidationErrors {
  const errors: VendorProductValidationErrors = {};

  if (isCreate) {
    if (!data.vendorId || data.vendorId < 1) {
      errors.vendorId = 'Please select a vendor.';
    }

    if (!data.productId || data.productId < 1) {
      errors.productId = 'Please select a product.';
    }
  }

  if (!data.externalProductId || data.externalProductId.trim() === '') {
    errors.externalProductId = 'External supplier product ID is required.';
  } else if (data.externalProductId.trim().length > 200) {
    errors.externalProductId = 'External product ID cannot exceed 200 characters.';
  }

  const costError = validateCostDecimal(data.vendorCost);
  if (costError) {
    errors.vendorCost = costError;
  }

  const currencyError = validateCurrencyCode(data.vendorCostCurrency);
  if (currencyError) {
    errors.vendorCostCurrency = currencyError;
  }

  const priorityError = validatePriority(data.priority);
  if (priorityError) {
    errors.priority = priorityError;
  }

  return errors;
}

/**
 * Fetches vendor-to-product mappings with filtering and pagination.
 * Endpoints: GET /api/admin/vendor-products
 */
export async function getAdminVendorProducts(
  query: AdminVendorProductFilterQuery = {},
): Promise<PagedResult<AdminVendorProductDto>> {
  const params = new URLSearchParams();

  if (query.vendorId !== undefined && query.vendorId !== null && query.vendorId > 0) {
    params.set('vendorId', query.vendorId.toString());
  }

  if (query.productId !== undefined && query.productId !== null && query.productId > 0) {
    params.set('productId', query.productId.toString());
  }

  if (query.productSku && query.productSku.trim()) {
    params.set('productSku', query.productSku.trim());
  }

  if (typeof query.isAvailable === 'boolean') {
    params.set('isAvailable', query.isAvailable.toString());
  }

  if (query.currency && query.currency.trim()) {
    params.set('currency', query.currency.trim().toUpperCase());
  }

  if (query.page && query.page > 0) {
    params.set('page', query.page.toString());
  }

  if (query.pageSize && query.pageSize > 0) {
    params.set('pageSize', Math.min(query.pageSize, 100).toString());
  }

  const queryString = params.toString();
  const endpoint = `/api/admin/vendor-products${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<PagedResult<AdminVendorProductDto>>(endpoint, {
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
 * Retrieves a single vendor product mapping by its ID.
 * Endpoint: GET /api/admin/vendor-products/{id}
 */
export async function getAdminVendorProductById(id: number): Promise<AdminVendorProductDto> {
  const response = await apiRequest<AdminVendorProductDto>(`/api/admin/vendor-products/${id}`, {
    method: 'GET',
    skipCsrf: true,
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Vendor product mapping not found.', 404);
  }

  return response.data;
}

/**
 * Creates a new vendor-to-product mapping.
 * Enforces (vendorId, productId) uniqueness on backend.
 * Endpoint: POST /api/admin/vendor-products
 */
export async function createAdminVendorProduct(
  request: CreateVendorProductRequest,
): Promise<AdminVendorProductDto> {
  const response = await apiRequest<AdminVendorProductDto>('/api/admin/vendor-products', {
    method: 'POST',
    body: JSON.stringify({
      vendorId: request.vendorId,
      productId: request.productId,
      externalProductId: request.externalProductId.trim(),
      vendorCost: request.vendorCost,
      vendorCostCurrency: request.vendorCostCurrency.trim().toUpperCase(),
      isAvailable: request.isAvailable ?? true,
      priority: request.priority ?? 10,
    }),
  });

  if (!response.data) {
    throw new ApiClientError(
      response.message || 'Failed to create vendor product mapping.',
      400,
    );
  }

  return response.data;
}

/**
 * Updates an existing vendor-to-product mapping.
 * Note: vendorId and productId are immutable and not accepted by update endpoint.
 * Endpoint: PUT /api/admin/vendor-products/{id}
 */
export async function updateAdminVendorProduct(
  id: number,
  request: UpdateVendorProductRequest,
): Promise<AdminVendorProductDto> {
  const response = await apiRequest<AdminVendorProductDto>(`/api/admin/vendor-products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      externalProductId: request.externalProductId.trim(),
      vendorCost: request.vendorCost,
      vendorCostCurrency: request.vendorCostCurrency.trim().toUpperCase(),
      isAvailable: request.isAvailable,
      priority: request.priority,
    }),
  });

  if (!response.data) {
    throw new ApiClientError(
      response.message || 'Failed to update vendor product mapping.',
      400,
    );
  }

  return response.data;
}

/**
 * Enables or disables availability of a vendor-to-product mapping.
 * Endpoint: PATCH /api/admin/vendor-products/{id}/availability
 */
export async function updateAdminVendorProductAvailability(
  id: number,
  request: UpdateVendorProductAvailabilityRequest,
): Promise<AdminVendorProductDto> {
  const response = await apiRequest<AdminVendorProductDto>(
    `/api/admin/vendor-products/${id}/availability`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        isAvailable: request.isAvailable,
      }),
    },
  );

  if (!response.data) {
    throw new ApiClientError(
      response.message || 'Failed to update vendor product mapping availability.',
      400,
    );
  }

  return response.data;
}
