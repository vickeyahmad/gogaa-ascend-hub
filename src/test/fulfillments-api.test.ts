import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api-client';
import {
  getAdminFulfillments,
  getAdminOrderFulfillments,
  getAdminFulfillmentCapabilities,
  startManualFulfillment,
  completeManualFulfillment,
  validateDeliveryReference,
  getFulfillmentQueueStatusBadgeInfo,
  getParentOrderStatusBadgeInfo,
  getFulfillmentMethodBadgeInfo,
  getAttemptStatusBadgeInfo,
  formatFulfillmentDate,
  isAmbiguousFulfillmentError,
  markUnresolvedOperation,
  getUnresolvedOperation,
  clearUnresolvedOperation,
  clearAllUnresolvedOperationsForTesting,
  type AdminFulfillmentSummaryDto,
  type AdminOrderFulfillmentsDto,
  type AdminFulfillmentCapabilitiesDto,
  type AdminFulfillmentDto,
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

  describe('validateDeliveryReference', () => {
    it('rejects empty or whitespace reference', () => {
      expect(validateDeliveryReference('').isValid).toBe(false);
      expect(validateDeliveryReference('   ').isValid).toBe(false);
      expect(validateDeliveryReference(null).isValid).toBe(false);
    });

    it('rejects references containing HTML markup < or >', () => {
      expect(validateDeliveryReference('TICKET-<123>').isValid).toBe(false);
    });

    it('rejects ambiguous placeholders like N/A, TEST, 0000', () => {
      expect(validateDeliveryReference('N/A').isValid).toBe(false);
      expect(validateDeliveryReference('TEST').isValid).toBe(false);
      expect(validateDeliveryReference('0000').isValid).toBe(false);
    });

    it('rejects references without approved prefixes', () => {
      const res = validateDeliveryReference('EXTERNAL-12345');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('approved controlled prefix');
    });

    it('rejects references with invalid characters or spaces', () => {
      expect(validateDeliveryReference('TICKET 12345').isValid).toBe(false);
      expect(validateDeliveryReference('TICKET-12$45').isValid).toBe(false);
    });

    it('accepts valid structured references with approved prefixes', () => {
      const res1 = validateDeliveryReference('TICKET-12345');
      expect(res1.isValid).toBe(true);
      expect(res1.normalized).toBe('TICKET-12345');

      const res2 = validateDeliveryReference('DISPATCH-2026-10-21');
      expect(res2.isValid).toBe(true);

      const res3 = validateDeliveryReference('MSG-SUPPORT-99');
      expect(res3.isValid).toBe(true);

      const res4 = validateDeliveryReference('PORTAL-REQ-456');
      expect(res4.isValid).toBe(true);

      const res5 = validateDeliveryReference('REF-789012');
      expect(res5.isValid).toBe(true);
    });
  });

  describe('startManualFulfillment', () => {
    it('validates orderNumber and orderItemId before sending request', async () => {
      await expect(startManualFulfillment('', 1)).rejects.toThrow('Order number is required.');
      await expect(startManualFulfillment('ORD-1', 0)).rejects.toThrow('A valid order item ID is required.');
      await expect(startManualFulfillment('ORD-1', -5)).rejects.toThrow('A valid order item ID is required.');
    });

    it('sends POST to /api/admin/orders/:orderNumber/items/:orderItemId/manual-fulfillment/start', async () => {
      const mockDto: AdminFulfillmentDto = {
        fulfillmentId: 301,
        orderId: 101,
        orderItemId: 5,
        productSku: 'VAL-VP-1000',
        productName: '1000 Valorant Points',
        unitPrice: 1000,
        currency: 'PKR',
        quantityRequested: 1,
        quantityFulfilled: 0,
        status: 'InProgress',
        fulfillmentMethod: 'Manual',
        createdAt: '2026-10-21T10:00:00Z',
        updatedAt: '2026-10-21T10:00:00Z',
        completedAt: null,
        attempts: [],
        statusHistory: [],
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockDto,
        message: 'Manual fulfillment started successfully.',
      });

      const res = await startManualFulfillment('ORD-20261021-001', 5);

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/orders/ORD-20261021-001/items/5/manual-fulfillment/start',
        {
          method: 'POST',
        }
      );
      expect(res.fulfillmentId).toBe(301);
      expect(res.status).toBe('InProgress');
    });

    it('propagates ApiClientError from apiRequest', async () => {
      vi.spyOn(apiClient, 'apiRequest').mockRejectedValue(
        new apiClient.ApiClientError('Product is not approved for manual fulfillment.', 403)
      );

      await expect(startManualFulfillment('ORD-1', 5)).rejects.toThrow(
        'Product is not approved for manual fulfillment.'
      );
    });
  });

  describe('completeManualFulfillment', () => {
    it('validates confirmDelivered is true before sending request', async () => {
      await expect(
        completeManualFulfillment('ORD-1', 5, {
          confirmDelivered: false,
          deliveryReference: 'TICKET-12345',
          deliveryChannel: 'EmailSupport',
        })
      ).rejects.toThrow('ConfirmDelivered = true');
    });

    it('validates deliveryChannel belongs to approved channels', async () => {
      await expect(
        completeManualFulfillment('ORD-1', 5, {
          confirmDelivered: true,
          deliveryReference: 'TICKET-12345',
          deliveryChannel: 'InvalidChannel',
        })
      ).rejects.toThrow('Invalid delivery channel');
    });

    it('validates deliveryReference format', async () => {
      await expect(
        completeManualFulfillment('ORD-1', 5, {
          confirmDelivered: true,
          deliveryReference: 'INVALID',
          deliveryChannel: 'EmailSupport',
        })
      ).rejects.toThrow('approved controlled prefix');
    });

    it('rejects arbitrary operational notes', async () => {
      await expect(
        completeManualFulfillment('ORD-1', 5, {
          confirmDelivered: true,
          deliveryReference: 'TICKET-12345',
          deliveryChannel: 'EmailSupport',
          notes: 'Customer password was 123456',
        })
      ).rejects.toThrow('Arbitrary free-text notes are prohibited');
    });

    it('submits valid completion request and sends POST with normalized body', async () => {
      const mockDto: AdminFulfillmentDto = {
        fulfillmentId: 301,
        orderId: 101,
        orderItemId: 5,
        productSku: 'VAL-VP-1000',
        productName: '1000 Valorant Points',
        unitPrice: 1000,
        currency: 'PKR',
        quantityRequested: 1,
        quantityFulfilled: 1,
        status: 'Completed',
        fulfillmentMethod: 'Manual',
        createdAt: '2026-10-21T10:00:00Z',
        updatedAt: '2026-10-21T10:30:00Z',
        completedAt: '2026-10-21T10:30:00Z',
        attempts: [],
        statusHistory: [],
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockDto,
        message: 'Manual fulfillment completed successfully.',
      });

      const res = await completeManualFulfillment('ORD-20261021-001', 5, {
        confirmDelivered: true,
        deliveryReference: 'TICKET-12345',
        deliveryChannel: 'EmailSupport',
        notes: 'Standard delivery completed.',
      });

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/orders/ORD-20261021-001/items/5/manual-fulfillment/complete',
        {
          method: 'POST',
          body: JSON.stringify({
            confirmDelivered: true,
            deliveryReference: 'TICKET-12345',
            deliveryChannel: 'EmailSupport',
            notes: 'Standard delivery completed.',
          }),
        }
      );
      expect(res.status).toBe('Completed');
      expect(res.quantityFulfilled).toBe(1);
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

  describe('isAmbiguousFulfillmentError', () => {
    it('classifies network disconnection (status 0) as ambiguous', () => {
      const err = new apiClient.ApiClientError('Network failed', 0);
      expect(isAmbiguousFulfillmentError(err)).toBe(true);
    });

    it('classifies HTTP 408 Request Timeout as ambiguous', () => {
      const err = new apiClient.ApiClientError('Request Timeout', 408);
      expect(isAmbiguousFulfillmentError(err)).toBe(true);
    });

    it('classifies HTTP 500 Internal Server Error as ambiguous', () => {
      const err = new apiClient.ApiClientError('Internal Server Error', 500);
      expect(isAmbiguousFulfillmentError(err)).toBe(true);
    });

    it('classifies HTTP 502 Bad Gateway as ambiguous', () => {
      const err = new apiClient.ApiClientError('Bad Gateway', 502);
      expect(isAmbiguousFulfillmentError(err)).toBe(true);
    });

    it('classifies HTTP 503 Service Unavailable as ambiguous', () => {
      const err = new apiClient.ApiClientError('Service Unavailable', 503);
      expect(isAmbiguousFulfillmentError(err)).toBe(true);
    });

    it('classifies HTTP 504 Gateway Timeout as ambiguous', () => {
      const err = new apiClient.ApiClientError('Gateway Timeout', 504);
      expect(isAmbiguousFulfillmentError(err)).toBe(true);
    });

    it('classifies other HTTP 5xx responses as ambiguous', () => {
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Variant Also Negotiates', 506))).toBe(true);
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Network Authentication Required', 511))).toBe(true);
    });

    it('classifies TypeError (fetch failure) as ambiguous', () => {
      const err = new TypeError('Failed to fetch');
      expect(isAmbiguousFulfillmentError(err)).toBe(true);
    });

    it('does NOT classify definite client rejections (400, 401, 403, 404, 409, 422) as ambiguous', () => {
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Bad Request', 400))).toBe(false);
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Unauthorized', 401))).toBe(false);
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Forbidden', 403))).toBe(false);
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Not Found', 404))).toBe(false);
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Conflict', 409))).toBe(false);
      expect(isAmbiguousFulfillmentError(new apiClient.ApiClientError('Unprocessable', 422))).toBe(false);
    });
  });

  describe('Unresolved Operations Marker Persistence', () => {
    beforeEach(() => {
      clearAllUnresolvedOperationsForTesting();
    });

    it('records and retrieves unresolved operations per order and item', () => {
      markUnresolvedOperation({
        orderNumber: 'ORD-TEST-001',
        orderItemId: 1,
        operationType: 'start',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'Timeout occurred during start.',
      });

      const op = getUnresolvedOperation('ORD-TEST-001', 1, 'start');
      expect(op).not.toBeNull();
      expect(op?.orderNumber).toBe('ORD-TEST-001');
      expect(op?.orderItemId).toBe(1);
      expect(op?.operationType).toBe('start');
      expect(op?.errorSummary).toContain('Timeout');
    });

    it('isolates different items in the same order', () => {
      markUnresolvedOperation({
        orderNumber: 'ORD-TEST-001',
        orderItemId: 1,
        operationType: 'start',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'Timeout on item 1.',
      });

      expect(getUnresolvedOperation('ORD-TEST-001', 2, 'start')).toBeNull();
      expect(getUnresolvedOperation('ORD-TEST-001', 1, 'start')).not.toBeNull();
    });

    it('isolates start operations from complete operations for the same item', () => {
      markUnresolvedOperation({
        orderNumber: 'ORD-TEST-001',
        orderItemId: 1,
        operationType: 'start',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'Timeout on start.',
      });

      expect(getUnresolvedOperation('ORD-TEST-001', 1, 'complete')).toBeNull();
      expect(getUnresolvedOperation('ORD-TEST-001', 1, 'start')).not.toBeNull();
    });

    it('clears unresolved operation when explicitly resolved', () => {
      markUnresolvedOperation({
        orderNumber: 'ORD-TEST-001',
        orderItemId: 1,
        operationType: 'start',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'Timeout.',
      });

      clearUnresolvedOperation('ORD-TEST-001', 1, 'start');
      expect(getUnresolvedOperation('ORD-TEST-001', 1, 'start')).toBeNull();
    });
  });
});
