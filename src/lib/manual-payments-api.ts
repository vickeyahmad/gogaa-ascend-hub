import { apiRequest, ApiClientError } from './api-client';

export type PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Expired'
  | 'Refunded'
  | 'PartiallyRefunded';

export interface PaymentStatusHistoryDto {
  id: number;
  previousStatus?: string | null;
  newStatus: string;
  reason?: string | null;
  changedByUserId?: string | null;
  changedByUserName?: string | null;
  changedAt: string;
}

export interface AdminManualPaymentDto {
  id: number;
  paymentNumber: string;
  purpose: string;
  walletId?: number | null;
  orderId?: number | null;
  customerId: string;
  customerEmail?: string | null;
  customerFullName?: string | null;
  amount: number;
  currency: string;
  paymentMethodCode: string;
  status: PaymentStatus | string;
  idempotencyKey?: string | null;
  providerTransactionId?: string | null;
  customerReference?: string | null;
  customerTransferDate?: string | null;
  customerSenderAccount?: string | null;
  customerNotes?: string | null;
  customerProofSubmittedAt?: string | null;
  verifiedByUserId?: string | null;
  verifiedByUserName?: string | null;
  verifiedReceivingAccount?: string | null;
  adminNotes?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  statusHistory: PaymentStatusHistoryDto[];
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

export interface AdminManualPaymentQuery {
  page?: number;
  pageSize?: number;
  status?: PaymentStatus | string;
}

export interface BadgeInfo {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Searches and retrieves a paginated list of manual wallet top-up payment reviews from backend.
 * Uses query parameters matching backend AdminManualPaymentsController (status, page, pageSize).
 * Does not invent unsupported server-side search or filter parameters.
 */
export async function getAdminManualPayments(
  query?: AdminManualPaymentQuery
): Promise<PagedResult<AdminManualPaymentDto>> {
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

  const queryString = params.toString();
  const endpoint = queryString ? `/api/admin/payments/manual?${queryString}` : '/api/admin/payments/manual';

  const response = await apiRequest<PagedResult<AdminManualPaymentDto>>(endpoint, {
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
 * Retrieves comprehensive details and audit history for a single manual payment attempt.
 * Strictly read-only; path-encodes the paymentNumber parameter.
 */
export async function getAdminManualPaymentDetail(
  paymentNumber: string
): Promise<AdminManualPaymentDto> {
  if (!paymentNumber || !paymentNumber.trim()) {
    throw new ApiClientError('Payment number is required.', 400);
  }

  const encoded = encodeURIComponent(paymentNumber.trim());
  const response = await apiRequest<AdminManualPaymentDto>(
    `/api/admin/payments/manual/${encoded}`,
    {
      method: 'GET',
      skipCsrf: true,
    }
  );

  if (!response.data) {
    throw new ApiClientError(
      response.message || `Manual payment '${paymentNumber}' was not found.`,
      404
    );
  }

  return response.data;
}

/**
 * Masks customer banking account identifiers to protect sensitive financial privacy.
 * Shows only the last 4 digits prefixed by a privacy mask.
 */
export function maskAccountNumber(account?: string | null): string {
  if (!account || !account.trim()) {
    return '—';
  }
  const clean = account.trim();
  if (clean.length <= 4) {
    return `•••• ${clean}`;
  }
  const lastFour = clean.slice(-4);
  return `•••• ${lastFour}`;
}

/**
 * Masks internal receiving bank account numbers while preserving short account aliases/codes.
 * If the account contains sensitive numeric sequences or IBANs, sensitive characters are masked.
 */
export function maskReceivingAccount(account?: string | null): string {
  if (!account || !account.trim()) {
    return '—';
  }
  const clean = account.trim();
  if (/^\d{5,}$/.test(clean)) {
    return `•••• ${clean.slice(-4)}`;
  }
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,}$/i.test(clean)) {
    return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
  }
  return clean;
}

/**
 * Returns badge label and visual styling classes for PaymentStatus values.
 */
export function getPaymentStatusBadgeInfo(status?: string | null): BadgeInfo {
  switch (status) {
    case 'Pending':
      return {
        label: 'Pending',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-500',
      };
    case 'Paid':
      return {
        label: 'Paid',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
      };
    case 'Failed':
      return {
        label: 'Failed',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-500',
      };
    case 'Expired':
      return {
        label: 'Expired',
        badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
        dotClass: 'bg-zinc-500',
      };
    case 'Refunded':
      return {
        label: 'Refunded',
        badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
        dotClass: 'bg-violet-500',
      };
    case 'PartiallyRefunded':
      return {
        label: 'Partially Refunded',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        dotClass: 'bg-blue-500',
      };
    default:
      return {
        label: status || 'Unknown Status',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      };
  }
}

/**
 * Formats monetary amounts safely preserving decimal precision without floating point calculations.
 */
export function formatPaymentAmount(amount?: number | string | null, currency = 'PKR'): string {
  if (amount === undefined || amount === null || amount === '') {
    return `0.00 ${currency}`;
  }
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(numeric)) {
    return `0.00 ${currency}`;
  }
  return `${numeric.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${currency}`;
}

/**
 * Formats ISO timestamps into human-readable local time strings.
 */
export function formatPaymentDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats standard payment method codes into friendly presentation labels.
 */
export function formatPaymentMethod(methodCode?: string | null): string {
  if (!methodCode) return '—';
  switch (methodCode.toUpperCase()) {
    case 'BANK_TRANSFER':
      return 'Bank Transfer';
    case 'JAZZCASH':
      return 'JazzCash Manual';
    case 'EASYPAISA':
      return 'Easypaisa Manual';
    case 'RAAST':
      return 'Raast Instant';
    default:
      return methodCode;
  }
}
