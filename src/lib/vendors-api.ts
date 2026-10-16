import { apiRequest, ApiClientError } from './api-client';
import type { PagedResult } from './products-api';

export interface AdminVendorDto {
  id: number;
  internalName: string;
  isActive: boolean;
  productMappingCount: number;
  createdAt: string;
  updatedAt: string;
}

export type { PagedResult };

export interface AdminVendorFilterQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateVendorRequest {
  internalName: string;
  isActive?: boolean;
}

export interface UpdateVendorRequest {
  internalName: string;
  isActive: boolean;
}

export interface UpdateVendorStatusRequest {
  isActive: boolean;
}

/**
 * Fetches vendors for administrative management with filtering and pagination.
 * Supports query parameters: search, isActive, page, pageSize.
 * Vendor identities are strictly internal and never exposed to customers.
 */
export async function getAdminVendors(
  query: AdminVendorFilterQuery = {},
): Promise<PagedResult<AdminVendorDto>> {
  const params = new URLSearchParams();

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
  const endpoint = `/api/admin/vendors${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<PagedResult<AdminVendorDto>>(endpoint, {
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
 * Retrieves a single vendor by its integer ID.
 */
export async function getAdminVendorById(id: number): Promise<AdminVendorDto> {
  const response = await apiRequest<AdminVendorDto>(`/api/admin/vendors/${id}`, {
    method: 'GET',
    skipCsrf: true,
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Vendor not found.', 404);
  }

  return response.data;
}

/**
 * Creates a new vendor record using POST /api/admin/vendors.
 * Validates unique internal name, requires X-XSRF-TOKEN and credentials: 'include'.
 */
export async function createAdminVendor(
  payload: CreateVendorRequest,
): Promise<AdminVendorDto> {
  const response = await apiRequest<AdminVendorDto>('/api/admin/vendors', {
    method: 'POST',
    body: JSON.stringify({
      internalName: payload.internalName.trim(),
      isActive: payload.isActive ?? true,
    }),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to create vendor.');
  }

  return response.data;
}

/**
 * Updates an existing vendor's internal name and status using PUT /api/admin/vendors/{id}.
 * Enforces unique internal name check, requires X-XSRF-TOKEN and credentials: 'include'.
 */
export async function updateAdminVendor(
  id: number,
  payload: UpdateVendorRequest,
): Promise<AdminVendorDto> {
  const response = await apiRequest<AdminVendorDto>(`/api/admin/vendors/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      internalName: payload.internalName.trim(),
      isActive: payload.isActive,
    }),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to update vendor.');
  }

  return response.data;
}

/**
 * Enables or disables a vendor using PATCH /api/admin/vendors/{id}/status.
 * Soft status toggle; permanent deletion is disallowed by backend design.
 * Existing product mappings are preserved intact when disabled.
 */
export async function updateAdminVendorStatus(
  id: number,
  isActive: boolean,
): Promise<AdminVendorDto> {
  const response = await apiRequest<AdminVendorDto>(`/api/admin/vendors/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });

  if (!response.data) {
    throw new ApiClientError(response.message || 'Failed to update vendor status.');
  }

  return response.data;
}

export interface VendorValidationErrors {
  internalName?: string;
}

/**
 * Client-side validation matching ASP.NET Core backend rules:
 * - InternalName: required, 1-200 characters
 */
export function validateVendorForm(data: {
  internalName: string;
}): { isValid: boolean; errors: VendorValidationErrors } {
  const errors: VendorValidationErrors = {};

  const trimmedName = data.internalName.trim();
  if (!trimmedName) {
    errors.internalName = 'Vendor internal name is required.';
  } else if (trimmedName.length > 200) {
    errors.internalName = 'Vendor internal name must be between 1 and 200 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
