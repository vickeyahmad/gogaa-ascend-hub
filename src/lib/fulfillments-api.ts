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

export interface AdminCompleteManualFulfillmentRequest {
  confirmDelivered: boolean;
  deliveryReference: string;
  deliveryChannel: string;
  notes?: string | null;
}

export const APPROVED_DELIVERY_CHANNELS = [
  'EmailSupport',
  'WhatsAppDirect',
  'TelegramManual',
  'InternalPortal',
] as const;

export type ApprovedDeliveryChannel = (typeof APPROVED_DELIVERY_CHANNELS)[number];

export const APPROVED_REFERENCE_PREFIXES = [
  'TICKET-',
  'DISPATCH-',
  'MSG-',
  'PORTAL-',
  'REF-',
] as const;

export const APPROVED_OPERATIONAL_NOTES = [
  'Standard delivery completed.',
  'Delivered via authorized customer channel.',
  'Delivered via authorized customer care agent.',
  'Customer confirmed receipt.',
  'Account access transferred directly to customer.',
  'Manual verification completed.',
  'Replacement delivery issued.',
  'Audit verification complete.',
  'Standard authorized dispatch procedure completed.',
] as const;

export function validateDeliveryReference(reference: string | null | undefined): {
  isValid: boolean;
  errorMessage?: string;
  normalized: string;
} {
  const trimmed = reference?.trim() ?? '';
  if (!trimmed) {
    return {
      isValid: false,
      errorMessage: 'A valid external delivery reference or support ticket identifier is required.',
      normalized: '',
    };
  }

  if (trimmed.includes('<') || trimmed.includes('>')) {
    return {
      isValid: false,
      errorMessage: 'DeliveryReference contains invalid characters.',
      normalized: '',
    };
  }

  const ambiguous = [
    'N/A', 'NA', 'NONE', 'NULL', '0000', '1111', '1234', 'TEST', 'DEMO', 'SAMPLE', 'DELIVERED', 'DONE', 'OK', 'COMPLETED',
  ];
  if (ambiguous.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
    return {
      isValid: false,
      errorMessage: "Ambiguous placeholders (e.g. 'N/A', 'TEST', '0000', 'NONE') are not permitted as delivery references.",
      normalized: '',
    };
  }

  const hasPrefix = APPROVED_REFERENCE_PREFIXES.some((p) =>
    trimmed.toUpperCase().startsWith(p.toUpperCase())
  );
  if (!hasPrefix) {
    return {
      isValid: false,
      errorMessage: `DeliveryReference must begin with an approved controlled prefix (${APPROVED_REFERENCE_PREFIXES.join(', ')}).`,
      normalized: '',
    };
  }

  if (trimmed.length < 5 || trimmed.length > 100) {
    return {
      isValid: false,
      errorMessage: 'A valid external delivery reference between 5 and 100 characters is required.',
      normalized: '',
    };
  }

  const formatRegex = /^[A-Za-z0-9][A-Za-z0-9_.:#-]{2,99}$/;
  if (!formatRegex.test(trimmed)) {
    return {
      isValid: false,
      errorMessage:
        'DeliveryReference must be a structured identifier (alphanumeric characters, hyphens, colons, dots, or underscores without spaces).',
      normalized: '',
    };
  }

  return {
    isValid: true,
    normalized: trimmed,
  };
}

/**
 * Classifies whether an error encountered during a fulfillment mutation (Start or Complete)
 * is ambiguous (i.e. uncertainty exists as to whether the backend received and processed the request).
 *
 * Ambiguous cases include:
 * - Network drops, connection resets, client timeout, fetch failure, browser abort (status 0)
 * - HTTP 408 Request Timeout
 * - HTTP 500 Internal Server Error (server may have committed before crash or during response generation)
 * - HTTP 502 Bad Gateway (reverse proxy or cloud gateway lost upstream connection)
 * - HTTP 503 Service Unavailable (service overloaded, request may have reached worker)
 * - HTTP 504 Gateway Timeout (upstream server timed out; transaction may have succeeded in DB)
 * - Any other HTTP 5xx server errors
 *
 * Definite client rejections (status 400, 401, 403, 404, 409, 422) are non-ambiguous where the
 * backend contract establishes that the mutation was rejected without modifying state.
 */
export function isAmbiguousFulfillmentError(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    if (err.status === 0 || err.status === 408) {
      return true;
    }
    if (err.status >= 500 && err.status < 600) {
      return true;
    }
    return false;
  }
  if (err instanceof TypeError) {
    // Standard browser fetch network failure / aborted request throws TypeError
    return true;
  }
  if (
    typeof DOMException !== 'undefined' &&
    err instanceof DOMException &&
    err.name === 'AbortError'
  ) {
    return true;
  }
  return false;
}

