import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth, ProtectedRoute } from '../lib/auth-context';
import { clearCsrfToken } from '../lib/api-client';

// Mock TanStack navigate
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function TestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="loading-state">{isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <button
        onClick={() => void login('admin@gogaabyte.com', 'AdminPass123!')}
        data-testid="login-btn"
      >
        Login
      </button>
      <button onClick={() => void logout()} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
}

describe('Auth Context and ProtectedRoute Integration', () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes by checking session; sets unauthenticated when server returns 401', async () => {
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

    const utils = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(utils.getByTestId('loading-state').textContent).toBe('loading');

    await waitFor(() => {
      expect(utils.getByTestId('loading-state').textContent).toBe('idle');
    });

    expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
    expect(utils.getByTestId('user-email').textContent).toBe('none');
  });

  it('restores valid session when server confirms active administrator', async () => {
    const adminUser = {
      id: 'admin-id-123',
      email: 'verified_admin@gogaabyte.com',
      fullName: 'System Administrator',
      roles: ['Admin'],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Current administrator profile retrieved.',
          data: adminUser,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const utils = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(utils.getByTestId('loading-state').textContent).toBe('idle');
    });

    expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    expect(utils.getByTestId('user-email').textContent).toBe('verified_admin@gogaabyte.com');
  });

  it('rejects customer session: customers cannot authenticate as admin', async () => {
    const customerUser = {
      id: 'cust-id-456',
      email: 'customer@example.com',
      fullName: 'Customer User',
      roles: ['Customer'], // Missing Admin role!
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Profile retrieved.',
          data: customerUser,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const utils = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(utils.getByTestId('loading-state').textContent).toBe('idle');
    });

    // Customer is NOT authenticated in admin portal!
    expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
    expect(utils.getByTestId('user-email').textContent).toBe('none');
  });

  it('login flow: authenticates, verifies session, and sets state', async () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@gogaabyte.com',
      fullName: 'Super Admin',
      roles: ['Admin'],
    };

    let isUserAuthenticated = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        if (!isUserAuthenticated) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: false, message: 'Unauthenticated', data: null }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Current administrator profile retrieved.',
              data: adminUser,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'CSRF',
              data: isUserAuthenticated ? 'auth-csrf-token' : 'anon-csrf-token',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/login') && method === 'POST') {
        isUserAuthenticated = true;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              message: 'Administrator authenticated successfully.',
              data: adminUser,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
      );
    });

    const utils = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      utils.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    });

    expect(utils.getByTestId('user-email').textContent).toBe('admin@gogaabyte.com');
  });

  it('logout flow: calls backend logout endpoint, clears state, and clears CSRF', async () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@gogaabyte.com',
      fullName: 'Super Admin',
      roles: ['Admin'],
    };

    vi.spyOn(globalThis, 'fetch')
      // 1. Initial mount session check -> authenticated
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, message: 'Profile', data: adminUser }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // 2. CSRF token for logout
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, message: 'CSRF', data: 'csrf-token-xyz' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // 3. POST /api/admin/auth/logout
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Administrator logged out successfully.',
            data: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const utils = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    });

    await act(async () => {
      utils.getByTestId('logout-btn').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
    });

    expect(utils.getByTestId('user-email').textContent).toBe('none');
  });

  it('ProtectedRoute displays full-screen loader while verifying session and blocks protected content', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {})); // Never resolves (stays loading)

    const utils = render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Dashboard Data</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    // Protected content is NOT visible
    expect(utils.queryByTestId('protected-content')).toBeNull();
    // Loader is present
    expect(utils.container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('ProtectedRoute redirects unauthenticated visitors to /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, message: 'Unauthenticated', data: null }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const utils = render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret Dashboard Data</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });

    // Content was never revealed
    expect(utils.queryByTestId('protected-content')).toBeNull();
  });

  it('displays "Signing out of Control Center..." loader and prevents duplicate logout clicks during logout transition', async () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@gogaabyte.com',
      fullName: 'Super Admin',
      roles: ['Admin'],
    };

    let hasLoggedOut = false;
    let resolveLogout: (res: any) => void = () => {};
    const logoutPromise = new Promise((resolve) => {
      resolveLogout = resolve;
    });

    let logoutCallCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        if (!hasLoggedOut) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, message: 'Profile', data: adminUser }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: false, message: 'Unauthenticated', data: null }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, message: 'CSRF', data: 'token-123' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        logoutCallCount++;
        hasLoggedOut = true;
        return logoutPromise.then(() =>
          new Response(
            JSON.stringify({ success: true, message: 'Logged out', data: null }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
      );
    });

    function LogoutTestComponent() {
      const { logout, isLoggingOut } = useAuth();
      return (
        <div>
          <button data-testid="do-logout" onClick={() => void logout()}>
            Sign Out
          </button>
          <div data-testid="is-logging-out">{isLoggingOut ? 'true' : 'false'}</div>
        </div>
      );
    }

    const utils = render(
      <AuthProvider>
        <LogoutTestComponent />
      </AuthProvider>,
    );

    // Initial state
    expect(utils.getByTestId('is-logging-out').textContent).toBe('false');

    // Trigger logout
    await act(async () => {
      utils.getByTestId('do-logout').click();
    });

    // isLoggingOut is true and loader is active
    expect(utils.getByTestId('is-logging-out').textContent).toBe('true');
    expect(document.body.textContent).toContain('Signing out of Control Center...');

    // Attempt second logout click while in-flight
    await act(async () => {
      utils.getByTestId('do-logout').click();
    });

    // Only one logout call was made (prevented duplicate click)
    expect(logoutCallCount).toBe(1);

    // Resolve logout
    await act(async () => {
      resolveLogout(null);
    });

    await waitFor(() => {
      expect(utils.getByTestId('is-logging-out').textContent).toBe('false');
    });
  });

  it('refuses to claim logout if backend logout endpoint fails and retains session', async () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@gogaabyte.com',
      fullName: 'Super Admin',
      roles: ['Admin'],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, message: 'Profile', data: adminUser }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, message: 'CSRF', data: 'token-123' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: false, message: 'Logout service unavailable', data: null }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
      );
    });

    let caughtError: any = null;
    function LogoutFailComponent() {
      const { logout, user } = useAuth();
      return (
        <div>
          <button
            data-testid="fail-logout"
            onClick={async () => {
              try {
                await logout();
              } catch (e) {
                caughtError = e;
              }
            }}
          >
            Sign Out
          </button>
          <div data-testid="user-presence">{user ? 'has-user' : 'no-user'}</div>
        </div>
      );
    }

    const utils = render(
      <AuthProvider>
        <LogoutFailComponent />
      </AuthProvider>,
    );

    await act(async () => {
      utils.getByTestId('fail-logout').click();
    });

    await waitFor(() => {
      expect(caughtError).not.toBeNull();
    });

    // Session was NOT cleared because backend failed
    expect(utils.getByTestId('user-presence').textContent).toBe('has-user');
  });

  it('verifies server session invalidation via /me after logout and throws if server session remains active', async () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@gogaabyte.com',
      fullName: 'Super Admin',
      roles: ['Admin'],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      // Both initial check AND post-logout /me check return 200 (server failed to clear cookie)
      if (url.includes('/api/admin/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, message: 'Profile', data: adminUser }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, message: 'CSRF', data: 'token-123' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, message: 'Server acknowledged', data: null }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ success: false, data: null }), { status: 404 }),
      );
    });

    let logoutErr: any = null;
    function LogoutStubbornSession() {
      const { logout } = useAuth();
      return (
        <button
          data-testid="test-logout"
          onClick={async () => {
            try {
              await logout();
            } catch (e) {
              logoutErr = e;
            }
          }}
        >
          Sign Out
        </button>
      );
    }

    const utils = render(
      <AuthProvider>
        <LogoutStubbornSession />
      </AuthProvider>,
    );

    await act(async () => {
      utils.getByTestId('test-logout').click();
    });

    await waitFor(() => {
      expect(logoutErr).not.toBeNull();
      expect(logoutErr.message).toContain('Server session could not be invalidated');
    });
  });

  it('ProtectedRoute handles bfcache (pageshow with persisted=true) by triggering session re-verification', async () => {
    let meCallCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/auth/me')) {
        meCallCount++;
        if (meCallCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message: 'Admin',
                data: { id: '1', email: 'admin@gogaabyte.com', roles: ['Admin'] },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        // Second call (from bfcache restore after logout in another tab) -> 401
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: false, message: 'Session expired', data: null }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const utils = render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="secret-area">Top Secret</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(utils.getByTestId('secret-area')).toBeInTheDocument();
    });
    expect(meCallCount).toBe(1);

    // Simulate browser Back navigation restoring page from bfcache
    await act(async () => {
      const event = new Event('pageshow') as any;
      event.persisted = true;
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(meCallCount).toBe(2);
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });
  });
});
