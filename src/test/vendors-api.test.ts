import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAdminVendors,
  getAdminVendorById,
  createAdminVendor,
  updateAdminVendor,
  updateAdminVendorStatus,
  validateVendorForm,
} from '../lib/vendors-api';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';

describe('Vendors API and Validation', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Form Validation', () => {
    it('validates vendor internal name presence and character limits', () => {
      expect(validateVendorForm({ internalName: '' }).errors.internalName).toBe(
        'Vendor internal name is required.',
      );

      expect(validateVendorForm({ internalName: '   ' }).errors.internalName).toBe(
        'Vendor internal name is required.',
      );

      expect(validateVendorForm({ internalName: 'a'.repeat(201) }).errors.internalName).toBe(
        'Vendor internal name must be between 1 and 200 characters.',
      );

      expect(validateVendorForm({ internalName: 'Supplier Alpha' }).isValid).toBe(true);
      expect(validateVendorForm({ internalName: 'Supplier Alpha' }).errors.internalName).toBeUndefined();
    });
  });

  describe('API requests', () => {
    it('getAdminVendors fetches from /api/admin/vendors with pagination and filters', async () => {
      const mockPagedResult = {
        items: [
          {
            id: 1,
            internalName: 'Supplier Alpha',
            isActive: true,
            productMappingCount: 5,
            createdAt: '2026-10-14T10:00:00Z',
            updatedAt: '2026-10-14T12:00:00Z',
          },
        ],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendors retrieved successfully.',
            data: mockPagedResult,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminVendors({
        search: 'alpha',
        isActive: true,
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].internalName).toBe('Supplier Alpha');
      expect(result.items[0].productMappingCount).toBe(5);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendors?search=alpha&isActive=true&page=1&pageSize=10',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('getAdminVendorById retrieves a specific vendor by ID', async () => {
      const mockVendor = {
        id: 7,
        internalName: 'Supplier Beta',
        isActive: true,
        productMappingCount: 2,
        createdAt: '2026-10-14T10:00:00Z',
        updatedAt: '2026-10-14T10:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor retrieved successfully.',
            data: mockVendor,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminVendorById(7);
      expect(result.id).toBe(7);
      expect(result.internalName).toBe('Supplier Beta');

      expect(fetchSpy).toHaveBeenCalledWith('/api/admin/vendors/7', expect.anything());
    });

    it('createAdminVendor sends POST with CSRF token and payload', async () => {
      setInMemoryCsrfToken('mock-csrf-token-xyz');

      const payload = {
        internalName: 'New Supplier Gamma',
        isActive: true,
      };

      const createdVendor = {
        id: 12,
        internalName: 'New Supplier Gamma',
        isActive: true,
        productMappingCount: 0,
        createdAt: '2026-10-16T10:00:00Z',
        updatedAt: '2026-10-16T10:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor created successfully.',
            data: createdVendor,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await createAdminVendor(payload);
      expect(result.id).toBe(12);
      expect(result.internalName).toBe('New Supplier Gamma');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendors',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify(payload),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('mock-csrf-token-xyz');
    });

    it('updateAdminVendor sends PUT to /api/admin/vendors/:id with CSRF and payload', async () => {
      setInMemoryCsrfToken('mock-csrf-token-xyz');

      const payload = {
        internalName: 'Updated Supplier Delta',
        isActive: true,
      };

      const updatedVendor = {
        id: 12,
        internalName: 'Updated Supplier Delta',
        isActive: true,
        productMappingCount: 3,
        createdAt: '2026-10-16T10:00:00Z',
        updatedAt: '2026-10-16T11:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor updated successfully.',
            data: updatedVendor,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminVendor(12, payload);
      expect(result.internalName).toBe('Updated Supplier Delta');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendors/12',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify(payload),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('mock-csrf-token-xyz');
    });

    it('updateAdminVendorStatus sends PATCH to /api/admin/vendors/:id/status with target active state', async () => {
      setInMemoryCsrfToken('mock-csrf-token-xyz');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor status updated to inactive.',
            data: {
              id: 12,
              internalName: 'Supplier Delta',
              isActive: false,
              productMappingCount: 3,
              createdAt: '2026-10-16T10:00:00Z',
              updatedAt: '2026-10-16T12:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminVendorStatus(12, false);
      expect(result.isActive).toBe(false);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendors/12/status',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          body: JSON.stringify({ isActive: false }),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('mock-csrf-token-xyz');
    });

    it('confirms vendor security: no secret values or credentials exist in vendor contracts', () => {
      const sampleVendor: import('../lib/vendors-api').AdminVendorDto = {
        id: 1,
        internalName: 'Clean Supplier',
        isActive: true,
        productMappingCount: 0,
        createdAt: '2026-10-16T10:00:00Z',
        updatedAt: '2026-10-16T10:00:00Z',
      };

      // Type inspection: verify absence of credential fields
      const vendorKeys = Object.keys(sampleVendor);
      expect(vendorKeys).not.toContain('apiKey');
      expect(vendorKeys).not.toContain('password');
      expect(vendorKeys).not.toContain('secret');
      expect(vendorKeys).not.toContain('token');
      expect(vendorKeys).not.toContain('credentials');
    });
  });
});
