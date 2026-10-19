import { apiRequest, ApiClientError } from './api-client';

export type PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Expired'
  | 'Refunded'
  | 'PartiallyRefunded';

export type PaymentPurpose = 'OrderPurchase' | 'WalletTopUp';

export interface PaymentStatusHistoryDto {
  id: number;
  previousStatus?: string | null;
  newStatus: string;
  reason?: string | null;
  changedByUserId?: string | null;
  changedByUserName?: string | null;
  changedAt: string;
}

export interface AdminPaymentSummaryDto {
  id: number;
  paymentNumber: string;
  purpose: PaymentPurpose | string;
  customerId: string;
  customerFullName?: string | null;
  customerEmail?: string | null;
  orderNumber?: string | null;
  walletId?: number | null;
  amount: number;
  currency: string;
  paymentMethodCode: string;
  status: PaymentStatus | string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}

export interface AdminPaymentDetailDto {
  id: number;
  paymentNumber: string;
  purpose: PaymentPurpose | string;
  customerId: string;
  customerFullName?: string | null;
  customerEmail?: string | null;
  orderId?: number | null;
  orderNumber?: string | null;
  walletId?: number | null;
  amount: number;
  currency: string;
  paymentMethodCode: string;
  status: PaymentStatus | string;
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

export interface AdminPaymentQuery {
  page?: number;
  pageSize?: number;
  status?: PaymentStatus | string;
  purpose?: PaymentPurpose | string;
  paymentMethod?: string;
  search?: string;
}

export interface BadgeInfo {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Searches and retrieves a paginated overview of all customer payments across the platform.
 * Supports status, purpose, paymentMethod, customer search, and server-side pagination.
 * Strictly read-only GET.
 */
export async function getAdminPayments(
  query?: AdminPaymentQuery
): Promise<PagedResult<AdminPaymentSummaryDto>> {
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
  if (query?.purpose && query.purpose.trim() && query.purpose !== 'all') {
    params.set('purpose', query.purpose.trim());
  }
  if (query?.paymentMethod && query.paymentMethod.trim() && query.paymentMethod !== 'all') {
    params.set('paymentMethod', query.paymentMethod.trim());
  }
  if (query?.search && query.search.trim()) {
    params.set('search', query.search.trim());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/api/admin/payments?${queryString}` : '/api/admin/payments';

  const response = await apiRequest<PagedResult<AdminPaymentSummaryDto>>(endpoint, {
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
 * Retrieves safe, comprehensive administrative details of an individual payment by payment number.
 * Strictly read-only; path-encodes the paymentNumber parameter.
 */
export async function getAdminPaymentDetail(
  paymentNumber: string
): Promise<AdminPaymentDetailDto> {
  if (!paymentNumber || !paymentNumber.trim()) {
    throw new ApiClientError('Payment number is required.', 400);
  }

  const encoded = encodeURIComponent(paymentNumber.trim());
  const response = await apiRequest<AdminPaymentDetailDto>(
    `/api/admin/payments/${encoded}`,
    {
      method: 'GET',
      skipCsrf: true,
    }
  );

  if (!response.data) {
    throw new ApiClientError(
      response.message || `Payment '${paymentNumber}' was not found.`,
      404
    );
  }

  return response.data;
}

/**
 * Safely masks account numbers if not already masked, showing at most last 4 digits.
 */
export function maskAccountNumber(account?: string | null): string {
  if (!account || !account.trim()) {
    return '—';
  }
  const clean = account.trim();
  if (clean.startsWith('***')) {
    return clean;
  }
  if (clean.length <= 4) {
    return `***${clean}`;
  }
  return `***${clean.slice(-4)}`;
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
 * Returns purpose label and styling distinguishing OrderPurchase vs WalletTopUp.
 */
export function getPaymentPurposeBadge(purpose?: string | null): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (purpose) {
    case 'OrderPurchase':
      return {
        label: 'Order Purchase',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        dotClass: 'bg-blue-500',
      };
    case 'WalletTopUp':
      return {
        label: 'Wallet Top-Up',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        dotClass: 'bg-purple-500',
      };
    default:
      return {
        label: purpose || 'General Payment',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      };
  }
}

/**
 * Formats monetary amounts safely preserving decimal precision without floating point calculations.
 * Supports up to 4 decimal places for backend decimal(18,4) precision.
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
      return 'JazzCash';
    case 'EASYPAISA':
      return 'Easypaisa';
    case 'NAYAPAY':
      return 'NayaPay';
    case 'SADAPAY':
      return 'SadaPay';
    case 'WALLET':
      return 'Customer Wallet';
    case 'CRYPTO_BINANCE':
      return 'Binance Pay';
    case 'CRYPTO_USDT':
      return 'USDT Transfer';
    default:
      return methodCode;
  }
}
