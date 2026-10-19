import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api-client';
import {
  getAdminPayments,
  getAdminPaymentDetail,
  maskAccountNumber,
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentMethod,
  getPaymentPurposeBadge,
  getPaymentStatusBadgeInfo,
  type AdminPaymentSummaryDto,
  type AdminPaymentDetailDto,
  type PagedResult,
} from '@/lib/payments-api';

describe('payments-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdminPayments', () => {
    it('calls /api/admin/payments with default options when no query provided', async () => {
      const mockResult: PagedResult<AdminPaymentSummaryDto> = {
        items: [],
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockResult,
        message: 'Success',
      });

      const res = await getAdminPayments();

      expect(spy).toHaveBeenCalledWith('/api/admin/payments', {
        method: 'GET',
        skipCsrf: true,
      });
      expect(res.items).toEqual([]);
      expect(res.page).toBe(1);
    });

    it('passes pagination, status, purpose, paymentMethod, and search filters in query string', async () => {
      const mockResult: PagedResult<AdminPaymentSummaryDto> = {
        items: [
          {
            id: 1,
            paymentNumber: 'PAY-20261018-001',
            purpose: 'OrderPurchase',
            customerId: 'cust-1',
            customerFullName: 'Alice Johnson',
            customerEmail: 'alice@example.com',
            orderNumber: 'ORD-20261018-999',
            walletId: null,
            amount: 5499.5,
            currency: 'PKR',
            paymentMethodCode: 'JAZZCASH',
            status: 'Paid',
            createdAt: '2026-10-18T10:00:00Z',
            updatedAt: '2026-10-18T10:05:00Z',
            paidAt: '2026-10-18T10:05:00Z',
          },
        ],
        page: 2,
        pageSize: 10,
        totalCount: 15,
        totalPages: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockResult,
        message: 'Success',
      });

      const res = await getAdminPayments({
        page: 2,
        pageSize: 10,
        status: 'Paid',
        purpose: 'OrderPurchase',
        paymentMethod: 'JAZZCASH',
        search: 'alice',
      });

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/payments?page=2&pageSize=10&status=Paid&purpose=OrderPurchase&paymentMethod=JAZZCASH&search=alice',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.items.length).toBe(1);
      expect(res.items[0].paymentNumber).toBe('PAY-20261018-001');
      expect(res.items[0].purpose).toBe('OrderPurchase');
    });

    it('ignores "all" values and empty search strings in query', async () => {
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

      await getAdminPayments({
        status: 'all',
        purpose: 'all',
        paymentMethod: 'all',
        search: '   ',
        page: 1,
        pageSize: 20,
      });

      expect(spy).toHaveBeenCalledWith('/api/admin/payments?page=1&pageSize=20', {
        method: 'GET',
        skipCsrf: true,
      });
    });

    it('returns safe fallback object if response.data is null', async () => {
      vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: null,
        message: 'Empty result',
      });

      const res = await getAdminPayments({ page: 3, pageSize: 25 });
      expect(res.items).toEqual([]);
      expect(res.page).toBe(3);
      expect(res.pageSize).toBe(25);
      expect(res.totalCount).toBe(0);
    });
  });

  describe('getAdminPaymentDetail', () => {
    it('throws ApiClientError 400 when paymentNumber is blank', async () => {
      await expect(getAdminPaymentDetail('')).rejects.toThrow('Payment number is required.');
      await expect(getAdminPaymentDetail('   ')).rejects.toThrow('Payment number is required.');
    });

    it('calls encoded endpoint /api/admin/payments/:paymentNumber and returns details', async () => {
      const mockDetail: AdminPaymentDetailDto = {
        id: 1,
        paymentNumber: 'PAY-20261018-001',
        purpose: 'WalletTopUp',
        customerId: 'cust-1',
        customerFullName: 'Bob Smith',
        customerEmail: 'bob@example.com',
        orderId: null,
        orderNumber: null,
        walletId: 101,
        amount: 10000,
        currency: 'PKR',
        paymentMethodCode: 'BANK_TRANSFER',
        status: 'Paid',
        providerTransactionId: 'TRX-998811',
        customerReference: 'MEZN-12345',
        customerTransferDate: '2026-10-18T09:00:00Z',
        customerSenderAccount: '***5678',
        customerNotes: 'Transferred via portal',
        customerProofSubmittedAt: '2026-10-18T09:05:00Z',
        verifiedByUserId: 'admin-1',
        verifiedByUserName: 'SuperAdmin',
        verifiedReceivingAccount: '***9999',
        adminNotes: 'Receipt verified',
        verifiedAt: '2026-10-18T09:15:00Z',
        createdAt: '2026-10-18T09:00:00Z',
        updatedAt: '2026-10-18T09:15:00Z',
        paidAt: '2026-10-18T09:15:00Z',
        statusHistory: [
          {
            id: 1,
            previousStatus: null,
            newStatus: 'Pending',
            reason: 'Created',
            changedByUserId: 'cust-1',
            changedByUserName: 'Bob Smith',
            changedAt: '2026-10-18T09:00:00Z',
          },
          {
            id: 2,
            previousStatus: 'Pending',
            newStatus: 'Paid',
            reason: 'Approved',
            changedByUserId: 'admin-1',
            changedByUserName: 'SuperAdmin',
            changedAt: '2026-10-18T09:15:00Z',
          },
        ],
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockDetail,
        message: 'Success',
      });

      const res = await getAdminPaymentDetail('PAY-20261018-001');

      expect(spy).toHaveBeenCalledWith('/api/admin/payments/PAY-20261018-001', {
        method: 'GET',
        skipCsrf: true,
      });
      expect(res.paymentNumber).toBe('PAY-20261018-001');
      expect(res.purpose).toBe('WalletTopUp');
      expect(res.walletId).toBe(101);
      expect(res.statusHistory.length).toBe(2);
    });

    it('throws ApiClientError 404 when payment is not found', async () => {
      vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: false,
        data: null,
        message: "Payment 'PAY-UNKNOWN' was not found.",
      });

      await expect(getAdminPaymentDetail('PAY-UNKNOWN')).rejects.toThrow(
        "Payment 'PAY-UNKNOWN' was not found."
      );
    });
  });

  describe('formatPaymentAmount', () => {
    it('handles null, undefined, and empty string safely', () => {
      expect(formatPaymentAmount(null)).toBe('0.00 PKR');
      expect(formatPaymentAmount(undefined)).toBe('0.00 PKR');
      expect(formatPaymentAmount('')).toBe('0.00 PKR');
      expect(formatPaymentAmount('abc')).toBe('0.00 PKR');
    });

    it('preserves decimal values up to 4 decimal places without loss', () => {
      expect(formatPaymentAmount(5000)).toMatch(/5,000\.00 PKR/);
      expect(formatPaymentAmount(1234.5678)).toMatch(/1,234\.5678 PKR/);
      expect(formatPaymentAmount(10.5, 'USD')).toMatch(/10\.50 USD/);
    });
  });

  describe('maskAccountNumber', () => {
    it('handles empty or null values', () => {
      expect(maskAccountNumber(null)).toBe('—');
      expect(maskAccountNumber('')).toBe('—');
      expect(maskAccountNumber('   ')).toBe('—');
    });

    it('preserves already masked account numbers', () => {
      expect(maskAccountNumber('***1234')).toBe('***1234');
    });

    it('masks unmasked account numbers preserving last 4 digits', () => {
      expect(maskAccountNumber('03001234567')).toBe('***4567');
      expect(maskAccountNumber('1234')).toBe('***1234');
    });
  });

  describe('getPaymentStatusBadgeInfo', () => {
    it('returns appropriate styling for known statuses', () => {
      expect(getPaymentStatusBadgeInfo('Pending').label).toBe('Pending');
      expect(getPaymentStatusBadgeInfo('Paid').label).toBe('Paid');
      expect(getPaymentStatusBadgeInfo('Failed').label).toBe('Failed');
      expect(getPaymentStatusBadgeInfo('Expired').label).toBe('Expired');
      expect(getPaymentStatusBadgeInfo('Refunded').label).toBe('Refunded');
      expect(getPaymentStatusBadgeInfo('PartiallyRefunded').label).toBe('Partially Refunded');
    });

    it('returns fallback label for unknown status', () => {
      expect(getPaymentStatusBadgeInfo('CustomUnknown').label).toBe('CustomUnknown');
      expect(getPaymentStatusBadgeInfo(null).label).toBe('Unknown Status');
    });
  });

  describe('getPaymentPurposeBadge', () => {
    it('distinguishes OrderPurchase and WalletTopUp', () => {
      expect(getPaymentPurposeBadge('OrderPurchase').label).toBe('Order Purchase');
      expect(getPaymentPurposeBadge('WalletTopUp').label).toBe('Wallet Top-Up');
      expect(getPaymentPurposeBadge('Other').label).toBe('Other');
    });
  });

  describe('formatPaymentMethod', () => {
    it('formats standardized method codes into user-friendly names', () => {
      expect(formatPaymentMethod('JAZZCASH')).toBe('JazzCash');
      expect(formatPaymentMethod('EASYPAISA')).toBe('Easypaisa');
      expect(formatPaymentMethod('BANK_TRANSFER')).toBe('Bank Transfer');
      expect(formatPaymentMethod('WALLET')).toBe('Customer Wallet');
      expect(formatPaymentMethod('NAYAPAY')).toBe('NayaPay');
      expect(formatPaymentMethod('SADAPAY')).toBe('SadaPay');
      expect(formatPaymentMethod('CRYPTO_BINANCE')).toBe('Binance Pay');
      expect(formatPaymentMethod('CRYPTO_USDT')).toBe('USDT Transfer');
      expect(formatPaymentMethod('UNKNOWN_METHOD')).toBe('UNKNOWN_METHOD');
      expect(formatPaymentMethod(null)).toBe('—');
    });
  });

  describe('formatPaymentDate', () => {
    it('formats ISO timestamps', () => {
      expect(formatPaymentDate('2026-10-18T10:00:00Z')).toContain('2026');
      expect(formatPaymentDate(null)).toBe('—');
      expect(formatPaymentDate('')).toBe('—');
    });
  });
});
