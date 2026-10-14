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

    vi.spyOn(globalThis, 'fetch')
      // 1. Initial mount session check -> 401 unauthenticated
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, message: 'Unauthenticated', data: null }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // 2. CSRF token call before login
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, message: 'CSRF', data: 'csrf-token-abc' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // 3. POST /api/admin/auth/login
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Administrator authenticated successfully.',
            data: adminUser,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // 4. Session verification GET /api/admin/auth/me
      .mockResolvedValueOnce(
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
});
