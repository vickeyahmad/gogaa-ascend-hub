import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth, ProtectedRoute } from '../lib/auth-context';
import { CategoriesManagementView } from '../routes/categories';
import { AppShell } from '../components/gogaa/app-shell';
import {
  clearCsrfToken,
  getInMemoryCsrfToken,
  setInMemoryCsrfToken,
  getCsrfToken,
  apiRequest,
} from '../lib/api-client';
import { createAdminCategory } from '../lib/categories-api';

// Mock TanStack Router
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  createFileRoute: () => () => ({
    component: () => null,
  }),
}));

const mockAdminUser = {
  id: 'admin-001',
  email: 'admin@gogaabyte.com',
  fullName: 'Gogaa Admin',
  roles: ['Admin'],
};

const sampleCategories = [
  {
    id: 1,
    name: 'AI Tools',
    slug: 'ai-tools',
    description: 'AI Tools description',
    isActive: true,
    productCount: 4,
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
  },
];

function jsonRes(payload: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('Intermittent Sign Out & CSRF Lifecycle Regression (Scenarios A–H)', () => {
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

  /**
   * Helper component simulating navigation between Dashboard, Categories, and triggering Sign Out.
   */
  function NavigationTestHarness({ initialPage = 'Dashboard' }: { initialPage?: string }) {
    const { user, login, logout, isLoggingOut, isAuthenticated } = useAuth();
    const [currentPage, setCurrentPage] = React.useState(initialPage);

    return (
      <div>
        <div data-testid="auth-state">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
        <div data-testid="current-page">{currentPage}</div>
        <div data-testid="is-logging-out">{isLoggingOut ? 'true' : 'false'}</div>
        <div data-testid="user-email">{user?.email || 'none'}</div>

        {/* Auth triggers */}
        <button
          data-testid="login-trigger"
          onClick={() => void login('admin@gogaabyte.com', 'AdminPass123!')}
        >
          Sign In
        </button>

        <button data-testid="logout-trigger" onClick={() => void logout()}>
          Sign Out
        </button>

        {/* Navigation triggers */}
        <button data-testid="nav-dashboard" onClick={() => setCurrentPage('Dashboard')}>
          Go to Dashboard
        </button>
        <button data-testid="nav-categories" onClick={() => setCurrentPage('Categories')}>
          Go to Categories
        </button>

        {/* Page Content */}
        {isAuthenticated && currentPage === 'Categories' && (
          <div data-testid="categories-view-container">
            <CategoriesManagementView />
          </div>
        )}
        {isAuthenticated && currentPage === 'Dashboard' && (
          <AppShell pageTitle="Dashboard" activeItem="Dashboard">
            <div data-testid="dashboard-content">Dashboard Metrics View</div>
          </AppShell>
        )}
      </div>
    );
  }

  // ── SCENARIO A ─────────────────────────────────────────────────────────────
  it('Scenario A: Login → Categories → Sign Out → Login page → /me returns 401 without browser refresh', async () => {
    let serverAuthenticated = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      // Session verification
      if (url.includes('/api/admin/auth/me')) {
        if (!serverAuthenticated) {
          return jsonRes({ success: false, message: 'Unauthenticated', data: null }, 401);
        }
        return jsonRes({ success: true, message: 'Admin verified', data: mockAdminUser });
      }

      // CSRF endpoint
      if (url.includes('/api/admin/auth/csrf')) {
        const token = serverAuthenticated ? 'auth-csrf-token-AAA' : 'anon-csrf-token-AAA';
        return jsonRes({ success: true, message: 'CSRF token', data: token });
      }

      // Login
      if (url.includes('/api/admin/auth/login') && method === 'POST') {
        serverAuthenticated = true;
        return jsonRes({ success: true, message: 'Login ok', data: mockAdminUser });
      }

      // Categories
      if (url.includes('/api/admin/categories') && method === 'GET') {
        return jsonRes({ success: true, message: 'Categories', data: sampleCategories });
      }

      // Logout: requires authenticated CSRF token
      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        const xsrfHeader = init?.headers?.['X-XSRF-TOKEN'] || init?.headers?.get?.('X-XSRF-TOKEN');
        if (xsrfHeader === 'anon-csrf-token-AAA') {
          // Reject anonymous token on authenticated endpoint (ASP.NET Core behavior: empty 400 Bad Request)
          return Promise.resolve(new Response('', { status: 400 }));
        }
        if (xsrfHeader === 'auth-csrf-token-AAA') {
          serverAuthenticated = false;
          return jsonRes({ success: true, message: 'Logged out successfully', data: null });
        }
        return Promise.resolve(new Response('', { status: 400 }));
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const utils = render(
      <AuthProvider>
        <NavigationTestHarness />
      </AuthProvider>,
    );

    // 1. Initially unauthenticated
    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
    });

    // 2. Perform Login
    await act(async () => {
      utils.getByTestId('login-trigger').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    });

    // Verify authenticated CSRF token is in memory (not the anonymous one!)
    expect(getInMemoryCsrfToken()).toBe('auth-csrf-token-AAA');

    // 3. Navigate to Categories (client-side transition without browser refresh)
    await act(async () => {
      utils.getByTestId('nav-categories').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('current-page').textContent).toBe('Categories');
      expect(utils.getAllByText('AI Tools').length).toBeGreaterThan(0);
    });

    // 4. Administrator clicks Sign Out
    await act(async () => {
      utils.getByTestId('logout-trigger').click();
    });

    // 5. Logout completes successfully without requiring browser refresh
    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
      expect(utils.getByTestId('is-logging-out').textContent).toBe('false');
    });

    expect(serverAuthenticated).toBe(false);
  });

  // ── SCENARIO B ─────────────────────────────────────────────────────────────
  it('Scenario B: Login → Dashboard → Categories → Dashboard → Sign Out without refreshing', async () => {
    let serverAuthenticated = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        if (!serverAuthenticated) {
          return jsonRes({ success: false, message: 'Unauthenticated', data: null }, 401);
        }
        return jsonRes({ success: true, message: 'Admin verified', data: mockAdminUser });
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return jsonRes({
          success: true,
          message: 'CSRF',
          data: serverAuthenticated ? 'auth-token-BBB' : 'anon-token-BBB',
        });
      }

      if (url.includes('/api/admin/auth/login') && method === 'POST') {
        serverAuthenticated = true;
        return jsonRes({ success: true, message: 'Login ok', data: mockAdminUser });
      }

      if (url.includes('/api/admin/categories') && method === 'GET') {
        return jsonRes({ success: true, message: 'Categories', data: sampleCategories });
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        serverAuthenticated = false;
        return jsonRes({ success: true, message: 'Logged out successfully', data: null });
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const utils = render(
      <AuthProvider>
        <NavigationTestHarness />
      </AuthProvider>,
    );

    // Login
    await act(async () => {
      utils.getByTestId('login-trigger').click();
    });
    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    });

    // Navigate Dashboard -> Categories
    await act(async () => {
      utils.getByTestId('nav-categories').click();
    });
    await waitFor(() => {
      expect(utils.getByTestId('current-page').textContent).toBe('Categories');
    });

    // Navigate Categories -> Dashboard
    await act(async () => {
      utils.getByTestId('nav-dashboard').click();
    });
    await waitFor(() => {
      expect(utils.getByTestId('current-page').textContent).toBe('Dashboard');
    });

    // Sign out from Dashboard without refreshing
    await act(async () => {
      utils.getByTestId('logout-trigger').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
    });
    expect(serverAuthenticated).toBe(false);
  });

  // ── SCENARIO C ─────────────────────────────────────────────────────────────
  it('Scenario C: Login → Sign Out immediately without refreshing', async () => {
    let serverAuthenticated = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        if (!serverAuthenticated) {
          return jsonRes({ success: false, message: 'Unauthenticated', data: null }, 401);
        }
        return jsonRes({ success: true, message: 'Admin verified', data: mockAdminUser });
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return jsonRes({
          success: true,
          message: 'CSRF',
          data: serverAuthenticated ? 'auth-token-CCC' : 'anon-token-CCC',
        });
      }

      if (url.includes('/api/admin/auth/login') && method === 'POST') {
        serverAuthenticated = true;
        return jsonRes({ success: true, message: 'Login ok', data: mockAdminUser });
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        serverAuthenticated = false;
        return jsonRes({ success: true, message: 'Logged out successfully', data: null });
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const utils = render(
      <AuthProvider>
        <NavigationTestHarness />
      </AuthProvider>,
    );

    // Login
    await act(async () => {
      utils.getByTestId('login-trigger').click();
    });
    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    });

    // Immediate Sign Out
    await act(async () => {
      utils.getByTestId('logout-trigger').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
    });
  });

  // ── SCENARIO D ─────────────────────────────────────────────────────────────
  it('Scenario D: Login → Refresh → Sign Out', async () => {
    let serverAuthenticated = true; // Simulating existing session cookie after browser refresh

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        if (!serverAuthenticated) {
          return jsonRes({ success: false, message: 'Unauthenticated', data: null }, 401);
        }
        return jsonRes({ success: true, message: 'Admin verified', data: mockAdminUser });
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return jsonRes({ success: true, message: 'CSRF', data: 'auth-token-after-refresh' });
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        serverAuthenticated = false;
        return jsonRes({ success: true, message: 'Logged out successfully', data: null });
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    // In-memory token is cleared by browser refresh
    clearCsrfToken();
    expect(getInMemoryCsrfToken()).toBeNull();

    const utils = render(
      <AuthProvider>
        <NavigationTestHarness />
      </AuthProvider>,
    );

    // Initial mount restores session
    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    });

    // Trigger Sign Out
    await act(async () => {
      utils.getByTestId('logout-trigger').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('unauthenticated');
    });
    expect(serverAuthenticated).toBe(false);
  });

  // ── SCENARIO E ─────────────────────────────────────────────────────────────
  it('Scenario E: Anonymous CSRF token obtained → Login changes authentication identity → Subsequent mutation uses valid authenticated token', async () => {
    let serverAuthenticated = false;
    let lastUsedCsrfHeader: string | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        if (!serverAuthenticated) {
          return jsonRes({ success: false, message: 'Unauthenticated', data: null }, 401);
        }
        return jsonRes({ success: true, message: 'Admin verified', data: mockAdminUser });
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return jsonRes({
          success: true,
          message: 'CSRF',
          data: serverAuthenticated ? 'auth-csrf-token-EEE' : 'anon-csrf-token-EEE',
        });
      }

      if (url.includes('/api/admin/auth/login') && method === 'POST') {
        serverAuthenticated = true;
        return jsonRes({ success: true, message: 'Login ok', data: mockAdminUser });
      }

      // Mutating Category creation endpoint
      if (url.includes('/api/admin/categories') && method === 'POST') {
        lastUsedCsrfHeader = init?.headers?.['X-XSRF-TOKEN'] || init?.headers?.get?.('X-XSRF-TOKEN');
        return jsonRes(
          {
            success: true,
            data: { id: 99, name: 'New Cat', slug: 'new-cat', isActive: true, productCount: 0 },
          },
          201,
        );
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    // 1. Anonymous visitor gets anonymous CSRF token
    const anonToken = await getCsrfToken();
    expect(anonToken).toBe('anon-csrf-token-EEE');
    expect(getInMemoryCsrfToken()).toBe('anon-csrf-token-EEE');

    const utils = render(
      <AuthProvider>
        <NavigationTestHarness />
      </AuthProvider>,
    );

    // 2. Login changes identity to Admin
    await act(async () => {
      utils.getByTestId('login-trigger').click();
    });

    await waitFor(() => {
      expect(utils.getByTestId('auth-state').textContent).toBe('authenticated');
    });

    // Token must be updated to authenticated token!
    expect(getInMemoryCsrfToken()).toBe('auth-csrf-token-EEE');

    // 3. Make a subsequent mutation (create category)
    await createAdminCategory({ name: 'New Cat', slug: 'new-cat' });

    // The mutation must have used the authenticated token, NEVER the anonymous token!
    expect(lastUsedCsrfHeader).toBe('auth-csrf-token-EEE');
  });

  // ── SCENARIO F ─────────────────────────────────────────────────────────────
  it('Scenario F: Logout encounters empty 400 Bad Request (ASP.NET Core antiforgery failure) → Auto-retries with fresh token successfully', async () => {
    let attemptCount = 0;
    let freshTokenAcquired = false;

    // Simulate stale token in memory
    setInMemoryCsrfToken('stale-anonymous-token');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/csrf')) {
        freshTokenAcquired = true;
        return jsonRes({ success: true, message: 'Fresh token', data: 'fresh-authenticated-token' });
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        attemptCount++;
        const token = init?.headers?.['X-XSRF-TOKEN'] || init?.headers?.get?.('X-XSRF-TOKEN');
        if (token === 'stale-anonymous-token') {
          // Real ASP.NET Core AutoValidateAntiforgeryToken returns empty 400 Bad Request
          return Promise.resolve(new Response('', { status: 400 }));
        }
        if (token === 'fresh-authenticated-token') {
          return jsonRes({ success: true, message: 'Logged out successfully', data: null });
        }
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const response = await apiRequest('/api/admin/auth/logout', { method: 'POST' });

    expect(attemptCount).toBe(2);
    expect(freshTokenAcquired).toBe(true);
    expect(response.success).toBe(true);
  });

  // ── SCENARIO G ─────────────────────────────────────────────────────────────
  it('Scenario G: Rapid navigation and concurrent session checks cannot restore session after logout', async () => {
    let serverAuthenticated = true;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (url.includes('/api/admin/auth/me')) {
        if (!serverAuthenticated) {
          return jsonRes({ success: false, message: 'Unauthenticated', data: null }, 401);
        }
        return jsonRes({ success: true, message: 'Admin', data: mockAdminUser });
      }

      if (url.includes('/api/admin/auth/csrf')) {
        return jsonRes({ success: true, message: 'CSRF', data: 'token-GGG' });
      }

      if (url.includes('/api/admin/auth/logout') && method === 'POST') {
        serverAuthenticated = false;
        return jsonRes({ success: true, message: 'Logged out' });
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    let authContextRef: any = null;
    function Consumer() {
      const auth = useAuth();
      authContextRef = auth;
      return <div data-testid="auth">{auth.isAuthenticated ? 'yes' : 'no'}</div>;
    }

    const utils = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(utils.getByTestId('auth').textContent).toBe('yes');
    });

    // Execute logout
    await act(async () => {
      await authContextRef.logout();
    });

    expect(utils.getByTestId('auth').textContent).toBe('no');

    // Attempt concurrent refreshSession() calls right after logout
    await act(async () => {
      const result = await authContextRef.refreshSession();
      expect(result).toBeNull();
    });

    // State remains strictly unauthenticated
    expect(utils.getByTestId('auth').textContent).toBe('no');
  });

  // ── SCENARIO H ─────────────────────────────────────────────────────────────
  it('Scenario H: Direct /categories, browser Back, and browser refresh remain protected after logout', async () => {
    // Server is unauthenticated
    vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/admin/auth/me')) {
        return jsonRes({ success: false, message: 'Unauthenticated', data: null }, 401);
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const utils = render(
      <AuthProvider>
        <ProtectedRoute>
          <CategoriesManagementView />
        </ProtectedRoute>
      </AuthProvider>,
    );

    // Redirects to /login
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });

    // Zero category data or protected container revealed
    expect(utils.queryByTestId('categories-page')).toBeNull();

    // Trigger browser Back (persisted bfcache)
    await act(async () => {
      const event = new Event('pageshow') as any;
      event.persisted = true;
      window.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' });
    });
    expect(utils.queryByTestId('categories-page')).toBeNull();
  });
});
