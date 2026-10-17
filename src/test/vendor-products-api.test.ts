import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAdminVendorProducts,
  getAdminVendorProductById,
  createAdminVendorProduct,
  updateAdminVendorProduct,
  updateAdminVendorProductAvailability,
  validateCostDecimal,
  validateCurrencyCode,
  validatePriority,
  formatVendorCost,
  validateVendorProductForm,
  type AdminVendorProductDto,
} from '../lib/vendor-products-api';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';

describe('Vendor Products API and Validation', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Validation Helpers', () => {
    describe('validateCostDecimal', () => {
      it('rejects empty or whitespace inputs', () => {
        expect(validateCostDecimal('')).toBe('Vendor purchase cost is required.');
        expect(validateCostDecimal('   ')).toBe('Vendor purchase cost is required.');
      });

      it('rejects malformed and negative inputs', () => {
        expect(validateCostDecimal('-5')).toBe('Vendor cost must be a valid non-negative number.');
        expect(validateCostDecimal('abc')).toBe('Vendor cost must be a valid non-negative number.');
        expect(validateCostDecimal('12.34.56')).toBe('Vendor cost must be a valid non-negative number.');
      });

      it('rejects values exceeding maximum limit of 1,000,000,000', () => {
        expect(validateCostDecimal('1000000001')).toBe('Vendor cost cannot exceed 1,000,000,000.');
      });

      it('rejects precision exceeding 4 decimal places', () => {
        expect(validateCostDecimal('12.12345')).toBe('Vendor cost precision cannot exceed 4 decimal places.');
      });

      it('accepts valid integers and decimals up to 4 decimal places', () => {
        expect(validateCostDecimal('0')).toBeNull();
        expect(validateCostDecimal('1450')).toBeNull();
        expect(validateCostDecimal('14.50')).toBeNull();
        expect(validateCostDecimal('12.3456')).toBeNull();
      });
    });

    describe('validateCurrencyCode', () => {
      it('rejects empty currency codes', () => {
        expect(validateCurrencyCode('')).toBe('Vendor cost currency is required.');
      });

      it('rejects codes shorter than 3 or longer than 10 characters', () => {
        expect(validateCurrencyCode('US')).toBe(
          'Currency code must be between 3 and 10 characters (e.g. PKR, USD, USDT).',
        );
        expect(validateCurrencyCode('TOOLONGCURRENCY')).toBe(
          'Currency code must be between 3 and 10 characters (e.g. PKR, USD, USDT).',
        );
      });

      it('rejects non-alphanumeric currency symbols', () => {
        expect(validateCurrencyCode('US$')).toBe(
          'Currency code must contain only letters and digits.',
        );
      });

      it('accepts valid alphanumeric codes', () => {
        expect(validateCurrencyCode('PKR')).toBeNull();
        expect(validateCurrencyCode('USD')).toBeNull();
        expect(validateCurrencyCode('USDT')).toBeNull();
        expect(validateCurrencyCode('EUR')).toBeNull();
      });
    });

    describe('validatePriority', () => {
      it('rejects negative numbers and non-integers', () => {
        expect(validatePriority(-1)).toBe('Priority must be between 0 and 10,000.');
        expect(validatePriority(10.5)).toBe('Priority must be an integer.');
        expect(validatePriority('invalid')).toBe('Priority must be an integer.');
      });

      it('rejects numbers above 10,000', () => {
        expect(validatePriority(10001)).toBe('Priority must be between 0 and 10,000.');
      });

      it('accepts non-negative integers', () => {
        expect(validatePriority(0)).toBeNull();
        expect(validatePriority(1)).toBeNull();
        expect(validatePriority(10)).toBeNull();
        expect(validatePriority('99')).toBeNull();
      });
    });

    describe('formatVendorCost', () => {
      it('formats cost cleanly with its own currency and never converts', () => {
        expect(formatVendorCost(1600, 'PKR')).toBe('1,600.00 PKR');
        expect(formatVendorCost(14.5, 'USDT')).toBe('14.50 USDT');
        expect(formatVendorCost(12.3456, 'USD')).toBe('12.3456 USD');
        expect(formatVendorCost(NaN, 'PKR')).toBe('0.00 PKR');
      });
    });

    describe('validateVendorProductForm', () => {
      it('validates all required fields in create mode', () => {
        const errors = validateVendorProductForm({
          vendorId: undefined,
          productId: undefined,
          externalProductId: '',
          vendorCost: '',
          vendorCostCurrency: '',
          priority: '',
        });

        expect(errors.vendorId).toBe('Please select a vendor.');
        expect(errors.productId).toBe('Please select a product.');
        expect(errors.externalProductId).toBe('External supplier product ID is required.');
        expect(errors.vendorCost).toBe('Vendor purchase cost is required.');
        expect(errors.vendorCostCurrency).toBe('Vendor cost currency is required.');
        expect(errors.priority).toBe('Priority must be an integer.');
      });

      it('does not require vendorId and productId in edit mode', () => {
        const errors = validateVendorProductForm(
          {
            externalProductId: 'EXT123',
            vendorCost: '1450',
            vendorCostCurrency: 'PKR',
            priority: 1,
          },
          false,
        );

        expect(errors.vendorId).toBeUndefined();
        expect(errors.productId).toBeUndefined();
        expect(Object.keys(errors)).toHaveLength(0);
      });

      it('rejects external product ID exceeding 200 characters', () => {
        const errors = validateVendorProductForm({
          vendorId: 1,
          productId: 1,
          externalProductId: 'x'.repeat(201),
          vendorCost: '10',
          vendorCostCurrency: 'USD',
          priority: 5,
        });

        expect(errors.externalProductId).toBe('External product ID cannot exceed 200 characters.');
      });
    });
  });

  describe('API Endpoints', () => {
    const mockMapping: AdminVendorProductDto = {
      id: 101,
      vendorId: 1,
      vendorName: 'Supplier Prime',
      vendorIsActive: true,
      productId: 10,
      productSku: 'CHATGPT_PLUS_1M',
      productName: 'ChatGPT Plus (1 Month)',
      productSellingPrice: 2500,
      productSellingCurrency: 'PKR',
      productIsActive: true,
      externalProductId: '221',
      vendorCost: 1600,
      vendorCostCurrency: 'PKR',
      isAvailable: true,
      priority: 2,
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T12:00:00Z',
    };

    it('getAdminVendorProducts fetches mappings with filters and pagination', async () => {
      const mockPagedResult = {
        items: [mockMapping],
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
            message: 'Vendor product mappings retrieved successfully.',
            data: mockPagedResult,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminVendorProducts({
        vendorId: 1,
        productSku: 'CHATGPT',
        isAvailable: true,
        currency: 'PKR',
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].externalProductId).toBe('221');
      expect(result.items[0].vendorCost).toBe(1600);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendor-products?vendorId=1&productSku=CHATGPT&isAvailable=true&currency=PKR&page=1&pageSize=10',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('getAdminVendorProductById retrieves mapping by ID', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor product mapping retrieved successfully.',
            data: mockMapping,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminVendorProductById(101);
      expect(result.id).toBe(101);
      expect(result.vendorName).toBe('Supplier Prime');
    });

    it('createAdminVendorProduct sends POST with CSRF token and normalized currency', async () => {
      setInMemoryCsrfToken('test-csrf-token-123');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor product mapping created successfully.',
            data: mockMapping,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await createAdminVendorProduct({
        vendorId: 1,
        productId: 10,
        externalProductId: '221',
        vendorCost: 1600,
        vendorCostCurrency: 'pkr',
        isAvailable: true,
        priority: 2,
      });

      expect(result.id).toBe(101);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendor-products',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Headers),
          credentials: 'include',
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('test-csrf-token-123');

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.vendorCostCurrency).toBe('PKR');
      expect(body.externalProductId).toBe('221');
    });

    it('updateAdminVendorProduct sends PUT without modifying vendorId or productId', async () => {
      setInMemoryCsrfToken('test-csrf-token-123');

      const updatedMapping = { ...mockMapping, vendorCost: 1450, priority: 1 };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor product mapping updated successfully.',
            data: updatedMapping,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminVendorProduct(101, {
        externalProductId: '221-UPDATED',
        vendorCost: 1450,
        vendorCostCurrency: 'PKR',
        isAvailable: true,
        priority: 1,
      });

      expect(result.vendorCost).toBe(1450);
      expect(result.priority).toBe(1);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendor-products/101',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
        }),
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.vendorId).toBeUndefined();
      expect(body.productId).toBeUndefined();
      expect(body.externalProductId).toBe('221-UPDATED');
    });

    it('updateAdminVendorProductAvailability sends PATCH with target isAvailable status', async () => {
      setInMemoryCsrfToken('test-csrf-token-123');

      const disabledMapping = { ...mockMapping, isAvailable: false };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Vendor product availability updated to unavailable.',
            data: disabledMapping,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminVendorProductAvailability(101, { isAvailable: false });

      expect(result.isAvailable).toBe(false);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/vendor-products/101/availability',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
        }),
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.isAvailable).toBe(false);
    });
  });
});
