import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  Layers,
  Lock,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getAdminFulfillmentCapabilities,
  type AdminFulfillmentCapabilitiesDto,
} from '@/lib/fulfillments-api';

export interface FulfillmentCapabilitiesBannerProps {
  /**
   * Optional monotonic refresh trigger from parent header.
   */
  refreshTrigger?: number;
  /**
   * Optional callback when capability data finishes loading.
   */
  onLoaded?: (data: AdminFulfillmentCapabilitiesDto) => void;
  className?: string;
}

/**
 * Global operational capability status component for the Fulfillment Admin Workspace.
 * Strictly read-only GET /api/admin/fulfillment-capabilities.
 * Displays authoritative server-side configuration, product allowlist status, and effective availability.
 */
export function FulfillmentCapabilitiesBanner({
  refreshTrigger,
  onLoaded,
  className = '',
}: FulfillmentCapabilitiesBannerProps) {
  const [capabilities, setCapabilities] =
    useState<AdminFulfillmentCapabilitiesDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic fetch counter to discard stale out-of-order responses
  const latestFetchId = useRef(0);

  const fetchCapabilities = useCallback(
    async (isRefresh = false) => {
      const currentFetchId = ++latestFetchId.current;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await getAdminFulfillmentCapabilities();

        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setCapabilities(data);
        onLoaded?.(data);
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to retrieve fulfillment capabilities from server.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [onLoaded]
  );

  // Initial load
  useEffect(() => {
    void fetchCapabilities(false);
  }, [fetchCapabilities]);

  // React to external refresh trigger
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      void fetchCapabilities(true);
    }
  }, [refreshTrigger, fetchCapabilities]);

  // Loading State
  if (isLoading && !capabilities) {
    return (
      <div
        className={`rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 ${className}`}
        data-testid="fulfillment-capabilities-loading"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary animate-pulse">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/40 rounded p-2 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error State: "Capability status unavailable"
  // Rule: Do NOT falsely report "Disabled" or "Enabled" on error.
  if (error && !capabilities) {
    return (
      <div
        className={`rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-400 space-y-3 ${className}`}
        data-testid="fulfillment-capabilities-error"
        role="alert"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm">Capability status unavailable</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchCapabilities(false)}
            className="h-8 gap-1.5 text-xs border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
            data-testid="retry-capabilities-button"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </Button>
        </div>
        <p className="text-xs text-rose-600 dark:text-rose-300/90">{error}</p>
      </div>
    );
  }

  if (!capabilities) {
    return null;
  }

  const isGloballyEnabled = capabilities.isGloballyEnabled;
  const hasAllowlistPolicy = capabilities.hasProductAllowlistPolicy;
  const approvedCount = capabilities.approvedProductCount;
  const isEffectivelyAvailable = capabilities.isEffectivelyAvailable;

  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 shadow-sm space-y-3.5 ${className}`}
      data-testid="fulfillment-capabilities-banner"
    >
      {/* Header Row: Title, Effective Availability Badge, Refresh Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            {isEffectivelyAvailable ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Lock className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                Manual Fulfillment Capability Status
              </span>
              <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                READ-ONLY
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Authoritative server-side feature availability and restricted pilot safeguards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEffectivelyAvailable ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              data-testid="capability-effective-status"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Available for Approved SKUs</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20"
              data-testid="capability-effective-status"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Manual Fulfillment Unavailable</span>
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchCapabilities(true)}
            disabled={isRefreshing}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="Refresh capability status from server"
            aria-label="Refresh capability status"
            data-testid="refresh-capabilities-button"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metrics Row: 4 key indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* 1. Master Switch */}
        <div
          className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1"
          data-testid="metric-global-switch"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium uppercase tracking-wider">Master Switch</span>
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isGloballyEnabled ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span className="font-semibold text-foreground">
              {isGloballyEnabled ? 'Globally Enabled' : 'Disabled'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block font-mono">
            ManualFulfillment:Enabled
          </span>
        </div>

        {/* 2. Product Allowlist Policy */}
        <div
          className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1"
          data-testid="metric-allowlist-policy"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium uppercase tracking-wider">Product Policy</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                hasAllowlistPolicy ? 'bg-primary' : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold text-foreground">
              {hasAllowlistPolicy ? 'Allowlist Active' : 'Empty (Fail-Closed)'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block font-mono">
            ApprovedProductSkus
          </span>
        </div>

        {/* 3. Approved Product Count */}
        <div
          className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1"
          data-testid="metric-approved-count"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium uppercase tracking-wider">Approved Products</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="font-bold text-base font-display text-foreground">
            {approvedCount} <span className="text-xs font-normal text-muted-foreground">SKUs</span>
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {approvedCount > 0 ? 'Restricted pilot catalog' : 'No approved products'}
          </span>
        </div>

        {/* 4. Effective Availability */}
        <div
          className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-1"
          data-testid="metric-effective-availability"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium uppercase tracking-wider">Operational Mode</span>
            {isEffectivelyAvailable ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`font-semibold ${
                isEffectivelyAvailable
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }`}
            >
              {isEffectivelyAvailable ? 'Ready for Pilot' : 'Unavailable'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {isEffectivelyAvailable
              ? 'Allowlisted items eligible'
              : 'Actions strictly blocked'}
          </span>
        </div>
      </div>

      {/* Explanatory Banner: Backend status message rendered safely as text */}
      <div
        className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground"
        data-testid="capability-status-message"
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">
            {capabilities.statusMessage || 'No status explanation provided by server.'}
          </div>
          <p className="text-[11px]">
            {isEffectivelyAvailable
              ? 'Notice: Even when manual fulfillment is active, line items must meet Processing state, verified payment, and explicit authorization requirements.'
              : 'Notice: Manual fulfillment actions cannot be started from this workspace. Feature configuration is managed centrally on the backend.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export interface ProductFulfillmentCapabilityProps {
  /**
   * The historical product SKU of the order line item.
   */
  productSku?: string | null;
  className?: string;
  /**
   * Optional callback when product capability data is loaded from server.
   */
  onLoaded?: (data: AdminFulfillmentCapabilitiesDto) => void;
}

/**
 * Product-specific capability status component.
 * Queries GET /api/admin/fulfillment-capabilities?productSku={sku} strictly on demand
 * when an administrator opens order fulfillment details.
 * Protects against stale out-of-order responses when switching items.
 */
export function ProductFulfillmentCapability({
  productSku,
  className = '',
  onLoaded,
}: ProductFulfillmentCapabilityProps) {
  const [capability, setCapability] =
    useState<AdminFulfillmentCapabilitiesDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const latestFetchId = useRef(0);

  const fetchProductCapability = useCallback(
    async (sku: string) => {
      const currentFetchId = ++latestFetchId.current;
      setIsLoading(true);
      setError(null);

      try {
        const data = await getAdminFulfillmentCapabilities(sku);

        if (currentFetchId !== latestFetchId.current) {
          return;
        }

        setCapability(data);
        onLoaded?.(data);
      } catch (err: unknown) {
        if (currentFetchId !== latestFetchId.current) {
          return;
        }
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to retrieve product fulfillment capability.';
        setError(msg);
      } finally {
        if (currentFetchId === latestFetchId.current) {
          setIsLoading(false);
        }
      }
    },
    [onLoaded]
  );

  useEffect(() => {
    if (!productSku || !productSku.trim()) {
      setCapability(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    void fetchProductCapability(productSku.trim());
  }, [productSku, fetchProductCapability]);

  // Missing or empty SKU
  if (!productSku || !productSku.trim()) {
    return (
      <div
        className={`p-3 rounded-lg border border-border/60 bg-muted/20 text-xs text-muted-foreground flex items-center gap-2 ${className}`}
        data-testid="product-capability-unknown"
      >
        <HelpCircle className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span>Product SKU not specified · Capability status unknown</span>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`p-3 rounded-lg border border-border/60 bg-muted/20 text-xs flex items-center justify-between text-muted-foreground animate-pulse ${className}`}
        data-testid="product-capability-loading"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
          <span>Checking pilot capability for SKU: <span className="font-mono text-foreground">{productSku}</span>...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`p-3 rounded-lg border border-rose-500/25 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-400 flex flex-wrap items-center justify-between gap-2 ${className}`}
        data-testid="product-capability-error"
        role="alert"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Capability status unavailable for <span className="font-mono">{productSku}</span></span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchProductCapability(productSku.trim())}
          className="h-7 text-xs px-2.5 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
          data-testid="retry-product-capability-button"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!capability) {
    return null;
  }

  const isGloballyEnabled = capability.isGloballyEnabled;
  const isApproved = capability.isProductApproved;

  return (
    <div
      className={`p-3.5 rounded-lg border border-border bg-card space-y-2 text-xs ${className}`}
      data-testid="product-capability-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Manual Fulfillment Capability:</span>
          <span className="font-mono text-[11px] text-muted-foreground">({productSku})</span>
        </div>

        {/* Product Approval Status Badge */}
        {isApproved === true ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
            data-testid="product-approval-badge"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Product Approved for Pilot</span>
          </span>
        ) : isApproved === false ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
            data-testid="product-approval-badge"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Product Not Approved</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20"
            data-testid="product-approval-badge"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Product Status Unknown</span>
          </span>
        )}
      </div>

      {/* Explanatory description and safeguards */}
      <div className="text-[11px] text-muted-foreground space-y-1">
        {/* Global disabled context */}
        {!isGloballyEnabled && (
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Manual fulfillment is globally disabled by server configuration.</span>
          </div>
        )}

        {/* Product status description */}
        {isApproved === true ? (
          <div className="space-y-1">
            <p className="text-foreground">
              This SKU is included in the backend allowlist.
            </p>
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>Informational Pilot Status Only:</strong> Product SKU approval does not authorize delivery on its own.
                Fulfillment requires the parent order to be in Processing status with verified payment and administrator authorization.
              </span>
            </div>
          </div>
        ) : isApproved === false ? (
          <p className="text-muted-foreground">
            This product SKU is not on the server allowlist. Manual fulfillment is blocked by fail-closed policy.
          </p>
        ) : (
          <p className="text-muted-foreground">
            The server did not return approval status for this SKU.
          </p>
        )}
      </div>
    </div>
  );
}
