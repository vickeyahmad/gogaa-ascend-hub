import { apiConfig } from './brand';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface AdminUserDto {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
}

export class ApiClientError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status = 0, data: unknown = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }
}

// In-memory CSRF token cache. Never stored in localStorage or sessionStorage.
let inMemoryCsrfToken: string | null = null;

export function clearCsrfToken(): void {
  inMemoryCsrfToken = null;
}

export function setInMemoryCsrfToken(token: string | null): void {
  inMemoryCsrfToken = token;
}

export function getInMemoryCsrfToken(): string | null {
  return inMemoryCsrfToken;
}

/**
 * Builds the full URL for an API endpoint using the configured base URL.
 * If baseUrl is empty, returns relative path (uses same-origin dev proxy).
 */
export function buildApiUrl(endpoint: string): string {
  const base = apiConfig.baseUrl;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${path}` : path;
}

/**
 * Retrieves a fresh Antiforgery / CSRF request token from the backend.
 * The backend sets the HttpOnly companion cookie (.WebAPI.Antiforgery)
 * and returns the request token in the JSON body.
 */
export async function getCsrfToken(forceFresh = false): Promise<string> {
  if (!forceFresh && inMemoryCsrfToken) {
    return inMemoryCsrfToken;
  }

  try {
    const url = buildApiUrl('/api/admin/auth/csrf');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new ApiClientError('Failed to acquire CSRF security token.', response.status);
    }

    const payload = (await response.json()) as ApiResponse<string>;
    if (payload.success && payload.data) {
      inMemoryCsrfToken = payload.data;
      return payload.data;
    }

    throw new ApiClientError(payload.message || 'Invalid CSRF response format.', response.status);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(
      'Unable to connect to the authentication service. Please ensure the backend is running.',
      0,
    );
  }
}

interface RequestOptions extends RequestInit {
  requiresCsrf?: boolean;
  skipCsrf?: boolean;
}

/**
 * Core API fetch wrapper that enforces credentials: 'include',
 * attaches the CSRF token on mutating requests, and normalizes error responses.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const shouldAttachCsrf = (isMutating || options.requiresCsrf) && !options.skipCsrf;

  if (shouldAttachCsrf) {
    const token = await getCsrfToken();
    headers.set('X-XSRF-TOKEN', token);
  }

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = buildApiUrl(endpoint);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'include',
    });
  } catch (_err) {
    throw new ApiClientError(
      'Unable to connect to the Gogaa Byte server. Please check your network connection or verify that the backend is running.',
      0,
    );
  }

  // Handle distinguishing CSRF failure (HTTP 400 with antiforgery error)
  // Only retry once if CSRF token expired and it is safe to do so
  if (response.status === 400 && shouldAttachCsrf) {
    const clone = response.clone();
    let bodyText = '';
    try {
      bodyText = await clone.text();
    } catch {
      // ignore
    }

    const isCsrfError =
      bodyText.toLowerCase().includes('antiforgery') ||
      bodyText.toLowerCase().includes('xsrf') ||
      bodyText.toLowerCase().includes('csrf');

    if (isCsrfError) {
      clearCsrfToken();
      const freshToken = await getCsrfToken(true);
      headers.set('X-XSRF-TOKEN', freshToken);

      try {
        response = await fetch(url, {
          ...options,
          method,
          headers,
          credentials: 'include',
        });
      } catch (_retryErr) {
        throw new ApiClientError(
          'Unable to reach the Gogaa Byte server during request retry.',
          0,
        );
      }
    }
  }

  // Parse JSON response body
  let data: ApiResponse<T> | null = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = (await response.json()) as ApiResponse<T>;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const defaultMessage = getStatusDefaultMessage(response.status);
    const message = data?.message || defaultMessage;
    throw new ApiClientError(message, response.status, data?.data);
  }

  if (!data) {
    return {
      success: true,
      message: 'Operation completed successfully.',
      data: null,
    };
  }

  return data;
}

function getStatusDefaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'The request could not be processed due to invalid parameters.';
    case 401:
      return 'Your administrator session is unauthenticated or has expired. Please sign in again.';
    case 403:
      return 'Access denied. You do not have administrator permissions for this operation.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A conflict occurred while processing your request.';
    case 423:
      return 'Your account is temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.';
    case 429:
      return 'Too many requests were sent in a short period. Please slow down and try again.';
    case 500:
      return 'An internal server error occurred. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'The authentication service is currently unavailable. Please check backend status.';
    default:
      return `Request failed with HTTP status ${status}.`;
  }
}
