import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAdminCategories,
  getAdminCategoryById,
  createAdminCategory,
  updateAdminCategory,
  updateAdminCategoryStatus,
  generateSlug,
  validateCategoryForm,
} from '../lib/categories-api';
import { clearCsrfToken, setInMemoryCsrfToken } from '../lib/api-client';

describe('Categories API and Validation', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Slug generation & validation', () => {
    it('generates lowercase hyphenated slug from category names', () => {
      expect(generateSlug('AI Tools & Software')).toBe('ai-tools-software');
      expect(generateSlug('   Cloud Services   ')).toBe('cloud-services');
      expect(generateSlug('Developer Utilities 2026!')).toBe('developer-utilities-2026');
      expect(generateSlug('Web---App---Design')).toBe('web-app-design');
    });

    it('validates required name and length', () => {
      expect(validateCategoryForm({ name: '', slug: 'valid-slug' }).errors.name).toBe(
        'Category name is required.',
      );
      expect(validateCategoryForm({ name: '   ', slug: 'valid-slug' }).errors.name).toBe(
        'Category name is required.',
      );
      expect(
        validateCategoryForm({ name: 'a'.repeat(201), slug: 'valid-slug' }).errors.name,
      ).toBe('Category name must be between 1 and 200 characters.');
    });

    it('validates required slug and regex format', () => {
      expect(validateCategoryForm({ name: 'Valid', slug: '' }).errors.slug).toBe(
        'Category slug is required.',
      );
      expect(validateCategoryForm({ name: 'Valid', slug: 'UPPERCASE' }).errors.slug).toContain(
        'lowercase alphanumeric words separated by hyphens',
      );
      expect(validateCategoryForm({ name: 'Valid', slug: 'spaces in slug' }).errors.slug).toContain(
        'lowercase alphanumeric words separated by hyphens',
      );
      expect(validateCategoryForm({ name: 'Valid', slug: 'invalid_underscore' }).errors.slug).toContain(
        'lowercase alphanumeric words separated by hyphens',
      );
      expect(validateCategoryForm({ name: 'Valid', slug: '-leading-hyphen' }).errors.slug).toContain(
        'lowercase alphanumeric words separated by hyphens',
      );
      expect(validateCategoryForm({ name: 'Valid', slug: 'trailing-hyphen-' }).errors.slug).toContain(
        'lowercase alphanumeric words separated by hyphens',
      );
      expect(validateCategoryForm({ name: 'Valid', slug: 'double--hyphen' }).errors.slug).toContain(
        'lowercase alphanumeric words separated by hyphens',
      );

      // Valid slugs
      expect(validateCategoryForm({ name: 'Valid', slug: 'ai-tools' }).isValid).toBe(true);
      expect(validateCategoryForm({ name: 'Valid', slug: 'ai' }).isValid).toBe(true);
      expect(validateCategoryForm({ name: 'Valid', slug: 'tools-v2-beta-1' }).isValid).toBe(true);
    });

    it('validates description maximum length', () => {
      expect(
        validateCategoryForm({
          name: 'Valid',
          slug: 'valid-slug',
          description: 'a'.repeat(2001),
        }).errors.description,
      ).toBe('Description cannot exceed 2000 characters.');

      expect(
        validateCategoryForm({
          name: 'Valid',
          slug: 'valid-slug',
          description: 'a'.repeat(2000),
        }).isValid,
      ).toBe(true);
    });
  });

  describe('API requests', () => {
    it('getAdminCategories fetches from /api/admin/categories with credentials', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'AI Tools',
          slug: 'ai-tools',
          description: 'Various AI utilities',
          isActive: true,
          productCount: 4,
          createdAt: '2026-10-14T10:00:00Z',
          updatedAt: '2026-10-14T12:00:00Z',
        },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Categories retrieved successfully.',
            data: mockCategories,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminCategories();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('AI Tools');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/categories',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('getAdminCategories passes isActive query parameter when specified', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Categories retrieved.',
            data: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await getAdminCategories(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/categories?isActive=true',
        expect.anything(),
      );
    });

    it('getAdminCategoryById retrieves a specific category by ID', async () => {
      const mockCategory = {
        id: 7,
        name: 'Cloud Hosting',
        slug: 'cloud-hosting',
        description: null,
        isActive: true,
        productCount: 0,
        createdAt: '2026-10-14T10:00:00Z',
        updatedAt: '2026-10-14T10:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Category retrieved successfully.',
            data: mockCategory,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await getAdminCategoryById(7);
      expect(result.id).toBe(7);
      expect(result.slug).toBe('cloud-hosting');

      expect(fetchSpy).toHaveBeenCalledWith('/api/admin/categories/7', expect.anything());
    });

    it('createAdminCategory sends POST with CSRF token and payload', async () => {
      setInMemoryCsrfToken('cached-csrf-token-123');

      const payload = {
        name: 'New Tools',
        slug: 'new-tools',
        description: 'Brand new tools',
        isActive: true,
      };

      const createdCategory = {
        id: 10,
        ...payload,
        productCount: 0,
        createdAt: '2026-10-15T00:00:00Z',
        updatedAt: '2026-10-15T00:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Category created successfully.',
            data: createdCategory,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await createAdminCategory(payload);
      expect(result.id).toBe(10);
      expect(result.slug).toBe('new-tools');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/categories',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.any(Headers),
          body: JSON.stringify(payload),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('cached-csrf-token-123');
    });

    it('updateAdminCategory sends PUT to /api/admin/categories/:id with CSRF token', async () => {
      setInMemoryCsrfToken('cached-csrf-token-123');

      const payload = {
        name: 'Renamed Tools',
        slug: 'renamed-tools',
        description: 'Updated desc',
        isActive: true,
      };

      const updatedCategory = {
        id: 5,
        ...payload,
        productCount: 2,
        createdAt: '2026-10-14T00:00:00Z',
        updatedAt: '2026-10-15T01:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Category updated successfully.',
            data: updatedCategory,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminCategory(5, payload);
      expect(result.name).toBe('Renamed Tools');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/categories/5',
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify(payload),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('cached-csrf-token-123');
    });

    it('updateAdminCategoryStatus sends PATCH to /api/admin/categories/:id/status', async () => {
      setInMemoryCsrfToken('cached-csrf-token-123');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Category status updated to inactive.',
            data: {
              id: 3,
              name: 'Design Assets',
              slug: 'design-assets',
              description: null,
              isActive: false,
              productCount: 8,
              createdAt: '2026-10-14T00:00:00Z',
              updatedAt: '2026-10-15T02:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await updateAdminCategoryStatus(3, false);
      expect(result.isActive).toBe(false);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/categories/3/status',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          body: JSON.stringify({ isActive: false }),
        }),
      );

      const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
      expect(headers.get('X-XSRF-TOKEN')).toBe('cached-csrf-token-123');
    });
  });
});
