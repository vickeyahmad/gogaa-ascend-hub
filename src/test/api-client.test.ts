import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiRequest,
  getCsrfToken,
  clearCsrfToken,
  getInMemoryCsrfToken,
  setInMemoryCsrfToken,
  ApiClientError,
  buildApiUrl,
} from '../lib/api-client';

describe('API Client', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildApiUrl handles relative and configured base URLs', () => {
    const url = buildApiUrl('/api/admin/auth/me');
    expect(url).toContain('/api/admin/auth/me');
  });

  it('retrieves and caches CSRF token in memory, never in localStorage', async () => {
    const mockToken = 'mock-csrf-token-12345';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Antiforgery token generated.',
          data: mockToken,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const token = await getCsrfToken();
    expect(token).toBe(mockToken);
    expect(getInMemoryCsrfToken()).toBe(mockToken);
    if (typeof localStorage !== 'undefined') expect(localStorage.getItem('token')).toBeNull();
    if (typeof sessionStorage !== 'undefined') expect(sessionStorage.getItem('token')).toBeNull();

    // Calling again returns cached token without calling fetch again
    const secondToken = await getCsrfToken();
    expect(secondToken).toBe(mockToken);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('attaches X-XSRF-TOKEN and credentials: include on mutating POST requests', async () => {
    setInMemoryCsrfToken('active-csrf-token');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Success',
          data: { id: 'admin-1', email: 'admin@gogaabyte.com' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await apiRequest('/api/admin/auth/logout', {
      method: 'POST',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    expect(options?.credentials).toBe('include');

    const headers = options?.headers as Headers;
    expect(headers.get('X-XSRF-TOKEN')).toBe('active-csrf-token');
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('handles 401 Unauthenticated correctly with user-friendly error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthenticated administrator session.',
          data: null,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(apiRequest('/api/admin/auth/me')).rejects.toThrow(
      'Unauthenticated administrator session.',
    );
  });

  it('handles 403 Access Denied correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: 'Access denied.',
          data: null,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(apiRequest('/api/admin/auth/me')).rejects.toThrow('Access denied.');
  });

  it('handles 423 Locked account correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: 'Account is locked out.',
          data: null,
        }),
        { status: 423, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      apiRequest('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com', password: 'bad' }),
        skipCsrf: true,
      }),
    ).rejects.toThrow('Account is locked out.');
  });

  it('distinguishes CSRF token expiry (400) and refreshes token once safely', async () => {
    setInMemoryCsrfToken('stale-token');

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // 1. Initial POST fails with antiforgery error
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Antiforgery token validation failed.',
            data: null,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // 2. Fetch fresh CSRF token
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Antiforgery token generated.',
            data: 'fresh-csrf-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // 3. Retry of POST succeeds
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Logout successful.',
            data: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const result = await apiRequest('/api/admin/auth/logout', {
      method: 'POST',
    });

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(getInMemoryCsrfToken()).toBe('fresh-csrf-token');
  });

  it('does NOT retry non-CSRF 400 validation errors', async () => {
    setInMemoryCsrfToken('valid-token');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: 'Password is required.',
          data: null,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      apiRequest('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com' }),
        skipCsrf: true,
      }),
    ).rejects.toThrow('Password is required.');

    // Only 1 attempt made, no infinite or unsafe retry
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces useful error message when server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiRequest('/api/admin/auth/me')).rejects.toThrow(
      /Unable to connect to the Gogaa Byte server/,
    );
  });

  describe('CSRF Retry Safety Policy', () => {
    it('safely retries empty 400 on admin logout endpoint with fresh CSRF token', async () => {
      setInMemoryCsrfToken('stale-token');

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        // 1. Initial logout request fails with empty 400 (ASP.NET Core antiforgery rejection)
        .mockResolvedValueOnce(new Response('', { status: 400 }))
        // 2. Refresh CSRF token
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Antiforgery token generated.',
              data: 'fresh-logout-token',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        // 3. Retry of logout succeeds
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Logout successful.',
              data: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const result = await apiRequest('/api/admin/auth/logout', {
        method: 'POST',
      });

      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(getInMemoryCsrfToken()).toBe('fresh-logout-token');
    });

    it('does NOT retry empty 400 on arbitrary mutation endpoints', async () => {
      setInMemoryCsrfToken('some-token');

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 400 }));

      await expect(
        apiRequest('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name: 'Accessories' }),
        }),
      ).rejects.toThrow();

      // Only 1 attempt made: arbitrary empty 400 is never retried
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry empty 400 on DELETE requests', async () => {
      setInMemoryCsrfToken('some-token');

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 400 }));

      await expect(
        apiRequest('/api/admin/categories/cat-123', {
          method: 'DELETE',
        }),
      ).rejects.toThrow();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('safely retries non-financial endpoints when server explicitly returns an antiforgery error', async () => {
      setInMemoryCsrfToken('stale-token');

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        // 1. Initial POST returns explicit CSRF error
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              message: 'Antiforgery token validation failed.',
              data: null,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        // 2. Fetch fresh token
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Antiforgery token generated.',
              data: 'refreshed-category-token',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        // 3. Retry succeeds
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Category created.',
              data: { id: 'cat-new', name: 'Electronics' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const result = await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: 'Electronics' }),
      });

      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(getInMemoryCsrfToken()).toBe('refreshed-category-token');
    });

    it('never retries financial wallet operations even on explicit CSRF error', async () => {
      setInMemoryCsrfToken('valid-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Antiforgery token mismatch.',
            data: null,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        apiRequest('/api/wallet/transfer', {
          method: 'POST',
          body: JSON.stringify({ amount: 1500, recipient: 'user-2' }),
        }),
      ).rejects.toThrow('Antiforgery token mismatch.');

      // Strictly 1 call made, never replayed
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('never retries deposit operations even on empty 400', async () => {
      setInMemoryCsrfToken('valid-token');

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 400 }));

      await expect(
        apiRequest('/api/admin/deposits/confirm', {
          method: 'POST',
          body: JSON.stringify({ depositId: 'dep-101' }),
        }),
      ).rejects.toThrow();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('never retries payment approval operations even on explicit CSRF error', async () => {
      setInMemoryCsrfToken('valid-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Antiforgery verification failed',
            data: null,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        apiRequest('/api/admin/payments/pay-789/approval', {
          method: 'POST',
          body: JSON.stringify({ approved: true }),
        }),
      ).rejects.toThrow('Antiforgery verification failed');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('never retries order creation or checkout mutations', async () => {
      setInMemoryCsrfToken('valid-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'CSRF token is expired',
            data: null,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        apiRequest('/api/orders/create', {
          method: 'POST',
          body: JSON.stringify({ items: [{ id: 1, quantity: 2 }] }),
        }),
      ).rejects.toThrow('CSRF token is expired');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('never retries vendor submissions even on explicit CSRF error', async () => {
      setInMemoryCsrfToken('valid-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Antiforgery cookie missing.',
            data: null,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        apiRequest('/api/vendor/register', {
          method: 'POST',
          body: JSON.stringify({ businessName: 'Acme Corp' }),
        }),
      ).rejects.toThrow('Antiforgery cookie missing.');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry structured model validation errors even if a field is named csrfToken', async () => {
      setInMemoryCsrfToken('valid-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
            title: 'One or more validation errors occurred.',
            status: 400,
            errors: {
              csrfToken: ['The csrfToken field is required.'],
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        apiRequest('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name: '' }),
        }),
      ).rejects.toThrow();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry ordinary 400 business errors with generic messages', async () => {
      setInMemoryCsrfToken('valid-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Category with this slug already exists in the system.',
            data: null,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        apiRequest('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name: 'Phones', slug: 'phones' }),
        }),
      ).rejects.toThrow('Category with this slug already exists in the system.');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
