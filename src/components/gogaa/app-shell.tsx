import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  LayoutDashboard,
  FolderOpen,
  Package,
  Store,
  Link2,
  ShoppingCart,
  CreditCard,
  Workflow,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ExternalLink,
  CircleHelp,
  LogOut,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { BrandLockup } from './brand';
import { PreviewDialog } from './shared';
import { useAuth } from '@/lib/auth-context';

const navigation = [
  { label: 'Overview', items: [{ name: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Catalog',
    items: [
      { name: 'Categories', icon: FolderOpen },
      { name: 'Products', icon: Package },
    ],
  },
  {
    label: 'Suppliers',
    items: [
      { name: 'Vendors', icon: Store },
      { name: 'Product Mappings', icon: Link2 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Orders', icon: ShoppingCart },
      { name: 'Payment Reviews', icon: CreditCard, count: '8' },
      { name: 'Fulfillment', icon: Workflow },
    ],
  },
];

export interface AppShellProps {
  children: ReactNode;
  search?: string;
  onSearch?: (value: string) => void;
  activeItem?: 'Dashboard' | 'Categories' | string;
  pageTitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export function AppShell({
  children,
  search = '',
  onSearch,
  activeItem = 'Dashboard',
  pageTitle = 'Dashboard',
  breadcrumbs,
  searchPlaceholder = 'Search preview orders...',
  showSearch = true,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dialog, setDialog] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const { user, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setLogoutError(null);
    try {
      await logout();
      void navigate({ to: '/login' });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Sign out failed. Please try again.';
      setLogoutError(msg);
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : 'AD';

  return (
    <div className={`admin-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}>
      <div className="mobile-backdrop" onClick={() => setMobile(false)} />
      <aside className="app-sidebar">
        <Button
          variant="ghost"
          size="icon"
          className="sidebar-mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X />
        </Button>
        <div className="sidebar-brand">
          <BrandLockup />
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <Button
                  variant="nav"
                  key={item.name}
                  className={item.name === activeItem ? 'active' : ''}
                  aria-current={item.name === activeItem ? 'page' : undefined}
                  title={item.name === 'Dashboard' || item.name === 'Categories' ? item.name : `${item.name} — preview`}
                  onClick={() => {
                    setMobile(false);
                    if (item.name === 'Dashboard') {
                      void navigate({ to: '/' });
                    } else if (item.name === 'Categories') {
                      void navigate({ to: '/categories' });
                    } else {
                      setDialog(`${item.name} · Coming in a future phase`);
                    }
                  }}
                >
                  <item.icon />
                  <span>{item.name}</span>
                  {'count' in item && (
                    <span
                      className="nav-count"
                      title="Sample count · preview data, not a live alert"
                      aria-label={`${item.count} sample items, preview data`}
                    >
                      {item.count}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-preview">
            <div className="sidebar-preview-title">
              <Sparkles />
              A glimpse of what's next
            </div>
            <p>
              You're exploring the design preview.
              <br />
              Your digital universe starts here.
            </p>
          </div>
          <div className="sidebar-footer">
            <span>Gogaa Byte Admin · v0.1</span>
            <Button
              variant="ghost"
              size="icon"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="app-header">
          <div className="header-left">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <div className="min-w-0">
              <h2>{pageTitle}</h2>
              <div className="breadcrumbs">
                {breadcrumbs ? (
                  breadcrumbs.map((crumb, idx) => (
                    <span key={crumb.label} className="inline-flex items-center gap-1.5">
                      {idx > 0 && <ChevronRight className="w-2.5 h-2.5 inline" />}
                      <span>{crumb.label}</span>
                    </span>
                  ))
                ) : (
                  <>
                    <span>Control Center</span>
                    <ChevronRight />
                    <span>Overview</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="header-right">
            {showSearch && onSearch && (
              <label className="search-wrap">
                <Search />
                <input
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                />
              </label>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="notification-button"
              aria-label="Sample notifications (preview only, not live alerts)"
              title="Sample notifications · preview only"
              onClick={() => setDialog('Notifications · Preview')}
            >
              <Bell />
              <span className="notification-dot" />
            </Button>
            <span className="header-divider" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="profile-trigger" aria-label="Administrator menu">
                  <span className="avatar">{initials}</span>
                  <span className="profile-text">
                    <strong>{user?.fullName || 'Administrator'}</strong>
                    <small>{user?.email || 'Control Center'}</small>
                  </span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span>{user?.fullName || 'Administrator'}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {user?.email || 'admin@gogaabyte.com'}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDialog('Administrator profile · Verified Session')}>
                  <CircleHelp />
                  Profile details
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/loading">
                    <Sparkles />
                    Loading design gallery
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://gogaabyte.com/" target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Visit marketplace
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void handleLogout();
                  }}
                  disabled={isLoggingOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                  data-testid="sign-out-menu-item"
                >
                  <LogOut />
                  <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {children}
      </div>

      <PreviewDialog title={dialog} onClose={() => setDialog(null)} />

      {logoutError && (
        <Dialog open={!!logoutError} onOpenChange={() => setLogoutError(null)}>
          <DialogContent>
            <div className="dialog-symbol bg-destructive/10 text-destructive">
              <AlertCircle className="w-5 h-5" />
            </div>
            <DialogTitle>Sign Out Unsuccessful</DialogTitle>
            <DialogDescription>{logoutError}</DialogDescription>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setLogoutError(null)}>
                Dismiss
              </Button>
              <Button variant="brand" onClick={() => void handleLogout()}>
                Retry Sign Out
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
