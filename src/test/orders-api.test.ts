import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAdminOrders,
  getAdminOrderDetail,
  startOrderProcessing,
  validateProcessingReason,
  formatOrderPrice,
  formatOrderDate,
  getOrderStatusBadgeInfo,
  getPaymentStatusBadgeInfo,
  getSalesChannelBadgeInfo,
  type AdminOrderSummaryDto,
  type AdminOrderDetailDto,
  type AdminStartOrderProcessingRequest,
} from '../lib/orders-api';
import { ApiClientError, setInMemoryCsrfToken } from '../lib/api-client';

const mockSummaryItem: AdminOrderSummaryDto = {
  orderNumber: 'ORD-20261018-0001',
  orderId: 101,
  customerId: 'cust-uuid-1',
  customerEmail: 'alice@example.com',
  customerName: 'Alice Johnson',
  productSummary: 'CHATGPT_PLUS_1M (1)',
  itemCount: 1,
  totalAmount: 1600,
  currency: 'PKR',
  status: 'Paid',
  salesChannel: 'Website',
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:05:00Z',
  paymentSummary: {
    paymentNumber: 'PAY-20261018-001',
    paymentMethod: 'CustomerWallet',
    paymentStatus: 'Paid',
    amountPaid: 1600,
    currency: 'PKR',
    paidAt: '2026-10-18T10:05:00Z',
  },
};

const mockOrderDetail: AdminOrderDetailDto = {
  orderNumber: 'ORD-20261018-0001',
  orderId: 101,
  customerId: 'cust-uuid-1',
  customerEmail: 'alice@example.com',
  customerName: 'Alice Johnson',
  customerPhoneNumber: '+923001234567',
  salesChannel: 'Website',
  status: 'Paid',
  subtotal: 1600,
  totalAmount: 1600,
  currency: 'PKR',
  customerNotes: 'Please deliver promptly.',
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:05:00Z',
  items: [
    {
      productSku: 'CHATGPT_PLUS_1M',
      productName: 'ChatGPT Plus 1 Month',
      quantity: 1,
      unitPrice: 1600,
      totalPrice: 1600,
      currency: 'PKR',
    },
  ],
  statusHistory: [
    {
      id: 1,
      previousStatus: null,
      newStatus: 'PendingPayment',
      reason: 'Order created',
      changedByUserId: null,
      changedAt: '2026-10-18T10:00:00Z',
    },
    {
      id: 2,
      previousStatus: 'PendingPayment',
      newStatus: 'Paid',
      reason: 'Payment verified via wallet',
      changedByUserId: 'SYSTEM',
      changedAt: '2026-10-18T10:05:00Z',
    },
  ],
  payments: [
    {
      paymentNumber: 'PAY-20261018-001',
      paymentMethod: 'CustomerWallet',
      amount: 1600,
      currency: 'PKR',
      status: 'Paid',
      createdAt: '2026-10-18T10:01:00Z',
      paidAt: '2026-10-18T10:05:00Z',
      expiredAt: null,
      providerTransactionId: 'WLT-TX-99881',
    },
  ],
};

