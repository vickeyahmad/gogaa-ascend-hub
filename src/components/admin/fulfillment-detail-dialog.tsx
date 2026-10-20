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
  type AdminFulfillmentAttemptDto,
  type AdminFulfillmentStatusHistoryDto,
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
  Info,
  ExternalLink,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export interface FulfillmentDetailDialogProps {
  orderNumber: string | null;
  summaryItem: AdminFulfillmentSummaryDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FulfillmentDetailDialog({
  orderNumber,
  summaryItem,
  isOpen,
  onClose,
}: FulfillmentDetailDialogProps) {
  const navigate = useNavigate();

  const [orderFulfillments, setOrderFulfillments] =
    useState<AdminOrderFulfillmentsDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !orderNumber) {
      setOrderFulfillments(null);
      setError(null);
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

  const orderStatusBadge = orderFulfillments
    ? getParentOrderStatusBadgeInfo(orderFulfillments.orderStatus)
    : summaryItem
      ? getParentOrderStatusBadgeInfo(summaryItem.orderStatus)
      : null;

  const fulfillmentsList: AdminFulfillmentDto[] =
    orderFulfillments?.fulfillments ?? [];

  const isCompletelyUninitialized =
    !isLoading &&
    !error &&
    orderFulfillments !== null &&
    fulfillmentsList.length === 0;

  return (
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
                    Read-only fulfillment inspection · No mutation operations
                  </DialogDescription>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="admin-badge-live">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Read-Only</span>
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
                <ProductFulfillmentCapability productSku={summaryItem.productSku} />
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
              {fulfillmentsList.map((f, index) => {
                const statusBadge = getFulfillmentQueueStatusBadgeInfo(f.status);
                const methodBadge = getFulfillmentMethodBadgeInfo(f.fulfillmentMethod);

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
                    <ProductFulfillmentCapability productSku={f.productSku} />

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
  );
}