export interface UnresolvedFulfillmentOperation {
  orderNumber: string;
  orderItemId: number;
  operationType: 'start' | 'complete';
  attemptNumber?: number;
  recordedAt: string;
  errorSummary: string;
}

const UNRESOLVED_OPS_STORAGE_KEY = 'gogaa_unresolved_manual_fulfillments';
const inMemoryUnresolvedOps = new Map<string, UnresolvedFulfillmentOperation>();

function buildOperationKey(
  orderNumber: string,
  orderItemId: number,
  operationType: 'start' | 'complete'
): string {
  return `${orderNumber.trim().toUpperCase()}:${orderItemId}:${operationType}`;
}

function loadUnresolvedOpsFromSession(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const raw = window.sessionStorage.getItem(UNRESOLVED_OPS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.orderNumber && item.orderItemId && item.operationType) {
          const key = buildOperationKey(item.orderNumber, item.orderItemId, item.operationType);
          inMemoryUnresolvedOps.set(key, item);
        }
      }
    }
  } catch {
    // Session storage read failure or parse error; fallback to in-memory map
  }
}

function saveUnresolvedOpsToSession(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const array = Array.from(inMemoryUnresolvedOps.values());
    window.sessionStorage.setItem(UNRESOLVED_OPS_STORAGE_KEY, JSON.stringify(array));
  } catch {
    // Session storage write failure (quota exceeded or disabled)
  }
}

// Initialize on module load
loadUnresolvedOpsFromSession();

/**
 * Persists an unresolved ambiguous fulfillment operation to prevent duplicate clicks across modal open/close
 * and SPA route navigations within the session.
 * Stores ZERO sensitive data (no tokens, passwords, customer emails, delivery credentials).
 */
export function markUnresolvedOperation(op: UnresolvedFulfillmentOperation): void {
  const key = buildOperationKey(op.orderNumber, op.orderItemId, op.operationType);
  inMemoryUnresolvedOps.set(key, op);
  saveUnresolvedOpsToSession();
}

/**
 * Retrieves a persistent unresolved operation marker for a specific order line item and operation type.
 */
export function getUnresolvedOperation(
  orderNumber: string | null | undefined,
  orderItemId: number | null | undefined,
  operationType: 'start' | 'complete'
): UnresolvedFulfillmentOperation | null {
  if (!orderNumber || !orderItemId) return null;
  loadUnresolvedOpsFromSession();
  const key = buildOperationKey(orderNumber, orderItemId, operationType);
  return inMemoryUnresolvedOps.get(key) || null;
}

/**
 * Clears an unresolved operation marker ONLY when authoritative backend evidence demonstrates
 * that the operation transitioned or was completed.
 */
export function clearUnresolvedOperation(
  orderNumber: string | null | undefined,
  orderItemId: number | null | undefined,
  operationType: 'start' | 'complete'
): void {
  if (!orderNumber || !orderItemId) return;
  const key = buildOperationKey(orderNumber, orderItemId, operationType);
  inMemoryUnresolvedOps.delete(key);
  saveUnresolvedOpsToSession();
}

/**
 * Returns all currently recorded unresolved fulfillment operations.
 */
export function getAllUnresolvedOperations(): UnresolvedFulfillmentOperation[] {
  loadUnresolvedOpsFromSession();
  return Array.from(inMemoryUnresolvedOps.values());
}

/**
 * Test helper to clear unresolved operation markers between test runs.
 */