describe('Orders API Client & Helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdminOrders', () => {
    it('calls /api/admin/orders without parameters when no filters are provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Orders retrieved successfully.',
            data: {
              items: [mockSummaryItem],
              page: 1,
              pageSize: 20,
              totalCount: 1,
              totalPages: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await getAdminOrders();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].orderNumber).toBe('ORD-20261018-0001');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/orders',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('builds full query string with all supported filters', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Orders retrieved.',
            data: {
              items: [mockSummaryItem],
              page: 2,
              pageSize: 10,
              totalCount: 15,
              totalPages: 2,
              hasPreviousPage: true,
              hasNextPage: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await getAdminOrders({
        page: 2,
        pageSize: 10,
        status: 'Paid',
        salesChannel: 'Website',
        customerQuery: 'alice',
        orderNumber: 'ORD-20261018',
        productSku: 'CHATGPT',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
      });

      expect(result.page).toBe(2);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/orders?page=2&pageSize=10&status=Paid&salesChannel=Website&customerQuery=alice&orderNumber=ORD-20261018&productSku=CHATGPT&fromDate=2026-10-01&toDate=2026-10-31',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('ignores empty strings and "all" sentinel values in query', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [],
              page: 1,
              pageSize: 20,
              totalCount: 0,
              totalPages: 0,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await getAdminOrders({
        status: 'all',
        salesChannel: 'all',
        customerQuery: '   ',
        orderNumber: '',
        productSku: '',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/orders',
        expect.any(Object)
      );
    });

    it('throws ApiClientError when server responds with 401 or 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Unauthorized administrative access.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(getAdminOrders()).rejects.toThrow(ApiClientError);
    });
  });

  describe('getAdminOrderDetail', () => {
    it('throws client-side error when orderNumber is empty or whitespace', async () => {
      await expect(getAdminOrderDetail('')).rejects.toThrow(
        'Order number is required.'
      );
      await expect(getAdminOrderDetail('   ')).rejects.toThrow(
        'Order number is required.'
      );
    });

    it('retrieves order detail and encodes order number in path', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Order details retrieved successfully.',
            data: mockOrderDetail,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await getAdminOrderDetail('ORD/2026 0001');

      expect(result.orderNumber).toBe('ORD-20261018-0001');
      expect(result.items).toHaveLength(1);
      expect(result.statusHistory).toHaveLength(2);
      expect(result.payments).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/orders/ORD%2F2026%200001',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('propagates 404 error when order does not exist', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: "Order 'ORD-NONEXISTENT' was not found.",
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(getAdminOrderDetail('ORD-NONEXISTENT')).rejects.toThrow(
        "Order 'ORD-NONEXISTENT' was not found."
      );
    });
  });

  describe('validateProcessingReason', () => {
    it('allows undefined, null, empty string, or whitespace', () => {
      expect(validateProcessingReason(undefined)).toBeNull();
      expect(validateProcessingReason(null)).toBeNull();
      expect(validateProcessingReason('')).toBeNull();
      expect(validateProcessingReason('   ')).toBeNull();
    });

    it('allows valid note within 500 characters', () => {
      expect(validateProcessingReason('Customer confirmed payment')).toBeNull();
      const exactly500 = 'a'.repeat(500);
      expect(validateProcessingReason(exactly500)).toBeNull();
    });

    it('rejects notes exceeding 500 characters', () => {
      const tooLong = 'a'.repeat(501);
      expect(validateProcessingReason(tooLong)).toBe(
        'Processing reason cannot exceed 500 characters.'
      );
    });
  });

  describe('startOrderProcessing', () => {
    it('throws ApiClientError if orderNumber is empty or whitespace', async () => {
      await expect(startOrderProcessing('')).rejects.toThrow(
        'Order number is required.'
      );
      await expect(startOrderProcessing('   ')).rejects.toThrow(
        'Order number is required.'
      );
    });

    it('throws ApiClientError if reason exceeds 500 characters', async () => {
      await expect(
        startOrderProcessing('ORD-20261018-0001', { reason: 'x'.repeat(501) })
      ).rejects.toThrow('Processing reason cannot exceed 500 characters.');
    });

    it('properly encodes orderNumber and sends POST with CSRF and payload', async () => {
      setInMemoryCsrfToken('mock-xsrf-token-orders');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Order processing started.',
            data: {
              ...mockOrderDetail,
              status: 'Processing',
              statusHistory: [
                ...mockOrderDetail.statusHistory,
                {
                  id: 3,
                  previousStatus: 'Paid',
                  newStatus: 'Processing',
                  reason: 'Admin started processing',
                  changedByUserId: 'admin-user-1',
                  changedAt: '2026-10-18T10:10:00Z',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await startOrderProcessing('ORD/2026 0001', {
        reason: 'Admin started processing',
      });

      expect(result.status).toBe('Processing');
      expect(result.statusHistory).toHaveLength(3);
      expect(fetchSpy).toHaveBeenCalled();
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toBe('/api/admin/orders/ORD%2F2026%200001/start-processing');
      expect(call[1]?.method).toBe('POST');
      expect(call[1]?.body).toBe(JSON.stringify({ reason: 'Admin started processing' }));
      const headers = call[1]?.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('X-XSRF-TOKEN')).toBe('mock-xsrf-token-orders');
    });

    it('sends empty object in body when reason is not provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { ...mockOrderDetail, status: 'Processing' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await startOrderProcessing('ORD-20261018-0001');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/orders/ORD-20261018-0001/start-processing',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('propagates 400 BadRequest when order is not in Paid status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: "Cannot start processing. Current status is 'PendingPayment'. Only 'Paid' orders can be processed.",
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        startOrderProcessing('ORD-20261018-0001')
      ).rejects.toThrow(
        "Cannot start processing. Current status is 'PendingPayment'. Only 'Paid' orders can be processed."
      );
    });

    it('propagates 409 Conflict when order is concurrently transitioned or already in processing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: "Order 'ORD-20261018-0001' is already in Processing status or was modified concurrently.",
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        startOrderProcessing('ORD-20261018-0001')
      ).rejects.toThrow(
        "Order 'ORD-20261018-0001' is already in Processing status or was modified concurrently."
      );
    });

    it('propagates 404 NotFound when order does not exist', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            message: "Order 'NONEXISTENT' was not found.",
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        startOrderProcessing('NONEXISTENT')
      ).rejects.toThrow("Order 'NONEXISTENT' was not found.");
    });
  });

  describe('Formatting & Badge Helpers', () => {
    describe('formatOrderPrice', () => {
      it('formats valid numbers with commas and 2 decimals', () => {
        expect(formatOrderPrice(1600)).toBe('1,600.00 PKR');
        expect(formatOrderPrice(2500000.5, 'PKR')).toBe('2,500,000.50 PKR');
        expect(formatOrderPrice(0)).toBe('0.00 PKR');
      });

      it('safely handles NaN and null/undefined values', () => {
        expect(formatOrderPrice(NaN)).toBe('0.00 PKR');
        expect(formatOrderPrice(null as unknown as number)).toBe('0.00 PKR');
      });
    });

    describe('formatOrderDate', () => {
      it('formats valid ISO dates into human-readable string', () => {
        const formatted = formatOrderDate('2026-10-18T10:00:00Z');
        expect(formatted).toContain('2026');
        expect(formatted).toContain('Oct');
      });

      it('handles null, undefined, or invalid date strings safely', () => {
        expect(formatOrderDate(null)).toBe('—');
        expect(formatOrderDate(undefined)).toBe('—');
        expect(formatOrderDate('')).toBe('—');
        expect(formatOrderDate('not-a-date')).toBe('not-a-date');
      });
    });

    describe('getOrderStatusBadgeInfo', () => {
      it('returns proper labels for all 11 backend order statuses', () => {
        expect(getOrderStatusBadgeInfo('PendingPayment').label).toBe('Awaiting Payment');
        expect(getOrderStatusBadgeInfo('Paid').label).toBe('Paid');
        expect(getOrderStatusBadgeInfo('Processing').label).toBe('Processing');
        expect(getOrderStatusBadgeInfo('SentToVendor').label).toBe('Sent to Vendor');
        expect(getOrderStatusBadgeInfo('VendorProcessing').label).toBe('Vendor Processing');
        expect(getOrderStatusBadgeInfo('Completed').label).toBe('Completed');
        expect(getOrderStatusBadgeInfo('PartiallyCompleted').label).toBe('Partially Completed');
        expect(getOrderStatusBadgeInfo('Failed').label).toBe('Failed');
        expect(getOrderStatusBadgeInfo('Cancelled').label).toBe('Cancelled');
        expect(getOrderStatusBadgeInfo('RefundPending').label).toBe('Refund Pending');
        expect(getOrderStatusBadgeInfo('Refunded').label).toBe('Refunded');
      });

      it('returns fallback info for unknown or empty status', () => {
        const info = getOrderStatusBadgeInfo('CustomUnknown');
        expect(info.label).toBe('CustomUnknown');
        expect(getOrderStatusBadgeInfo(null).label).toBe('Unknown');
      });
    });

    describe('getPaymentStatusBadgeInfo', () => {
      it('returns proper labels for all payment statuses', () => {
        expect(getPaymentStatusBadgeInfo('Pending').label).toBe('Pending');
        expect(getPaymentStatusBadgeInfo('Paid').label).toBe('Paid');
        expect(getPaymentStatusBadgeInfo('Failed').label).toBe('Failed');
        expect(getPaymentStatusBadgeInfo('Expired').label).toBe('Expired');
        expect(getPaymentStatusBadgeInfo('Refunded').label).toBe('Refunded');
        expect(getPaymentStatusBadgeInfo('PartiallyRefunded').label).toBe('Partially Refunded');
      });

      it('returns fallback for null or empty payment status', () => {
        expect(getPaymentStatusBadgeInfo(null).label).toBe('No Payment');
      });
    });

    describe('getSalesChannelBadgeInfo', () => {
      it('maps all 4 backend sales channels to human-readable labels', () => {
        expect(getSalesChannelBadgeInfo('Website').label).toBe('Web Storefront');
        expect(getSalesChannelBadgeInfo('Telegram').label).toBe('Telegram Bot');
        expect(getSalesChannelBadgeInfo('Smm').label).toBe('SMM Panel');
        expect(getSalesChannelBadgeInfo('Admin').label).toBe('Admin Manual');
      });

      it('returns fallback for unrecognized sales channel', () => {
        expect(getSalesChannelBadgeInfo('Discord').label).toBe('Discord');
        expect(getSalesChannelBadgeInfo(null).label).toBe('Unknown Channel');
      });
    });
  });
});
