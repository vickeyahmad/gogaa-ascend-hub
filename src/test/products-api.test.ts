import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAdminProducts,
  getAdminProductById,
  createAdminProduct,
  updateAdminProduct,
  updateAdminProductStatus,
  formatPrice,
  validateProductForm,
} from '../lib/products-api';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';

describe('Products API and Validation', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Form Validation & Price Formatting', () => {
    it('formats prices with PKR currency symbol and 2 decimal places', () => {
      expect(formatPrice(5500)).toBe('₨ 5,500.00');
      expect(formatPrice(0)).toBe('₨ 0.00');
      expect(formatPrice('1250.5')).toBe('₨ 1,250.50');
      expect(formatPrice(99.99, 'USD')).toBe('99.99 USD');
      expect(formatPrice(NaN)).toBe('0.00 PKR');
    });

    it('validates SKU format: uppercase alphanumeric and underscores only', () => {
      // Creation requires valid SKU
      expect(
        validateProductForm({
          internalSku: '',
          name: 'ChatGPT Plus',
          categoryId: 1,
          sellingPrice: '5500',
        }).errors.internalSku,
      ).toBe('Internal SKU is required.');

      expect(
        validateProductForm({
          internalSku: 'a',
          name: 'ChatGPT Plus',
          categoryId: 1,
          sellingPrice: '5500',
        }).errors.internalSku,
      ).toContain('between 2 and 100 characters');

      expect(
        validateProductForm({
          internalSku: 'chatgpt-plus', // lowercase and hyphens disallowed
          name: 'ChatGPT Plus',
          categoryId: 1,
          sellingPrice: '5500',
        }).errors.internalSku,
      ).toContain('uppercase letters, numbers, and underscores');

      expect(
        validateProductForm({
          internalSku: 'CHATGPT PLUS', // space disallowed
          name: 'ChatGPT Plus',
          categoryId: 1,
          sellingPrice: '5500',
        }).errors.internalSku,
      ).toContain('uppercase letters, numbers, and underscores');

      // Valid SKUs
      expect(
        validateProductForm({
          internalSku: 'CHATGPT_PLUS_1M',
          name: 'ChatGPT Plus',
          categoryId: 1,
          sellingPrice: '5500',
        }).isValid,
      ).toBe(true);

      expect(
        validateProductForm({
          internalSku: 'GPT4_TURBO_API',
          name: 'GPT-4 Turbo',
          categoryId: 2,
          sellingPrice: '12000.50',
        }).isValid,
      ).toBe(true);
    });

    it('bypasses SKU validation in edit mode because SKU is immutable', () => {
      const editResult = validateProductForm(
        {
          internalSku: undefined, // omitted on edit
          name: 'Updated Name',
          categoryId: 2,
          sellingPrice: '3000',
        },
        true, // isEdit = true
      );

      expect(editResult.isValid).toBe(true);
      expect(editResult.errors.internalSku).toBeUndefined();
    });

    it('validates product name presence and character limits', () => {
      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: '',
          categoryId: 1,
          sellingPrice: '100',
        }).errors.name,
      ).toBe('Product name is required.');

      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'a'.repeat(301),
          categoryId: 1,
          sellingPrice: '100',
        }).errors.name,
      ).toBe('Product name must be between 1 and 300 characters.');
    });

    it('validates category selection', () => {
      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: '',
          sellingPrice: '100',
        }).errors.categoryId,
      ).toBe('A valid category must be selected.');

      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 0,
          sellingPrice: '100',
        }).errors.categoryId,
      ).toBe('A valid category must be selected.');
    });

    it('validates non-negative selling price and numeric formatting', () => {
      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 1,
          sellingPrice: '',
        }).errors.sellingPrice,
      ).toBe('Selling price is required.');

      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 1,
          sellingPrice: 'abc',
        }).errors.sellingPrice,
      ).toContain('valid non-negative number');

      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 1,
          sellingPrice: '-50',
        }).errors.sellingPrice,
      ).toContain('valid non-negative number');

      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 1,
          sellingPrice: '10.999', // more than 2 decimal places
        }).errors.sellingPrice,
      ).toContain('up to 2 decimal places');

      // Valid prices
      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 1,
          sellingPrice: '0',
        }).isValid,
      ).toBe(true);

      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 1,
          sellingPrice: '5500.50',
        }).isValid,
      ).toBe(true);
    });

    it('validates description maximum length', () => {
      expect(
        validateProductForm({
          internalSku: 'SKU_1',
          name: 'Valid Name',
          categoryId: 1,
          sellingPrice: '100',
          description: 'a'.repeat(5001),
        }).errors.description,
      ).toBe('Description cannot exceed 5000 characters.');
    });
  });

  describe('API requests', () => {
    it('getAdminProducts fetches from /api/admin/products with pagination and filters', async () => {
      const mockPagedResult = {
        items: [
          {
            id: 1,
            internalSku: 'CHATGPT_PLUS_1M',
            name: 'ChatGPT Plus 1 Month',
            description: 'AI subscription voucher',
            categoryId: 1,
            categoryName: 'AI Tools',
            categorySlug: 'ai-tools',
            categoryIsActive: true,
            sellingPrice: 5500,
            sellingCurrency: 'PKR',
            isActive: true,
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
            message: 'Products retrieved successfully.',
            data: mockPagedResult,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminProducts({
        search: 'chatgpt',
        categoryId: 1,
        isActive: true,
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].internalSku).toBe('CHATGPT_PLUS_1M');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/products?categoryId=1&search=chatgpt&isActive=true&page=1&pageSize=10',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('getAdminProductById retrieves a specific product by ID', async () => {
      const mockProduct = {
        id: 42,
        internalSku: 'CLAUDE_PRO_1M',
        name: 'Claude Pro 1 Month',
        description: null,
        categoryId: 1,
        categoryName: 'AI Tools',
        categorySlug: 'ai-tools',
        categoryIsActive: true,
        sellingPrice: 6000,
        sellingCurrency: 'PKR',
        isActive: true,
        createdAt: '2026-10-14T10:00:00Z',
        updatedAt: '2026-10-14T10:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Product retrieved successfully.',
            data: mockProduct,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminProductById(42);
      expect(result.id).toBe(42);
      expect(result.internalSku).toBe('CLAUDE_PRO_1M');

      expect(fetchSpy).toHaveBeenCalledWith('/api/admin/products/42', expect.anything());
    });

    it('createAdminProduct sends POST with CSRF token and payload', async () => {
      setInMemoryCsrfToken('mock-csrf-token-abc');

      const payload = {
        internalSku: 'MIDJOURNEY_STANDARD_1M',
        name: 'Midjourney Standard 1 Month',
        categoryId: 2,
        sellingPrice: 8500,
        sellingCurrency: 'PKR',
        description: 'Standard image generation plan',
        isActive: true,
      };

      const createdProduct = {
        id: 15,
        ...payload,
        categoryName: 'Design AI',
        categorySlug: 'design-ai',
        categoryIsActive: true,
        createdAt: '2026-10-16T10:00:00Z',
        updatedAt: '2026-10-16T10:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Product created successfully.',
            data: createdProduct,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await createAdminProduct(payload);
      expect(result.id).toBe(15);
      expect(result.internalSku).toBe('MIDJOURNEY_STANDARD_1M');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/products',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify(payload),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('mock-csrf-token-abc');
    });

    it('updateAdminProduct sends PUT to /api/admin/products/:id with CSRF and payload (no SKU)', async () => {
      setInMemoryCsrfToken('mock-csrf-token-abc');

      const payload = {
        name: 'Updated Product Name',
        categoryId: 3,
        sellingPrice: 9000,
        sellingCurrency: 'PKR',
        description: 'Updated description',
        isActive: true,
      };

      const updatedProduct = {
        id: 15,
        internalSku: 'MIDJOURNEY_STANDARD_1M', // preserved
        ...payload,
        categoryName: 'Updated Category',
        categorySlug: 'updated-category',
        categoryIsActive: true,
        createdAt: '2026-10-16T10:00:00Z',
        updatedAt: '2026-10-16T11:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Product updated successfully.',
            data: updatedProduct,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminProduct(15, payload);
      expect(result.name).toBe('Updated Product Name');
      expect(result.sellingPrice).toBe(9000);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/products/15',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify(payload),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('mock-csrf-token-abc');
    });

    it('updateAdminProductStatus sends PATCH to /api/admin/products/:id/status with target active state', async () => {
      setInMemoryCsrfToken('mock-csrf-token-abc');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Product status updated to inactive.',
            data: {
              id: 15,
              internalSku: 'MIDJOURNEY_STANDARD_1M',
              name: 'Midjourney Standard',
              categoryId: 2,
              categoryName: 'Design AI',
              categorySlug: 'design-ai',
              categoryIsActive: true,
              sellingPrice: 8500,
              sellingCurrency: 'PKR',
              isActive: false,
              createdAt: '2026-10-16T10:00:00Z',
              updatedAt: '2026-10-16T12:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminProductStatus(15, false);
      expect(result.isActive).toBe(false);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/products/15/status',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          body: JSON.stringify({ isActive: false }),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('mock-csrf-token-abc');
    });
  });
});
