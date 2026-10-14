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
});
