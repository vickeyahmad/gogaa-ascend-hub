import { apiRequest, ApiClientError } from './api-client';

export type WalletTransactionType = 'Credit' | 'Debit';

export type WalletTransactionSourceType =
  | 'DepositVerification'
  | 'OrderPayment'
  | 'Refund'
  | 'AdminAdjustment'
  | 'CompensatingCorrection';

export interface AdminWalletSummaryDto {
  walletId: number;
  customerId: string;
  customerFullName?: string | null;
  customerEmail?: string | null;
  currentBalance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWalletTransactionDto {
  transactionId: number;
  walletId: number;
  transactionType: WalletTransactionType | string;
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  sourceType: WalletTransactionSourceType | string;
  sourceReferenceId?: string | null;
  description?: string | null;
  createdAt: string;
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

export interface AdminWalletQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  currency?: string;
}

export interface AdminWalletTransactionQuery {
  page?: number;
  pageSize?: number;
  transactionType?: WalletTransactionType | string;
  sourceType?: WalletTransactionSourceType | string;
}

export interface BadgeInfo {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Searches and retrieves a paginated overview of customer wallets.
 * Returns authoritative stored balances without recalculation, mutation, or wallet initialization.
 * Strictly read-only GET.
 */
export async function getAdminWallets(
  query?: AdminWalletQuery
): Promise<PagedResult<AdminWalletSummaryDto>> {
  const params = new URLSearchParams();

  if (query?.page && query.page > 0) {
    params.set('page', String(query.page));
  }
  if (query?.pageSize && query.pageSize > 0) {
    params.set('pageSize', String(query.pageSize));
  }
  if (query?.search && query.search.trim()) {
    params.set('search', query.search.trim());
  }
  if (query?.currency && query.currency.trim() && query.currency !== 'all') {
    params.set('currency', query.currency.trim());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/api/admin/wallets?${queryString}` : '/api/admin/wallets';

  const response = await apiRequest<PagedResult<AdminWalletSummaryDto>>(endpoint, {
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
 * Retrieves safe, paginated transaction history from the immutable ledger for a specific customer wallet.
 * Returns exact stored balances before and after each transaction.
 * Strictly read-only GET.
 */
export async function getAdminWalletTransactions(
  walletId: number,
  query?: AdminWalletTransactionQuery
): Promise<PagedResult<AdminWalletTransactionDto>> {
  if (!walletId || walletId <= 0) {
    throw new ApiClientError('Wallet ID must be a positive number.', 400);
  }

  const params = new URLSearchParams();

  if (query?.page && query.page > 0) {
    params.set('page', String(query.page));
  }
  if (query?.pageSize && query.pageSize > 0) {
    params.set('pageSize', String(query.pageSize));
  }
  if (query?.transactionType && query.transactionType.trim() && query.transactionType !== 'all') {
    params.set('transactionType', query.transactionType.trim());
  }
  if (query?.sourceType && query.sourceType.trim() && query.sourceType !== 'all') {
    params.set('sourceType', query.sourceType.trim());
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `/api/admin/wallets/${walletId}/transactions?${queryString}`
    : `/api/admin/wallets/${walletId}/transactions`;

  const response = await apiRequest<PagedResult<AdminWalletTransactionDto>>(endpoint, {
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
 * Formats wallet balance safely preserving stored decimal precision without floating point calculations.
 * Supports up to 4 decimal places for backend decimal(18,4) precision.
 */
export function formatWalletBalance(balance?: number | string | null, currency = 'PKR'): string {
  if (balance === undefined || balance === null || balance === '') {
    return `0.00 ${currency}`;
  }
  const numeric = typeof balance === 'number' ? balance : parseFloat(String(balance));
  if (isNaN(numeric)) {
    return `0.00 ${currency}`;
  }
  return `${numeric.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${currency}`;
}

/**
 * Returns badge label and visual styling classes for transaction types (Credit vs Debit).
 */
export function getTransactionTypeBadge(type?: string | null): BadgeInfo & { prefix: string } {
  switch (type) {
    case 'Credit':
      return {
        label: 'Credit',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
        prefix: '+',
      };
    case 'Debit':
      return {
        label: 'Debit',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-500',
        prefix: '−',
      };
    default:
      return {
        label: type || 'Unknown',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
        prefix: '',
      };
  }
}

/**
 * Returns friendly label and badge styling for transaction source categories.
 */
export function getTransactionSourceBadge(source?: string | null): {
  label: string;
  badgeClass: string;
} {
  switch (source) {
    case 'DepositVerification':
      return {
        label: 'Deposit Verification',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      };
    case 'OrderPayment':
      return {
        label: 'Order Payment',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      };
    case 'Refund':
      return {
        label: 'Refund',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      };
    case 'AdminAdjustment':
      return {
        label: 'Admin Adjustment',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      };
    case 'CompensatingCorrection':
      return {
        label: 'Compensating Correction',
        badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      };
    default:
      return {
        label: source || 'General Source',
        badgeClass: 'bg-muted text-muted-foreground border-border',
      };
  }
}

/**
 * Formats ISO timestamps into human-readable local time strings.
 */
export function formatWalletDate(dateStr?: string | null): string {
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