export function clearAllUnresolvedOperationsForTesting(): void {
  inMemoryUnresolvedOps.clear();
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(UNRESOLVED_OPS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export interface AdminFulfillmentCapabilitiesDto {
  isGloballyEnabled: boolean;
  hasProductAllowlistPolicy: boolean;
  approvedProductCount: number;
  isEffectivelyAvailable: boolean;
  statusMessage: string;
  isProductApproved?: boolean | null;
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
 * Explicit administrator operation to initiate manual fulfillment for a specific line item on a Processing order.
 * Sends POST /api/admin/orders/{orderNumber}/items/{orderItemId}/manual-fulfillment/start.
 * Protected by administrator role authorization and CSRF.
 * Never automatically retried on ambiguous failures.
 */
export async function startManualFulfillment(
  orderNumber: string,
  orderItemId: number
): Promise<AdminFulfillmentDto> {
  if (!orderNumber || !orderNumber.trim()) {
    throw new ApiClientError('Order number is required.', 400);
  }
  if (!orderItemId || orderItemId <= 0 || !Number.isInteger(orderItemId)) {
    throw new ApiClientError('A valid order item ID is required.', 400);
  }

  const encodedOrder = encodeURIComponent(orderNumber.trim());
  const response = await apiRequest<AdminFulfillmentDto>(
    `/api/admin/orders/${encodedOrder}/items/${orderItemId}/manual-fulfillment/start`,
    {
      method: 'POST',
    }
  );

  if (!response.data) {
    throw new ApiClientError(
      response.message || 'Failed to start manual fulfillment.',
      500
    );
  }

  return response.data;
}

/**
 * Explicit administrator operation to confirm manual fulfillment completion after delivery via an external process.
 * Sends POST /api/admin/orders/{orderNumber}/items/{orderItemId}/manual-fulfillment/complete with evidence payload.
 * Protected by administrator role authorization and CSRF.
 * Never automatically retried on ambiguous failures.
 */
export async function completeManualFulfillment(
  orderNumber: string,
  orderItemId: number,
  request: AdminCompleteManualFulfillmentRequest
): Promise<AdminFulfillmentDto> {
  if (!orderNumber || !orderNumber.trim()) {
    throw new ApiClientError('Order number is required.', 400);
  }
  if (!orderItemId || orderItemId <= 0 || !Number.isInteger(orderItemId)) {
    throw new ApiClientError('A valid order item ID is required.', 400);
  }
  if (!request) {
    throw new ApiClientError('Fulfillment completion request is required.', 400);
  }
  if (!request.confirmDelivered) {
    throw new ApiClientError(
      'Explicit confirmation of delivery (ConfirmDelivered = true) is strictly required.',
      400
    );
  }

  const refCheck = validateDeliveryReference(request.deliveryReference);
  if (!refCheck.isValid) {
    throw new ApiClientError(refCheck.errorMessage || 'Invalid delivery reference.', 400);
  }

  const channel = (request.deliveryChannel || '').trim();
  const isApprovedChannel = APPROVED_DELIVERY_CHANNELS.some(
    (c) => c.toLowerCase() === channel.toLowerCase()
  );
  if (!isApprovedChannel) {
    throw new ApiClientError(
      `Invalid delivery channel. Approved channels are: ${APPROVED_DELIVERY_CHANNELS.join(', ')}.`,
      400
    );
  }

  if (request.notes && request.notes.trim()) {
    const trimmedNote = request.notes.trim();
    const isApprovedNote = APPROVED_OPERATIONAL_NOTES.some(
      (n) => n.toLowerCase() === trimmedNote.toLowerCase()
    );
    if (!isApprovedNote) {
      throw new ApiClientError(
        'Arbitrary free-text notes are prohibited during controlled pilot. Notes must be omitted or selected from approved operational options.',
        400
      );
    }
  }

  const encodedOrder = encodeURIComponent(orderNumber.trim());
  const response = await apiRequest<AdminFulfillmentDto>(
    `/api/admin/orders/${encodedOrder}/items/${orderItemId}/manual-fulfillment/complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        confirmDelivered: true,
        deliveryReference: refCheck.normalized,
        deliveryChannel: request.deliveryChannel.trim(),
        notes: request.notes?.trim() ? request.notes.trim() : null,
      }),
    }
  );

  if (!response.data) {
    throw new ApiClientError(
      response.message || 'Failed to complete manual fulfillment.',
      500
    );
  }

  return response.data;
}

/**
 * Retrieves operational capabilities and feature availability for administrative fulfillment workflows.
 * Strictly read-only GET.
 */
export async function getAdminFulfillmentCapabilities(
  productSku?: string
): Promise<AdminFulfillmentCapabilitiesDto> {
  let endpoint = '/api/admin/fulfillment-capabilities';
  if (productSku && productSku.trim()) {
    const params = new URLSearchParams();
    params.set('productSku', productSku.trim());
    endpoint = `${endpoint}?${params.toString()}`;
  }

  const response = await apiRequest<AdminFulfillmentCapabilitiesDto>(endpoint, {
    method: 'GET',
    skipCsrf: true,
  });

  if (!response.data) {
    throw new ApiClientError(
      response.message || 'Failed to retrieve fulfillment capabilities.',
      500
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
