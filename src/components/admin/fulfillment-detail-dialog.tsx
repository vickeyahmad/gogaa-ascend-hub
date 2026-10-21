import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/gogaa/loaders';
import { ProductFulfillmentCapability } from './fulfillment-capabilities';
import { ManualFulfillmentStartDialog } from './manual-fulfillment-start-dialog';
import { ManualFulfillmentCompleteDialog } from './manual-fulfillment-complete-dialog';
import {
  getAdminOrderFulfillments,
  getFulfillmentQueueStatusBadgeInfo,
  getParentOrderStatusBadgeInfo,
  getFulfillmentMethodBadgeInfo,
  getAttemptStatusBadgeInfo,
  formatFulfillmentDate,
  type AdminOrderFulfillmentsDto,
  type AdminFulfillmentSummaryDto,
  type AdminFulfillmentDto,
  type AdminFulfillmentCapabilitiesDto,
  getUnresolvedOperation,
  clearUnresolvedOperation,
} from '@/lib/fulfillments-api';
import {
  Workflow,
  Receipt,
  User,
  ShoppingBag,
  History,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Info,
  ExternalLink,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export interface FulfillmentDetailDialogProps {
  orderNumber: string | null;
  summaryItem: AdminFulfillmentSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
  onFulfillmentUpdated?: () => void;
}

export function FulfillmentDetailDialog({
  orderNumber,
  summaryItem,
  isOpen,
  onClose,
  onFulfillmentUpdated,
}: FulfillmentDetailDialogProps) {
  const navigate = useNavigate();

  const [orderFulfillments, setOrderFulfillments] =
    useState<AdminOrderFulfillmentsDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Track capability states per SKU to inform action button eligibility
  const [skuCapabilities, setSkuCapabilities] = useState<
    Record<string, AdminFulfillmentCapabilitiesDto>
  >({});

  // Start confirmation dialog state
  const [startDialog, setStartDialog] = useState<{
    isOpen: boolean;
    orderItemId: number;
    productName: string;
    productSku: string;
    quantityRequested: number;
    parentOrderStatus: string;
    isGloballyEnabled: boolean;
    isProductApproved: boolean;
  }>({
    isOpen: false,
    orderItemId: 0,
    productName: '',
    productSku: '',
    quantityRequested: 1,
    parentOrderStatus: 'Processing',
    isGloballyEnabled: false,
    isProductApproved: false,
  });

  // Complete confirmation dialog state
  const [completeDialog, setCompleteDialog] = useState<{
    isOpen: boolean;
    orderItemId: number;
    productName: string;
    productSku: string;
    quantityRequested: number;
    attemptNumber: number;
    attemptKey: string;
  }>({
    isOpen: false,
    orderItemId: 0,
    productName: '',
    productSku: '',
    quantityRequested: 1,
    attemptNumber: 1,
    attemptKey: '—',
  });

  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);

  const reloadFulfillments = async () => {
    if (!orderNumber) return;
    setIsReconciling(true);
    try {
      const data = await getAdminOrderFulfillments(orderNumber);
      setOrderFulfillments(data);
      setReconciliationError(null);

      // Settle unresolved operations only if authoritative server state confirms the transition
      if (data && Array.isArray(data.fulfillments)) {
        for (const f of data.fulfillments) {
          if (
            f.status === 'InProgress' ||
            f.status === 'Completed' ||
            f.attempts.some((a) => a.status === 'Submitted')
          ) {
            clearUnresolvedOperation(orderNumber, f.orderItemId, 'start');
          }
          if (
            f.status === 'Completed' ||
            f.attempts.some((a) => a.status === 'Succeeded')
          ) {
            clearUnresolvedOperation(orderNumber, f.orderItemId, 'complete');
          }
        }
      }

      onFulfillmentUpdated?.();
    } catch (err: unknown) {
      // Make reconciliation failure visible rather than swallowing
      const msg =
        err instanceof Error
          ? err.message
          : 'Authoritative server verification failed. Could not retrieve fulfillment state.';
      setReconciliationError(msg);
      // Unresolved operation locks are strictly preserved
    } finally {
      setIsReconciling(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !orderNumber) {
      setOrderFulfillments(null);
      setError(null);
      setReconciliationError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadFulfillments() {
      setIsLoading(true);
      setError(null);
      setOrderFulfillments(null);

      try {
        const data = await getAdminOrderFulfillments(orderNumber as string);
        if (!isCancelled) {
          setOrderFulfillments(data);
          // Settle unresolved operations if authoritative server state demonstrates transition
          if (data && Array.isArray(data.fulfillments)) {
            for (const f of data.fulfillments) {
              if (
                f.status === 'InProgress' ||
                f.status === 'Completed' ||
                f.attempts.some((a) => a.status === 'Submitted')
              ) {
                clearUnresolvedOperation(orderNumber, f.orderItemId, 'start');
              }
              if (
                f.status === 'Completed' ||
                f.attempts.some((a) => a.status === 'Succeeded')
              ) {
                clearUnresolvedOperation(orderNumber, f.orderItemId, 'complete');
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Failed to retrieve fulfillment details for this order.';
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFulfillments();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, orderNumber]);

  const handleCopyOrderNumber = () => {
    if (!orderNumber) return;
    navigator.clipboard?.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigateToOrders = () => {
    onClose();
    void navigate({ to: '/orders' });
  };

  const parentOrderStatusString =
    orderFulfillments?.orderStatus ?? summaryItem?.orderStatus ?? 'Processing';

  const orderStatusBadge = parentOrderStatusString
    ? getParentOrderStatusBadgeInfo(parentOrderStatusString)
    : null;

  const fulfillmentsList: AdminFulfillmentDto[] =
    orderFulfillments?.fulfillments ?? [];

  const isCompletelyUninitialized =
    !isLoading &&
    !error &&
    orderFulfillments !== null &&
    fulfillmentsList.length === 0;

  const handleStartSuccess = (_updated: AdminFulfillmentDto) => {
    void reloadFulfillments();
    onFulfillmentUpdated?.();
  };

  const handleCompleteSuccess = (_updated: AdminFulfillmentDto) => {
    void reloadFulfillments();
    onFulfillmentUpdated?.();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card shadow-2xl"
          data-testid="fulfillment-detail-dialog"
        >
          {/* Header Banner */}
          <div className="p-6 border-b border-border bg-muted/30">
            <DialogHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-bold tracking-tight">
                        Order {orderNumber || ''}
                      </DialogTitle>
                      {orderNumber && (
                        <button
                          type="button"
                          onClick={handleCopyOrderNumber}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                          title="Copy Order Number"
                          aria-label="Copy order number"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Fulfillment Inspection &amp; Controlled Delivery Operations
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="admin-badge-live">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Control Center</span>
                  </span>
                  {orderStatusBadge && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${orderStatusBadge.badgeClass}`}
                      data-testid="dialog-parent-order-status"
                    >
                      {orderStatusBadge.dotClass && (
                        <span className={`w-1.5 h-1.5 rounded-full ${orderStatusBadge.dotClass}`} />
                      )}
                      Order: {orderStatusBadge.label}
                    </span>
                  )}
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-6">
            {/* Reconciliation Error Banner */}
            {reconciliationError && !isLoading && (
              <div
                className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2"
                data-testid="reconciliation-error-banner"
                role="alert"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Authoritative State Verification Failed</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void reloadFulfillments()}
                    disabled={isReconciling}
                    className="h-7 text-[11px] gap-1.5 border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                    data-testid="retry-reconciliation-btn"
                  >
                    <RefreshCw className={`w-3 h-3 ${isReconciling ? 'animate-spin' : ''}`} />
                    <span>Retry Verification (GET)</span>
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {reconciliationError}. To protect against duplicate dispatch, actions remain locked.
                  Click <strong>Retry Verification (GET)</strong> to safely re-query the server without re-sending delivery requests.
                </p>
              </div>
            )}

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="py-12 space-y-4" data-testid="dialog-loading-skeleton">
                <SkeletonLoader />
                <p className="text-xs text-center text-muted-foreground">
                  Loading fulfillment records and audit history...
                </p>
              </div>
            )}

            {/* Error Banner */}
            {error && !isLoading && (
              <div
                className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-3"
                data-testid="dialog-error-banner"
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Failed to load fulfillment details</span>
                </div>
                <p className="text-xs">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (orderNumber) {
                      setIsLoading(true);
                      setError(null);
                      getAdminOrderFulfillments(orderNumber)
                        .then((data) => setOrderFulfillments(data))
                        .catch((err: unknown) => {
                          const msg =
                            err instanceof Error
                              ? err.message
                              : 'Failed to load fulfillment details.';
                          setError(msg);
                        })
                        .finally(() => setIsLoading(false));
                    }
                  }}
                  className="gap-1.5 text-xs h-8"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </Button>
              </div>
            )}

            {/* Valid State: Item is Uninitialized (0 fulfillment records in order) */}
            {isCompletelyUninitialized && (
              <div className="space-y-6" data-testid="dialog-uninitialized-state">
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Uninitialized Fulfillment Work</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No persisted fulfillment database record exists for this order yet.
                    This is projected actionable work awaiting processing assignment.
                  </p>
                </div>

                {summaryItem && (
                  <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Line Item Snapshot
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Product:</span>
                        <span className="font-semibold text-foreground">{summaryItem.productName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Product SKU:</span>
                        <span className="font-mono text-foreground">{summaryItem.productSku}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Order Item ID:</span>
                        <span className="font-mono text-foreground">#{summaryItem.orderItemId}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Quantity:</span>
                        <span className="font-mono text-foreground">
                          {summaryItem.quantityFulfilled} fulfilled / {summaryItem.quantityRequested} requested
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Fulfillment Method:</span>
                        <span className="text-foreground">{summaryItem.fulfillmentMethod}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Queue Status:</span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                          Uninitialized
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {summaryItem && (
                  <ProductFulfillmentCapability
                    productSku={summaryItem.productSku}
                    onLoaded={(cap) => {
                      setSkuCapabilities((prev) => ({
                        ...prev,
                        [summaryItem.productSku]: cap,
                      }));
                    }}
                  />
                )}

                {/* Uninitialized Actions Card */}
                {summaryItem && (
                  <div
                    className="p-4 rounded-lg border border-border bg-card space-y-3"
                    data-testid="uninitialized-actions-card"
                  >
                    {(() => {
                      const unresolvedStart = getUnresolvedOperation(orderNumber, summaryItem.orderItemId, 'start');
                      if (!unresolvedStart) return null;
                      return (
                        <div
                          className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
                          data-testid={`item-unresolved-alert-${summaryItem.orderItemId}`}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <span className="font-semibold block">Manual Review Required (Start Operation Pending)</span>
                            <span>{unresolvedStart.errorSummary}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Manual Fulfillment Controls
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Initiate controlled manual delivery workflow for this line item.
                        </p>
                      </div>

                      {(() => {
                        const uninitCap = skuCapabilities[summaryItem.productSku];
                        const isGloballyEnabled = uninitCap?.isGloballyEnabled ?? false;
                        const isSkuApproved = uninitCap?.isProductApproved ?? false;
                        const isOrderProcessing = parentOrderStatusString === 'Processing';
                        const isEligible = isGloballyEnabled && isSkuApproved && isOrderProcessing;

                        if (!isGloballyEnabled) {
                          return (
                            <span className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Manual fulfillment disabled by server configuration</span>
                            </span>
                          );
                        }

                        return (
                          <Button
                            type="button"
                            size="sm"
                            disabled={!isEligible}
                            onClick={() => {
                              setStartDialog({
                                isOpen: true,
                                orderItemId: summaryItem.orderItemId,
                                productName: summaryItem.productName,
                                productSku: summaryItem.productSku,
                                quantityRequested: summaryItem.quantityRequested,
                                parentOrderStatus: parentOrderStatusString,
                                isGloballyEnabled,
                                isProductApproved: isSkuApproved,
                              });
                            }}
                            className="text-xs h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                            data-testid="start-manual-fulfillment-btn"
                            title={
                              !isSkuApproved
                                ? `Product SKU (${summaryItem.productSku}) is not approved on the server allowlist.`
                                : !isOrderProcessing
                                ? `Parent order is ${parentOrderStatusString}; must be in Processing.`
                                : 'Start manual fulfillment attempt'
                            }
                          >
                            <Workflow className="w-3.5 h-3.5" />
                            <span>Start Manual Fulfillment</span>
                          </Button>
                        );
                      })()}
                    </div>

                    {/* Explanatory notice when disabled */}
                    {(() => {
                      const uninitCap = skuCapabilities[summaryItem.productSku];
                      if (!uninitCap) return null;

                      if (!uninitCap.isGloballyEnabled) {
                        return (
                          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                            <Lock className="w-3 h-3 text-muted-foreground" />
                            Action unavailable: manual fulfillment is disabled by server configuration.
                          </p>
                        );
                      }

                      if (!uninitCap.isProductApproved) {
                        return (
                          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-amber-500" />
                            Action unavailable: product SKU ({summaryItem.productSku}) is not on the approved allowlist.
                          </p>
                        );
                      }

                      if (parentOrderStatusString !== 'Processing') {
                        return (
                          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            Action unavailable: parent order must be in Processing status (currently {parentOrderStatusString}).
                          </p>
                        );
                      }

                      return null;
                    })()}
                  </div>
                )}

                <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">No fulfillment attempts or status history recorded.</p>
                  <p>Attempts and audit transitions will appear once fulfillment is initiated.</p>
                </div>
              </div>
            )}

            {/* Valid State: Initialized Fulfillment Records exist */}
            {!isLoading && !error && fulfillmentsList.length > 0 && (
              <div className="space-y-6" data-testid="dialog-fulfillments-list">
                {fulfillmentsList.map((f) => {
                  const statusBadge = getFulfillmentQueueStatusBadgeInfo(f.status);
                  const methodBadge = getFulfillmentMethodBadgeInfo(f.fulfillmentMethod);

                  const activeSubmittedAttempt = f.attempts.find(
                    (a) => a.status === 'Submitted'
                  );
                  const activeManualAttempt = f.attempts.find(
                    (a) => a.isManual && a.status === 'Submitted'
                  );
                  const hasUnresolvedAttempt = f.attempts.some(
                    (a) =>
                      a.status === 'Unknown' ||
                      a.status === 'RequiresReconciliation'
                  );
                  const hasSucceededAttempt = f.attempts.some(
                    (a) => a.status === 'Succeeded'
                  );
                  const isCompleted = f.status === 'Completed' || hasSucceededAttempt;
                  const isFailed = f.status === 'Failed';

                  const itemCap = skuCapabilities[f.productSku];
                  const isGloballyEnabled = itemCap?.isGloballyEnabled ?? false;
                  const isSkuApproved = itemCap?.isProductApproved ?? false;
                  const isOrderProcessing = parentOrderStatusString === 'Processing';
                  const isItemEligibleToStart =
                    isGloballyEnabled &&
                    isSkuApproved &&
                    isOrderProcessing &&
                    !isCompleted &&
                    !isFailed &&
                    !activeSubmittedAttempt &&
                    !hasUnresolvedAttempt;

                  return (
                    <div
                      key={f.fulfillmentId}
                      className="p-5 rounded-lg border border-border bg-card space-y-4"
                      data-testid={`fulfillment-item-${f.fulfillmentId}`}
                    >
                      {/* Item Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {f.productName}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              ({f.productSku})
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Fulfillment ID: <span className="font-mono">#{f.fulfillmentId}</span> · Order Item ID: <span className="font-mono">#{f.orderItemId}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusBadge.badgeClass}`}
                            data-testid="item-status-badge"
                          >
                            {statusBadge.dotClass && (
                              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                            )}
                            {statusBadge.label}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${methodBadge.badgeClass}`}
                          >
                            {methodBadge.label}
                          </span>
                        </div>
                      </div>

                      {/* Quantity & Financial Snapshot */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/20 p-3 rounded-md">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Quantity Requested</span>
                          <span className="font-semibold font-mono text-foreground">{f.quantityRequested}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Quantity Fulfilled</span>
                          <span
                            className={`font-semibold font-mono ${
                              f.quantityFulfilled >= f.quantityRequested
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                            }`}
                          >
                            {f.quantityFulfilled}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Created At</span>
                          <span className="text-foreground">{formatFulfillmentDate(f.createdAt)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Completed At</span>
                          <span className="text-foreground">{formatFulfillmentDate(f.completedAt)}</span>
                        </div>
                      </div>

                      {/* Product Capability Status */}
                      <ProductFulfillmentCapability
                        productSku={f.productSku}
                        onLoaded={(cap) => {
                          setSkuCapabilities((prev) => ({
                            ...prev,
                            [f.productSku]: cap,
                          }));
                        }}
                      />

                      {/* Line Item Actions Card */}
                      <div
                        className="p-3.5 rounded-lg border border-border bg-muted/10 space-y-2.5"
                        data-testid={`item-actions-section-${f.fulfillmentId}`}
                      >
                        {(() => {
                          const unresolvedStart = getUnresolvedOperation(orderNumber, f.orderItemId, 'start');
                          const unresolvedComplete = getUnresolvedOperation(orderNumber, f.orderItemId, 'complete');
                          return (
                            <>
                              {unresolvedStart && (
                                <div
                                  className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
                                  data-testid={`item-unresolved-alert-${f.orderItemId}`}
                                >
                                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                  <div>
                                    <span className="font-semibold block">Manual Review Required (Start Attempt)</span>
                                    <span>{unresolvedStart.errorSummary}</span>
                                  </div>
                                </div>
                              )}
                              {unresolvedComplete && (
                                <div
                                  className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2"
                                  data-testid={`item-unresolved-alert-${f.orderItemId}`}
                                >
                                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                  <div>
                                    <span className="font-semibold block">Manual Review Required (Completion)</span>
                                    <span>{unresolvedComplete.errorSummary}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-foreground block">
                              Manual Fulfillment Actions
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Order Item #{f.orderItemId}
                            </span>
                          </div>

                          {/* Action Buttons based on state */}
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Fulfillment Completed</span>
                            </span>
                          ) : hasUnresolvedAttempt ? (
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                              Reconciliation Required
                            </span>
                          ) : !isGloballyEnabled ? (
                            <span className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Manual fulfillment disabled by server configuration</span>
                            </span>
                          ) : activeManualAttempt ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setCompleteDialog({
                                  isOpen: true,
                                  orderItemId: f.orderItemId,
                                  productName: f.productName,
                                  productSku: f.productSku,
                                  quantityRequested: f.quantityRequested,
                                  attemptNumber: activeManualAttempt.attemptNumber,
                                  attemptKey: activeManualAttempt.attemptKey,
                                });
                              }}
                              className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              data-testid="complete-manual-fulfillment-btn"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Complete Delivery</span>
                            </Button>
                          ) : activeSubmittedAttempt ? (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              Supplier Attempt Pending
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={!isItemEligibleToStart}
                              onClick={() => {
                                setStartDialog({
                                  isOpen: true,
                                  orderItemId: f.orderItemId,
                                  productName: f.productName,
                                  productSku: f.productSku,
                                  quantityRequested: f.quantityRequested,
                                  parentOrderStatus: parentOrderStatusString,
                                  isGloballyEnabled,
                                  isProductApproved: isSkuApproved,
                                });
                              }}
                              className="text-xs h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                              data-testid="start-manual-fulfillment-btn"
                              title={
                                !isSkuApproved
                                  ? `Product SKU (${f.productSku}) is not approved on the server allowlist.`
                                  : !isOrderProcessing
                                  ? `Parent order is ${parentOrderStatusString}; must be in Processing.`
                                  : 'Start manual fulfillment attempt'
                              }
                            >
                              <Workflow className="w-3.5 h-3.5" />
                              <span>Start Manual Fulfillment</span>
                            </Button>
                          )}
                        </div>

                        {/* Explanatory text for disabled states */}
                        {!isCompleted &&
                          !activeManualAttempt &&
                          !hasUnresolvedAttempt &&
                          !activeSubmittedAttempt &&
                          itemCap && (
                            <>
                              {!itemCap.isGloballyEnabled ? (
                                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-muted-foreground" />
                                  Action unavailable: manual fulfillment is disabled by server configuration.
                                </p>
                              ) : !itemCap.isProductApproved ? (
                                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3 text-amber-500" />
                                  Action unavailable: product SKU ({f.productSku}) is not on the server approved allowlist.
                                </p>
                              ) : !isOrderProcessing ? (
                                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                  Action unavailable: parent order must be in Processing status (currently {parentOrderStatusString}).
                                </p>
                              ) : null}
                            </>
                          )}

                        {hasUnresolvedAttempt && (
                          <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block">Unconfirmed Attempt Status</span>
                              <span>
                                A previous attempt has an unconfirmed status (Unknown or RequiresReconciliation). Status reconciliation
                                is strictly required before any subsequent fulfillment action to prevent duplicate delivery.
                              </span>
                            </div>
                          </div>
                        )}

                        {activeManualAttempt && (
                          <div className="p-2.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-300 text-xs flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                            <div>
                              <span className="font-semibold block">Active Manual Attempt Pending</span>
                              <span>
                                Attempt #{activeManualAttempt.attemptNumber} is in Submitted status. After delivering the purchased product
                                through an authorized external channel, click Complete Delivery above to provide delivery evidence.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Attempts History */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <Layers className="w-3.5 h-3.5" />
                          Fulfillment Attempts ({f.attempts.length})
                        </div>

                        {f.attempts.length === 0 ? (
                          <div className="p-3 rounded border border-dashed border-border text-center text-xs text-muted-foreground">
                            No fulfillment attempts recorded for this line item.
                          </div>
                        ) : (
                          <div className="space-y-2" data-testid="attempts-list">
                            {f.attempts.map((att) => {
                              const attStatusBadge = getAttemptStatusBadgeInfo(att.status);

                              return (
                                <div
                                  key={att.attemptId}
                                  className="p-3 rounded border border-border/60 bg-muted/10 space-y-2 text-xs"
                                  data-testid={`attempt-card-${att.attemptNumber}`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-foreground">
                                        Attempt #{att.attemptNumber}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        {att.attemptKey}
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                                        {att.isManual ? 'Manual' : `Vendor (${att.vendorName || 'API'})`}
                                      </span>
                                    </div>

                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${attStatusBadge.badgeClass}`}
                                    >
                                      {attStatusBadge.dotClass && (
                                        <span className={`w-1 h-1 rounded-full ${attStatusBadge.dotClass}`} />
                                      )}
                                      {attStatusBadge.label}
                                    </span>
                                  </div>

                                  {/* External / Safe Details */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                    {att.externalVendorOrderId && (
                                      <div>
                                        Vendor Order ID: <span className="font-mono text-foreground">{att.externalVendorOrderId}</span>
                                      </div>
                                    )}
                                    {att.deliveryReference && (
                                      <div>
                                        Delivery Ref: <span className="font-mono text-foreground">{att.deliveryReference}</span>
                                      </div>
                                    )}
                                    {att.deliveryChannel && (
                                      <div>
                                        Channel: <span className="text-foreground">{att.deliveryChannel}</span>
                                      </div>
                                    )}
                                    {att.submittedAt && (
                                      <div>
                                        Submitted: <span className="text-foreground">{formatFulfillmentDate(att.submittedAt)}</span>
                                      </div>
                                    )}
                                    {att.completedAt && (
                                      <div>
                                        Completed: <span className="text-foreground">{formatFulfillmentDate(att.completedAt)}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Safe Error / Failure Information */}
                                  {att.safeErrorSummary && (
                                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] flex items-start gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-semibold">
                                          {att.failureCategory ? `[${att.failureCategory}] ` : ''}
                                        </span>
                                        {att.safeErrorSummary}
                                      </div>
                                    </div>
                                  )}

                                  {/* Admin Notes */}
                                  {att.notes && (
                                    <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded">
                                      <span className="font-semibold text-foreground">Notes: </span>
                                      {att.notes}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Status History */}
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <History className="w-3.5 h-3.5" />
                          Status Audit History ({f.statusHistory.length})
                        </div>

                        {f.statusHistory.length === 0 ? (
                          <div className="p-3 rounded border border-dashed border-border text-center text-xs text-muted-foreground">
                            No status transitions recorded yet.
                          </div>
                        ) : (
                          <div className="space-y-1.5" data-testid="status-history-list">
                            {f.statusHistory.map((hist) => (
                              <div
                                key={hist.id}
                                className="p-2 rounded bg-muted/20 border border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    {hist.previousStatus || 'None'}
                                  </span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="font-semibold text-foreground">
                                    {hist.newStatus}
                                  </span>
                                  {hist.reason && (
                                    <span className="text-[11px] text-muted-foreground italic">
                                      ({hist.reason})
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatFulfillmentDate(hist.changedAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateToOrders}
              className="gap-1.5 text-xs h-8"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>View in Orders Management</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="text-xs h-8"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start Confirmation Dialog */}
      <ManualFulfillmentStartDialog
        isOpen={startDialog.isOpen}
        onClose={() => setStartDialog((prev) => ({ ...prev, isOpen: false }))}
        orderNumber={orderNumber}
        orderItemId={startDialog.orderItemId}
        productName={startDialog.productName}
        productSku={startDialog.productSku}
        quantityRequested={startDialog.quantityRequested}
        parentOrderStatus={startDialog.parentOrderStatus}
        isGloballyEnabled={startDialog.isGloballyEnabled}
        isProductApproved={startDialog.isProductApproved}
        onSuccess={handleStartSuccess}
        onReconcile={reloadFulfillments}
      />

      {/* Complete Delivery Confirmation Dialog */}
      <ManualFulfillmentCompleteDialog
        isOpen={completeDialog.isOpen}
        onClose={() => setCompleteDialog((prev) => ({ ...prev, isOpen: false }))}
        orderNumber={orderNumber}
        orderItemId={completeDialog.orderItemId}
        productName={completeDialog.productName}
        productSku={completeDialog.productSku}
        quantityRequested={completeDialog.quantityRequested}
        attemptNumber={completeDialog.attemptNumber}
        attemptKey={completeDialog.attemptKey}
        onSuccess={handleCompleteSuccess}
        onReconcile={reloadFulfillments}
      />
    </>
  );
}