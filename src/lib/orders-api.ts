import { apiRequest, ApiClientError } from './api-client';

export type OrderStatus =
  | 'PendingPayment'
  | 'Paid'
  | 'Processing'
  | 'SentToVendor'
  | 'VendorProcessing'
  | 'Completed'
  | 'PartiallyCompleted'
  | 'Failed'
  | 'Cancelled'
  | 'RefundPending'
  | 'Refunded';

export type SalesChannel = 'Website' | 'Telegram' | 'Smm' | 'Admin';

export type PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Expired'
  | 'Refunded'
  | 'PartiallyRefunded';

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminOrderQuery {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | string;
  salesChannel?: SalesChannel | string;
  customerQuery?: string;
  orderNumber?: string;
  productSku?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AdminOrderPaymentSummaryDto {
  paymentNumber?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  amountPaid?: number | null;
  currency?: string | null;
  paidAt?: string | null;
}

export interface AdminOrderSummaryDto {
  orderNumber: string;
  orderId: number;
  customerId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  productSummary: string;
  itemCount: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus | string;
  salesChannel: SalesChannel | string;
  createdAt: string;
  updatedAt: string;
  paymentSummary?: AdminOrderPaymentSummaryDto | null;
}

export interface AdminOrderItemDto {
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
}

export interface AdminOrderStatusHistoryDto {
  id: number;
  previousStatus?: string | null;
  newStatus: string;
  reason?: string | null;
  changedByUserId?: string | null;
  changedAt: string;
}

export interface AdminOrderPaymentDto {
  paymentNumber: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  createdAt: string;
  paidAt?: string | null;
  expiredAt?: string | null;
  providerTransactionId?: string | null;
}

export interface AdminOrderDetailDto {
  orderNumber: string;
  orderId: number;
  customerId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhoneNumber?: string | null;
  salesChannel: SalesChannel | string;
  status: OrderStatus | string;
  subtotal: number;
  totalAmount: number;
  currency: string;
  customerNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItemDto[];
  statusHistory: AdminOrderStatusHistoryDto[];
  payments: AdminOrderPaymentDto[];
}

/**
 * Searches and retrieves a paginated list of customer orders across all sales channels.
 * Uses query parameters matching backend AdminOrderQuery.
 */
export async function getAdminOrders(
  query?: AdminOrderQuery
): Promise<PagedResult<AdminOrderSummaryDto>> {
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
  if (query?.salesChannel && query.salesChannel.trim() && query.salesChannel !== 'all') {
    params.set('salesChannel', query.salesChannel.trim());
  }
  if (query?.customerQuery && query.customerQuery.trim()) {
    params.set('customerQuery', query.customerQuery.trim());
  }
  if (query?.orderNumber && query.orderNumber.trim()) {
    params.set('orderNumber', query.orderNumber.trim());
  }
  if (query?.productSku && query.productSku.trim()) {
    params.set('productSku', query.productSku.trim());
  }
  if (query?.fromDate && query.fromDate.trim()) {
    params.set('fromDate', query.fromDate.trim());
  }
  if (query?.toDate && query.toDate.trim()) {
    params.set('toDate', query.toDate.trim());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/api/admin/orders?${queryString}` : '/api/admin/orders';

  const response = await apiRequest<PagedResult<AdminOrderSummaryDto>>(endpoint, {
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
 * Retrieves comprehensive order details including customer summary, line item historical
 * price snapshots, complete status audit trail, and associated OrderPurchase payment attempts.
 * Uses path encoding for the orderNumber.
 */
export async function getAdminOrderDetail(orderNumber: string): Promise<AdminOrderDetailDto> {
  if (!orderNumber || !orderNumber.trim()) {
    throw new ApiClientError('Order number is required.', 400);
  }

  const encoded = encodeURIComponent(orderNumber.trim());
  const response = await apiRequest<AdminOrderDetailDto>(`/api/admin/orders/${encoded}`, {
    method: 'GET',
    skipCsrf: true,
  });

  if (!response.data) {
    throw new ApiClientError(
      response.message || `Order '${orderNumber}' was not found.`,
      404
    );
  }

  return response.data;
}

/**
 * Formats a currency amount into a clean, human-readable display string.
 */
export function formatOrderPrice(amount: number, currency: string = 'PKR'): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `0.00 ${currency}`;
  }
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

/**
 * Formats an ISO date string into human-readable date & time.
 */
export function formatOrderDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return dateString;
  }
}

export interface BadgeInfo {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Returns badge label and visual styling classes for OrderStatus values.
 */
export function getOrderStatusBadgeInfo(status?: string | null): BadgeInfo {
  switch (status) {
    case 'PendingPayment':
      return {
        label: 'Awaiting Payment',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-500',
      };
    case 'Paid':
      return {
        label: 'Paid',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
      };
    case 'Processing':
      return {
        label: 'Processing',
        badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        dotClass: 'bg-sky-500',
      };
    case 'SentToVendor':
      return {
        label: 'Sent to Vendor',
        badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        dotClass: 'bg-indigo-500',
      };
    case 'VendorProcessing':
      return {
        label: 'Vendor Processing',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        dotClass: 'bg-purple-500',
      };
    case 'Completed':
      return {
        label: 'Completed',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-500',
      };
    case 'PartiallyCompleted':
      return {
        label: 'Partially Completed',
        badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
        dotClass: 'bg-teal-500',
      };
    case 'Failed':
      return {
        label: 'Failed',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-500',
      };
    case 'Cancelled':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
        dotClass: 'bg-zinc-500',
      };
    case 'RefundPending':
      return {
        label: 'Refund Pending',
        badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        dotClass: 'bg-orange-500',
      };
    case 'Refunded':
      return {
        label: 'Refunded',
        badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
        dotClass: 'bg-violet-500',
      };
    default:
      return {
        label: status || 'Unknown',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      };
  }
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
        label: status ? status : 'No Payment',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
      };
  }
}

/**
 * Returns channel label and badge styling for SalesChannel values.
 */
export function getSalesChannelBadgeInfo(channel?: string | null): { label: string; badgeClass: string } {
  switch (channel) {
    case 'Website':
      return {
        label: 'Web Storefront',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      };
    case 'Telegram':
      return {
        label: 'Telegram Bot',
        badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      };
    case 'Smm':
      return {
        label: 'SMM Panel',
        badgeClass: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20',
      };
    case 'Admin':
      return {
        label: 'Admin Manual',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      };
    default:
      return {
        label: channel || 'Unknown Channel',
        badgeClass: 'bg-muted text-muted-foreground border-border',
      };
  }
}
