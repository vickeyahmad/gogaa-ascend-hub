import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  apiRequest,
  clearCsrfToken,
  getCsrfToken,
  type AdminUserDto,
  ApiClientError,
} from './api-client';
import { FullScreenLoader } from '@/components/gogaa/loaders';

export interface AuthContextType {
  user: AdminUserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AdminUserDto>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AdminUserDto | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUserDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Queries the backend session verification endpoint (GET /api/admin/auth/me).
   * Validates that the active session belongs to an administrator.
   * Customer cookies or unauthenticated requests are rejected by the server.
   */
  const refreshSession = useCallback(async (): Promise<AdminUserDto | null> => {
    if (isLoggingOut) {
      return null;
    }
    try {
      const response = await apiRequest<AdminUserDto>('/api/admin/auth/me', {
        method: 'GET',
        skipCsrf: true,
      });

      if (response.success && response.data) {
        const isAdmin = response.data.roles?.some(
          (role) => role.toLowerCase() === 'admin',
        );
        if (isAdmin) {
          setUser(response.data);
          setError(null);
          return response.data;
        }
      }
      setUser(null);
      return null;
    } catch (_err) {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoggingOut]);

  useEffect(() => {
    // Check active server session on initial mount
    void refreshSession();
  }, [refreshSession]);

  /**
   * Real administrator authentication using POST /api/admin/auth/login.
   * Obtains a CSRF token before operation, submits credentials with fetch credentials: 'include',
   * verifies administrator authorization, and stores session state in memory.
   */
  const login = useCallback(
    async (email: string, password: string, rememberMe = false): Promise<AdminUserDto> => {
      setError(null);
      try {
        // Pre-fetch Antiforgery token from the backend
        await getCsrfToken().catch(() => '');

        const loginResponse = await apiRequest<AdminUserDto>('/api/admin/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, rememberMe }),
        });

        if (!loginResponse.success || !loginResponse.data) {
          throw new ApiClientError(loginResponse.message || 'Login failed.');
        }

        // CRITICAL CSRF LIFECYCLE FIX:
        // Login established an authenticated session cookie (.WebAPI.Admin.Auth),
        // which alters the user's ClaimsPrincipal identity in ASP.NET Core.
        // The old anonymous antiforgery token is invalid for authenticated requests.
        // Invalidate the cached anonymous token and immediately obtain a fresh
        // token issued for the newly authenticated administrator identity.
        clearCsrfToken();
        await getCsrfToken(true).catch(() => '');

        // Verify with GET /api/admin/auth/me to ensure session cookie is active
        const verifiedUser = await refreshSession();
        if (!verifiedUser) {
          throw new ApiClientError(
            'Authentication succeeded but administrator privileges could not be confirmed.',
            403,
          );
        }

        setUser(verifiedUser);
        return verifiedUser;
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'An unexpected error occurred during sign in. Please try again.';
        setError(message);
        throw err;
      }
    },
    [refreshSession],
  );

  /**
   * Logs out the administrator by calling POST /api/admin/auth/logout.
   * Sends the required X-XSRF-TOKEN header and credentials: 'include'.
   * Shows the branded loader immediately, invalidates server session,
   * verifies invalidation via /me, and clears in-memory state.
   */
  const logout = useCallback(async (): Promise<void> => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setError(null);

    try {
      // 1. Post to backend logout endpoint
      await apiRequest('/api/admin/auth/logout', {
        method: 'POST',
      });

      // 2. Clear CSRF token cache
      clearCsrfToken();

      // 3. Verify server session invalidation via GET /api/admin/auth/me
      let stillAuthenticated = false;
      try {
        const verify = await apiRequest<AdminUserDto>('/api/admin/auth/me', {
          method: 'GET',
          skipCsrf: true,
        });
        if (verify.success && verify.data) {
          stillAuthenticated = true;
        }
      } catch {
        // Expected 401 Unauthorized: confirms session is destroyed on the server
        stillAuthenticated = false;
      }

      if (stillAuthenticated) {
        throw new ApiClientError(
          'Server session could not be invalidated. Please try signing out again.',
          500,
        );
      }

      // 4. Clear in-memory administrator state
      setUser(null);
      setIsLoading(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to sign out from administrator session. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isLoggingOut,
    error,
    login,
    logout,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {isLoggingOut && <FullScreenLoader message="Signing out of Control Center..." />}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Route protection component.
 * Displays the Digital Energy full-screen loader while session verification is active.
 * Redirects unauthenticated visitors to /login.
 * Only displays protected children when the server has authorized the administrator session.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isLoggingOut, refreshSession } = useAuth();
  const navigate = useNavigate();

  // Listen for browser Back/Forward (bfcache) navigation
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void refreshSession();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [refreshSession]);

  useEffect(() => {
    if (!isLoading && !isLoggingOut && !isAuthenticated) {
      void navigate({ to: '/login' });
    }
  }, [isLoading, isLoggingOut, isAuthenticated, navigate]);

  if (isLoggingOut) {
    return <FullScreenLoader message="Signing out of Control Center..." />;
  }

  if (isLoading || !isAuthenticated) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
