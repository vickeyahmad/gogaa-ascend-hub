import { apiRequest, ApiClientError } from './api-client';

export type FulfillmentStatus =
  | 'NotStarted'
  | 'Pending'
  | 'InProgress'
  | 'Completed'
  | 'PartiallyCompleted'
  | 'Failed'
  | 'RequiresReview';

export type FulfillmentMethod = 'Unassigned' | 'Manual' | 'VendorApi';

export type FulfillmentAttemptStatus =
  | 'NotStarted'
  | 'Submitted'
  | 'Succeeded'
  | 'ConfirmedFailed'
  | 'Unknown'
  | 'RequiresReconciliation';

export type FulfillmentFailureCategory =
  | 'None'
  | 'VendorOutOfStock'
  | 'VendorSystemError'
  | 'InvalidCustomerInput'
  | 'NetworkTimeout'
  | 'InsufficientVendorBalance'
  | 'Other';

export interface AdminFulfillmentSummaryDto {
  fulfillmentId: number | null;
  isInitialized: boolean;
  orderId: number;
  orderNumber: string;
  orderItemId: number;
  customerId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  productSku: string;
  productName: string;
  quantityRequested: number;
  quantityFulfilled: number;
  fulfillmentMethod: FulfillmentMethod | string;
  fulfillmentStatus?: FulfillmentStatus | string | null;
  queueStatus: string;
  orderStatus: string;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface AdminFulfillmentAttemptDto {
  attemptId: number;
  attemptNumber: number;
  attemptKey: string;
  isManual: boolean;
  vendorProductId?: number | null;
  vendorId?: number | null;
  vendorName?: string | null;
  status: FulfillmentAttemptStatus | string;
  externalVendorOrderId?: string | null;
  failureCategory?: FulfillmentFailureCategory | string | null;
  safeErrorSummary?: string | null;
  deliveryReference?: string | null;
  deliveryChannel?: string | null;
  notes?: string | null;
  initiatedByUserId?: string | null;
  confirmedByUserId?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  completedAt?: string | null;
}

export interface AdminFulfillmentStatusHistoryDto {
  id: number;
  fulfillmentId: number;
  previousStatus?: string | null;
  newStatus: string;
  reason?: string | null;
  changedByUserId?: string | null;
  changedAt: string;
}

export interface AdminFulfillmentDto {
  fulfillmentId: number;
  orderId: number;
  orderItemId: number;
  productSku: string;
  productName: string;
  unitPrice: number;
  currency: string;
  quantityRequested: number;
  quantityFulfilled: number;
  status: FulfillmentStatus | string;
  fulfillmentMethod: FulfillmentMethod | string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  attempts: AdminFulfillmentAttemptDto[];
  statusHistory: AdminFulfillmentStatusHistoryDto[];
}

export interface AdminOrderFulfillmentsDto {
  orderNumber: string;
  orderId: number;
  orderStatus: string;
  fulfillments: AdminFulfillmentDto[];
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminFulfillmentQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  fulfillmentMethod?: string;
  orderStatus?: string;
  search?: string;
}

export interface BadgeInfo {
  label: string;
  badgeClass: string;
  dotClass?: string;
  description?: string;
}

/**
 * Searches and retrieves a paginated overview of fulfillment work items across customer orders.
 * Strictly read-only GET.
 */
export async function getAdminFulfillments(
  query?: AdminFulfillmentQuery
): Promise<PagedResult<AdminFulfillmentSummaryDto>> {
  const params = new URLSearchParams();

  if (query?.page && query.page > 0) {
    params.set('page', String(query.page));
  }
  if (query?.pageSize && query.pageSize > 0) {
    params.set('pageSize', String(query.pageSize));
  }
  if (query?.status && query.status.trim() && query.status !== 'all') {
    params.set('status', query.status.trim());
  }
  if (
    query?.fulfillmentMethod &&
    query.fulfillmentMethod.trim() &&
    query.fulfillmentMethod !== 'all'
  ) {
    params.set('fulfillmentMethod', query.fulfillmentMethod.trim());
  }
  if (query?.orderStatus && query.orderStatus.trim() && query.orderStatus !== 'all') {
    params.set('orderStatus', query.orderStatus.trim());
  }
  if (query?.search && query.search.trim()) {
    params.set('search', query.search.trim().slice(0, 100));
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/api/admin/fulfillments?${queryString}` : '/api/admin/fulfillments';

  const response = await apiRequest<PagedResult<AdminFulfillmentSummaryDto>>(endpoint, {
    method: 'GET',
    skipCsrf: true,
  });

  return (
    response.data ?? {
      items: [],
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    }
  );
}

/**
 * Retrieves all line item fulfillments, supplier/manual attempts, and status audit history for an order.
 * Strictly read-only GET.
 */
export async function getAdminOrderFulfillments(
  orderNumber: string
): Promise<AdminOrderFulfillmentsDto> {
  if (!orderNumber || !orderNumber.trim()) {
    throw new ApiClientError('Order number is required.', 400);
  }

  const encoded = encodeURIComponent(orderNumber.trim());
  const response = await apiRequest<AdminOrderFulfillmentsDto>(
    `/api/admin/orders/${encoded}/fulfillments`,
    {
      method: 'GET',
      skipCsrf: true,
    }
  );

  if (!response.data) {
    throw new ApiClientError(
      response.message || `Order '${orderNumber}' fulfillments not found.`,
      404
    );
  }

  return response.data;
}

/**
 * Returns UI badge styling and human-readable label for queue status.
 * Uninitialized work is highlighted with clear non-invented status.
 */
export function getFulfillmentQueueStatusBadgeInfo(
  status: string | null | undefined
): BadgeInfo {
  const norm = (status || '').trim();

  switch (norm) {
    case 'Uninitialized':
      return {
        label: 'Uninitialized',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-500',
        description: 'No fulfillment record exists yet. Awaiting initialization.',
      };
    case 'NotStarted':
      return {
        label: 'Not Started',
        badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
        dotClass: 'bg-slate-400',
        description: 'Fulfillment record initialized; awaiting processing or assignment.',
      };
    case 'Pending':
      return {
        label: 'Pending',
        badgeClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
        dotClass: 'bg-yellow-500',
        description: 'Queued and waiting for vendor API dispatch or manual assignment.',
      };
    case 'InProgress':
      return {
        label: 'In Progress',
        badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
        dotClass: 'bg-sky-500',
        description: 'Actively being processed by supplier or manual operator.',
      };
    case 'RequiresReview':
      return {
        label: 'Requires Review',
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-500',
        description: 'Ambiguous outcome requiring administrator review.',
      };
    case 'PartiallyCompleted':
      return {
        label: 'Partially Completed',
        badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
        dotClass: 'bg-violet-500',
        description: 'Partial quantity or service delivered.',
      };
    case 'Completed':
      return {
        label: 'Completed',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
        description: 'Full requested quantity confirmed fulfilled.',
      };
    case 'Failed':
      return {
        label: 'Failed',
        badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
        dotClass: 'bg-red-500',
        description: 'Fulfillment definitively failed.',
      };
    default:
      return {
        label: norm || 'Unknown',
        badgeClass: 'bg-muted/80 text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      };
  }
}

/**
 * Returns UI badge styling and human-readable label for parent order status.
 * Clearly separates Paid orders from active Processing orders.
 */
export function getParentOrderStatusBadgeInfo(
  status: string | null | undefined
): BadgeInfo {
  const norm = (status || '').trim();

  switch (norm) {
    case 'Paid':
      return {
        label: 'Paid',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
        description: 'Customer payment verified. Order not yet in processing.',
      };
    case 'Processing':
      return {
        label: 'Processing',
        badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
        dotClass: 'bg-indigo-500',
        description: 'Order actively being prepared for fulfillment.',
      };
    case 'Completed':
      return {
        label: 'Completed',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
        description: 'Order completed.',
      };
    case 'SentToVendor':
      return {
        label: 'Sent to Vendor',
        badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
        dotClass: 'bg-cyan-500',
      };
    case 'VendorProcessing':
      return {
        label: 'Vendor Processing',
        badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
        dotClass: 'bg-sky-500',
      };
    case 'PartiallyCompleted':
      return {
        label: 'Partially Completed',
        badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
        dotClass: 'bg-violet-500',
      };
    case 'Failed':
      return {
        label: 'Failed',
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-500',
      };
    case 'Cancelled':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
        dotClass: 'bg-slate-400',
      };
    case 'PendingPayment':
      return {
        label: 'Pending Payment',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-500',
      };
    case 'RefundPending':
      return {
        label: 'Refund Pending',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-500',
      };
    case 'Refunded':
      return {
        label: 'Refunded',
        badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
        dotClass: 'bg-orange-500',
      };
    default:
      return {
        label: norm || 'Unknown',
        badgeClass: 'bg-muted/80 text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      };
  }
}

/**
 * Returns UI badge styling and label for fulfillment delivery method.
 */
export function getFulfillmentMethodBadgeInfo(
  method: string | null | undefined
): BadgeInfo {
  const norm = (method || '').trim();

  switch (norm) {
    case 'Manual':
      return {
        label: 'Manual',
        badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
      };
    case 'VendorApi':
      return {
        label: 'Vendor API',
        badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      };
    case 'Unassigned':
      return {
        label: 'Unassigned',
        badgeClass: 'bg-muted/80 text-muted-foreground border-border',
      };
    default:
      return {
        label: norm || 'Unassigned',
        badgeClass: 'bg-muted/80 text-muted-foreground border-border',
      };
  }
}

/**
 * Returns UI badge styling and label for individual fulfillment attempt status.
 */
export function getAttemptStatusBadgeInfo(
  status: string | null | undefined
): BadgeInfo {
  const norm = (status || '').trim();

  switch (norm) {
    case 'Succeeded':
      return {
        label: 'Succeeded',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
      };
    case 'Submitted':
      return {
        label: 'Submitted',
        badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
        dotClass: 'bg-blue-500',
      };
    case 'NotStarted':
      return {
        label: 'Not Started',
        badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
        dotClass: 'bg-slate-400',
      };
    case 'ConfirmedFailed':
      return {
        label: 'Confirmed Failed',
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-500',
      };
    case 'Unknown':
      return {
        label: 'Unknown (Timeout)',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-500',
      };
    case 'RequiresReconciliation':
      return {
        label: 'Requires Reconciliation',
        badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
        dotClass: 'bg-purple-500',
      };
    default:
      return {
        label: norm || 'Unknown',
        badgeClass: 'bg-muted/80 text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      };
  }
}

/**
 * Formats ISO date string into readable administrator format.
 */
export function formatFulfillmentDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return dateString;
  }
}
