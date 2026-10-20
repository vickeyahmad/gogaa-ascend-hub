import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api-client';
import {
  getAdminFulfillments,
  getAdminOrderFulfillments,
  getAdminFulfillmentCapabilities,
  getFulfillmentQueueStatusBadgeInfo,
  getParentOrderStatusBadgeInfo,
  getFulfillmentMethodBadgeInfo,
  getAttemptStatusBadgeInfo,
  formatFulfillmentDate,
  type AdminFulfillmentSummaryDto,
  type AdminOrderFulfillmentsDto,
  type AdminFulfillmentCapabilitiesDto,
  type PagedResult,
} from '@/lib/fulfillments-api';

describe('fulfillments-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdminFulfillments', () => {
    it('calls /api/admin/fulfillments with default options when no query provided', async () => {
      const mockResult: PagedResult<AdminFulfillmentSummaryDto> = {
        items: [],
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockResult,
        message: 'Success',
      });

      const res = await getAdminFulfillments();

      expect(spy).toHaveBeenCalledWith('/api/admin/fulfillments', {
        method: 'GET',
        skipCsrf: true,
      });
      expect(res.items).toEqual([]);
      expect(res.totalCount).toBe(0);
    });

    it('serializes all supported query parameters correctly', async () => {
      const mockSummary: AdminFulfillmentSummaryDto = {
        fulfillmentId: 10,
        isInitialized: true,
        orderId: 100,
        orderNumber: 'ORD-20261019-001',
        orderItemId: 501,
        customerId: 'cust-123',
        customerEmail: 'customer@example.com',
        customerName: 'Customer Name',
        productSku: 'VAL-VP-1000',
        productName: '1000 Valorant Points',
        quantityRequested: 1,
        quantityFulfilled: 1,
        fulfillmentMethod: 'Manual',
        fulfillmentStatus: 'Completed',
        queueStatus: 'Completed',
        orderStatus: 'Processing',
        attemptCount: 1,
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:30:00Z',
        completedAt: '2026-10-19T10:30:00Z',
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: {
          items: [mockSummary],
          page: 2,
          pageSize: 25,
          totalCount: 1,
          totalPages: 1,
          hasPreviousPage: true,
          hasNextPage: false,
        },
        message: 'Success',
      });

      const res = await getAdminFulfillments({
        page: 2,
        pageSize: 25,
        status: 'Uninitialized',
        fulfillmentMethod: 'Manual',
        orderStatus: 'Processing',
        search: 'VAL-VP-1000',
      });

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/fulfillments?page=2&pageSize=25&status=Uninitialized&fulfillmentMethod=Manual&orderStatus=Processing&search=VAL-VP-1000',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.items).toHaveLength(1);
      expect(res.items[0]?.orderNumber).toBe('ORD-20261019-001');
    });

    it('ignores "all" and whitespace for status, method, and orderStatus filters', async () => {
      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: {
          items: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        message: 'Success',
      });

      await getAdminFulfillments({
        status: 'all',
        fulfillmentMethod: 'all',
        orderStatus: 'all',
        search: '   ',
      });

      expect(spy).toHaveBeenCalledWith('/api/admin/fulfillments', {
        method: 'GET',
        skipCsrf: true,
      });
    });

    it('truncates search parameter exceeding 100 characters', async () => {
      const longSearch = 'a'.repeat(120);
      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: null,
        message: 'Success',
      });

      const res = await getAdminFulfillments({
        search: longSearch,
      });

      expect(spy).toHaveBeenCalledWith(
        `/api/admin/fulfillments?search=${'a'.repeat(100)}`,
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.items).toEqual([]);
      expect(res.totalCount).toBe(0);
    });
  });

  describe('getAdminOrderFulfillments', () => {
    it('throws ApiClientError if orderNumber is empty or whitespace', async () => {
      await expect(getAdminOrderFulfillments('')).rejects.toThrow(
        'Order number is required.'
      );
      await expect(getAdminOrderFulfillments('   ')).rejects.toThrow(
        'Order number is required.'
      );
    });

    it('calls /api/admin/orders/{encoded}/fulfillments with GET', async () => {
      const mockOrderFulfillments: AdminOrderFulfillmentsDto = {
        orderNumber: 'ORD-20261019-001',
        orderId: 100,
        orderStatus: 'Processing',
        fulfillments: [],
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockOrderFulfillments,
        message: 'Success',
      });

      const res = await getAdminOrderFulfillments('ORD-20261019-001');

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/orders/ORD-20261019-001/fulfillments',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.orderNumber).toBe('ORD-20261019-001');
      expect(res.fulfillments).toEqual([]);
    });

    it('throws ApiClientError if response data is null', async () => {
      vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: false,
        data: null,
        message: "Order 'ORD-NONEXISTENT' was not found.",
      });

      await expect(
        getAdminOrderFulfillments('ORD-NONEXISTENT')
      ).rejects.toThrow("Order 'ORD-NONEXISTENT' was not found.");
    });
  });

  describe('getAdminFulfillmentCapabilities', () => {
    it('calls /api/admin/fulfillment-capabilities with GET and skipCsrf when no SKU provided', async () => {
      const mockCaps: AdminFulfillmentCapabilitiesDto = {
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Manual fulfillment is disabled by server configuration.',
        isProductApproved: null,
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockCaps,
        message: 'Fulfillment capabilities retrieved successfully.',
      });

      const res = await getAdminFulfillmentCapabilities();

      expect(spy).toHaveBeenCalledWith('/api/admin/fulfillment-capabilities', {
        method: 'GET',
        skipCsrf: true,
      });
      expect(res.isGloballyEnabled).toBe(false);
      expect(res.isEffectivelyAvailable).toBe(false);
      expect(res.isProductApproved).toBeNull();
    });

    it('safely encodes productSku query parameter when provided', async () => {
      const mockCaps: AdminFulfillmentCapabilitiesDto = {
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: true,
        approvedProductCount: 1,
        isEffectivelyAvailable: true,
        statusMessage: 'Manual fulfillment is active for 1 approved product(s).',
        isProductApproved: true,
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockCaps,
        message: 'Fulfillment capabilities retrieved successfully.',
      });

      const res = await getAdminFulfillmentCapabilities('VAL/VP 1000+TEST');

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/fulfillment-capabilities?productSku=VAL%2FVP+1000%2BTEST',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.isGloballyEnabled).toBe(true);
      expect(res.isProductApproved).toBe(true);
    });

    it('omits productSku query parameter when input is empty string or whitespace', async () => {
      const mockCaps: AdminFulfillmentCapabilitiesDto = {
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Disabled',
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockCaps,
        message: 'Success',
      });

      await getAdminFulfillmentCapabilities('   ');

      expect(spy).toHaveBeenCalledWith('/api/admin/fulfillment-capabilities', {
        method: 'GET',
        skipCsrf: true,
      });
    });

    it('throws ApiClientError when response data is null', async () => {
      vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: false,
        data: null,
        message: 'Unauthorized access to capability status.',
      });

      await expect(getAdminFulfillmentCapabilities()).rejects.toThrow(
        'Unauthorized access to capability status.'
      );
    });
  });

  describe('badge formatters', () => {
    it('returns appropriate badge info for queue status', () => {
      expect(getFulfillmentQueueStatusBadgeInfo('Uninitialized').label).toBe(
        'Uninitialized'
      );
      expect(getFulfillmentQueueStatusBadgeInfo('NotStarted').label).toBe(
        'Not Started'
      );
      expect(getFulfillmentQueueStatusBadgeInfo('Pending').label).toBe('Pending');
      expect(getFulfillmentQueueStatusBadgeInfo('InProgress').label).toBe(
        'In Progress'
      );
      expect(getFulfillmentQueueStatusBadgeInfo('RequiresReview').label).toBe(
        'Requires Review'
      );
      expect(getFulfillmentQueueStatusBadgeInfo('PartiallyCompleted').label).toBe(
        'Partially Completed'
      );
      expect(getFulfillmentQueueStatusBadgeInfo('Completed').label).toBe(
        'Completed'
      );
      expect(getFulfillmentQueueStatusBadgeInfo('Failed').label).toBe('Failed');
      expect(getFulfillmentQueueStatusBadgeInfo('Arbitrary').label).toBe(
        'Arbitrary'
      );
    });

    it('returns appropriate badge info for parent order status', () => {
      expect(getParentOrderStatusBadgeInfo('Paid').label).toBe('Paid');
      expect(getParentOrderStatusBadgeInfo('Processing').label).toBe(
        'Processing'
      );
      expect(getParentOrderStatusBadgeInfo('Completed').label).toBe('Completed');
      expect(getParentOrderStatusBadgeInfo('SentToVendor').label).toBe(
        'Sent to Vendor'
      );
      expect(getParentOrderStatusBadgeInfo('VendorProcessing').label).toBe(
        'Vendor Processing'
      );
      expect(getParentOrderStatusBadgeInfo('PartiallyCompleted').label).toBe(
        'Partially Completed'
      );
      expect(getParentOrderStatusBadgeInfo('Failed').label).toBe('Failed');
      expect(getParentOrderStatusBadgeInfo('Cancelled').label).toBe(
        'Cancelled'
      );
      expect(getParentOrderStatusBadgeInfo('PendingPayment').label).toBe(
        'Pending Payment'
      );
      expect(getParentOrderStatusBadgeInfo('RefundPending').label).toBe(
        'Refund Pending'
      );
      expect(getParentOrderStatusBadgeInfo('Refunded').label).toBe('Refunded');
    });

    it('returns appropriate badge info for fulfillment methods', () => {
      expect(getFulfillmentMethodBadgeInfo('Manual').label).toBe('Manual');
      expect(getFulfillmentMethodBadgeInfo('VendorApi').label).toBe(
        'Vendor API'
      );
      expect(getFulfillmentMethodBadgeInfo('Unassigned').label).toBe(
        'Unassigned'
      );
    });

    it('returns appropriate badge info for attempt statuses', () => {
      expect(getAttemptStatusBadgeInfo('Succeeded').label).toBe('Succeeded');
      expect(getAttemptStatusBadgeInfo('Submitted').label).toBe('Submitted');
      expect(getAttemptStatusBadgeInfo('NotStarted').label).toBe('Not Started');
      expect(getAttemptStatusBadgeInfo('ConfirmedFailed').label).toBe(
        'Confirmed Failed'
      );
      expect(getAttemptStatusBadgeInfo('Unknown').label).toContain('Unknown');
      expect(getAttemptStatusBadgeInfo('RequiresReconciliation').label).toBe(
        'Requires Reconciliation'
      );
    });

    it('formats ISO dates correctly and handles null/invalid values', () => {
      expect(formatFulfillmentDate(null)).toBe('—');
      expect(formatFulfillmentDate(undefined)).toBe('—');
      expect(formatFulfillmentDate('')).toBe('—');
      expect(formatFulfillmentDate('invalid-date')).toBe('invalid-date');
      const formatted = formatFulfillmentDate('2026-10-19T10:30:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Oct');
    });
  });
});
