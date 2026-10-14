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
 * Endpoints that must NEVER be automatically retried, even on suspected CSRF errors.
 * Financial mutations, deposits, payments, payment approvals, order creation,
 * checkout, and vendor submissions must never be blindly replayed to prevent double-charging or duplicate actions.
 */
export const NON_RETRYABLE_MUTATION_PATTERNS: readonly RegExp[] = [
  /\/wallet/i,
  /\/payment/i,
  /\/deposit/i,
  /\/order/i,
  /\/vendor/i,
  /\/approval/i,
  /\/checkout/i,
];

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

  // Handle distinguishing CSRF failure (HTTP 400 with explicit antiforgery error or empty body on parameterless logout)
  // Only retry once if CSRF token expired or identity changed, and it is strictly safe to do so.
  if (response.status === 400 && shouldAttachCsrf) {
    const isNonRetryable = NON_RETRYABLE_MUTATION_PATTERNS.some((pattern) =>
      pattern.test(endpoint),
    );

    // Never replay financial or sensitive mutations under any circumstances
    if (!isNonRetryable) {
      const clone = response.clone();
      let bodyText = '';
      let isJson = false;
      let hasValidationErrors = false;
      let isExplicitCsrfError = false;

      try {
        bodyText = await clone.text();
        const parsed = JSON.parse(bodyText);
        isJson = true;
        if (parsed && typeof parsed === 'object') {
          // Check for structured validation errors (e.g. from ASP.NET Core FluentValidation or ModelState)
          const hasErrorsProperty = !!(
            parsed.errors &&
            typeof parsed.errors === 'object' &&
            Object.keys(parsed.errors).length > 0
          );

          const messageStr =
            typeof parsed.message === 'string' ? parsed.message.toLowerCase() : '';
          const titleStr =
            typeof parsed.title === 'string' ? parsed.title.toLowerCase() : '';

          const containsCsrfKeyword =
            messageStr.includes('antiforgery') ||
            messageStr.includes('xsrf') ||
            messageStr.includes('csrf') ||
            titleStr.includes('antiforgery') ||
            titleStr.includes('xsrf') ||
            titleStr.includes('csrf');

          if (hasErrorsProperty) {
            hasValidationErrors = true;
          } else if (containsCsrfKeyword) {
            isExplicitCsrfError = true;
          } else if (parsed.message || parsed.title) {
            // General business or validation error message
            hasValidationErrors = true;
          }
        }
      } catch {
        isJson = false;
        const lower = bodyText.toLowerCase();
        if (
          lower.includes('antiforgery') ||
          lower.includes('xsrf') ||
          lower.includes('csrf')
        ) {
          isExplicitCsrfError = true;
        }
      }

      // In ASP.NET Core, AutoValidateAntiforgeryTokenAttribute returns an empty 400 Bad Request
      const isEmptyBadRequest = !bodyText || bodyText.trim().length === 0;

      // Admin Logout endpoint: parameterless, idempotent endpoint that safely rejects on stale CSRF
      const isLogoutEndpoint = endpoint.includes('/api/admin/auth/logout');

      // STRICT RETRY SAFETY POLICY:
      // 1. Admin Logout allows retry on empty 400 (ASP.NET Core antiforgery rejection) or explicit CSRF failure.
      // 2. Arbitrary endpoints DO NOT retry merely on empty 400.
      // 3. Safe non-financial endpoints ONLY retry if CSRF failure is unambiguously identified by server response text.
      // 4. Model validation errors and ordinary 400 errors NEVER trigger retry.
      const canRetry =
        !hasValidationErrors &&
        ((isLogoutEndpoint && (isEmptyBadRequest || isExplicitCsrfError)) ||
          (!isLogoutEndpoint && isExplicitCsrfError));

      if (canRetry) {
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
