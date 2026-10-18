import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api-client';
import {
  getAdminManualPayments,
  getAdminManualPaymentDetail,
  maskAccountNumber,
  maskReceivingAccount,
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentMethod,
  getPaymentStatusBadgeInfo,
  type AdminManualPaymentDto,
  type PagedResult,
} from '@/lib/manual-payments-api';

describe('manual-payments-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdminManualPayments', () => {
    it('calls /api/admin/payments/manual with default options when no query provided', async () => {
      const mockResult: PagedResult<AdminManualPaymentDto> = {
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

      const res = await getAdminManualPayments();

      expect(spy).toHaveBeenCalledWith('/api/admin/payments/manual', {
        method: 'GET',
        skipCsrf: true,
      });
      expect(res.items).toEqual([]);
      expect(res.page).toBe(1);
    });

    it('passes pagination and status filter in query string', async () => {
      const mockResult: PagedResult<AdminManualPaymentDto> = {
        items: [
          {
            id: 1,
            paymentNumber: 'PAY-20261018-001',
            purpose: 'WalletTopUp',
            walletId: 10,
            orderId: null,
            customerId: 'cust-1',
            customerEmail: 'customer@example.com',
            customerFullName: 'Customer One',
            amount: 5000,
            currency: 'PKR',
            paymentMethodCode: 'BANK_TRANSFER',
            status: 'Pending',
            createdAt: '2026-10-18T10:00:00Z',
            updatedAt: '2026-10-18T10:00:00Z',
            statusHistory: [],
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

      const res = await getAdminManualPayments({
        page: 2,
        pageSize: 10,
        status: 'Pending',
      });

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/payments/manual?page=2&pageSize=10&status=Pending',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.items.length).toBe(1);
      expect(res.items[0].paymentNumber).toBe('PAY-20261018-001');
    });

    it('omits status query param when status is "all"', async () => {
      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
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
        message: 'Success',
      });

      await getAdminManualPayments({ status: 'all', page: 1, pageSize: 20 });

      expect(spy).toHaveBeenCalledWith('/api/admin/payments/manual?page=1&pageSize=20', {
        method: 'GET',
        skipCsrf: true,
      });
    });

    it('returns empty default fallback when backend data envelope is null', async () => {
      vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: null,
        message: 'Success',
      });

      const res = await getAdminManualPayments({ page: 3, pageSize: 25 });

      expect(res.items).toEqual([]);
      expect(res.page).toBe(3);
      expect(res.pageSize).toBe(25);
      expect(res.totalCount).toBe(0);
    });
  });

  describe('getAdminManualPaymentDetail', () => {
    it('throws error if paymentNumber is empty or whitespace', async () => {
      await expect(getAdminManualPaymentDetail('')).rejects.toThrow(
        'Payment number is required.'
      );
      await expect(getAdminManualPaymentDetail('   ')).rejects.toThrow(
        'Payment number is required.'
      );
    });

    it('path-encodes paymentNumber and retrieves detail record', async () => {
      const mockDetail: AdminManualPaymentDto = {
        id: 42,
        paymentNumber: 'PAY-20261018-ABC 123',
        purpose: 'WalletTopUp',
        walletId: 5,
        orderId: null,
        customerId: 'cust-42',
        customerEmail: 'vip@example.com',
        customerFullName: 'VIP User',
        amount: 15000,
        currency: 'PKR',
        paymentMethodCode: 'JAZZCASH',
        status: 'Paid',
        customerReference: 'JC-998877',
        customerSenderAccount: '03001234567',
        verifiedByUserName: 'SuperAdmin',
        paidAt: '2026-10-18T11:00:00Z',
        createdAt: '2026-10-18T10:30:00Z',
        updatedAt: '2026-10-18T11:00:00Z',
        statusHistory: [
          {
            id: 101,
            previousStatus: 'Pending',
            newStatus: 'Paid',
            reason: 'Funds received in JazzCash merchant account',
            changedByUserName: 'SuperAdmin',
            changedAt: '2026-10-18T11:00:00Z',
          },
        ],
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockDetail,
        message: 'Success',
      });

      const result = await getAdminManualPaymentDetail('PAY-20261018-ABC 123');

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/payments/manual/PAY-20261018-ABC%20123',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(result.id).toBe(42);
      expect(result.paymentNumber).toBe('PAY-20261018-ABC 123');
      expect(result.statusHistory.length).toBe(1);
    });

    it('throws 404 ApiClientError if payment is not found', async () => {
      vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: false,
        data: null,
        message: 'Manual payment "PAY-MISSING" was not found.',
      });

      await expect(getAdminManualPaymentDetail('PAY-MISSING')).rejects.toThrow(
        'Manual payment "PAY-MISSING" was not found.'
      );
    });
  });

  describe('maskAccountNumber', () => {
    it('returns "—" for null, undefined, or empty account', () => {
      expect(maskAccountNumber(null)).toBe('—');
      expect(maskAccountNumber(undefined)).toBe('—');
      expect(maskAccountNumber('')).toBe('—');
      expect(maskAccountNumber('   ')).toBe('—');
    });

    it('handles short account numbers of 4 or fewer characters', () => {
      expect(maskAccountNumber('1234')).toBe('•••• 1234');
      expect(maskAccountNumber('42')).toBe('•••• 42');
    });

    it('masks accounts longer than 4 characters preserving only last 4 digits', () => {
      expect(maskAccountNumber('03001234567')).toBe('•••• 4567');
      expect(maskAccountNumber('PK12MEZN00012345678901')).toBe('•••• 8901');
      expect(maskAccountNumber('123456789')).toBe('•••• 6789');
    });
  });

  describe('maskReceivingAccount', () => {
    it('returns "—" for null, undefined, or empty account', () => {
      expect(maskReceivingAccount(null)).toBe('—');
      expect(maskReceivingAccount(undefined)).toBe('—');
      expect(maskReceivingAccount('')).toBe('—');
      expect(maskReceivingAccount('   ')).toBe('—');
    });

    it('masks long numeric accounts preserving only last 4 digits', () => {
      expect(maskReceivingAccount('0123456789')).toBe('•••• 6789');
      expect(maskReceivingAccount('12345678901234')).toBe('•••• 1234');
    });

    it('masks IBANs showing first 4 and last 4 characters', () => {
      expect(maskReceivingAccount('PK36SCBL0000001123456701')).toBe('PK36 •••• 6701');
    });

    it('preserves non-numeric internal account codes and aliases', () => {
      expect(maskReceivingAccount('JAZZCASH_MAIN')).toBe('JAZZCASH_MAIN');
      expect(maskReceivingAccount('MEEZAN_COLLECTION')).toBe('MEEZAN_COLLECTION');
    });
  });

  describe('formatPaymentAmount', () => {
    it('formats numbers with PKR currency preserving decimal precision', () => {
      expect(formatPaymentAmount(5000)).toBe('5,000.00 PKR');
      expect(formatPaymentAmount(1234.5)).toBe('1,234.50 PKR');
      expect(formatPaymentAmount(9999.9999)).toBe('9,999.9999 PKR');
      expect(formatPaymentAmount(0)).toBe('0.00 PKR');
    });

    it('handles string amounts or missing amounts cleanly', () => {
      expect(formatPaymentAmount('2500')).toBe('2,500.00 PKR');
      expect(formatPaymentAmount(null)).toBe('0.00 PKR');
      expect(formatPaymentAmount(undefined)).toBe('0.00 PKR');
      expect(formatPaymentAmount('invalid')).toBe('0.00 PKR');
    });
  });

  describe('formatPaymentDate', () => {
    it('returns "—" for missing dates', () => {
      expect(formatPaymentDate(null)).toBe('—');
      expect(formatPaymentDate(undefined)).toBe('—');
    });

    it('formats ISO timestamps', () => {
      const formatted = formatPaymentDate('2026-10-18T10:30:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Oct');
    });
  });

  describe('formatPaymentMethod', () => {
    it('maps known method codes to friendly labels', () => {
      expect(formatPaymentMethod('BANK_TRANSFER')).toBe('Bank Transfer');
      expect(formatPaymentMethod('JAZZCASH')).toBe('JazzCash Manual');
      expect(formatPaymentMethod('EASYPAISA')).toBe('Easypaisa Manual');
      expect(formatPaymentMethod('RAAST')).toBe('Raast Instant');
    });

    it('returns "—" for empty or fallback for custom code', () => {
      expect(formatPaymentMethod(null)).toBe('—');
      expect(formatPaymentMethod('CUSTOM_METHOD')).toBe('CUSTOM_METHOD');
    });
  });

  describe('getPaymentStatusBadgeInfo', () => {
    it('returns correct label and styling for all backend statuses', () => {
      expect(getPaymentStatusBadgeInfo('Pending').label).toBe('Pending');
      expect(getPaymentStatusBadgeInfo('Paid').label).toBe('Paid');
      expect(getPaymentStatusBadgeInfo('Failed').label).toBe('Failed');
      expect(getPaymentStatusBadgeInfo('Expired').label).toBe('Expired');
      expect(getPaymentStatusBadgeInfo('Refunded').label).toBe('Refunded');
      expect(getPaymentStatusBadgeInfo('PartiallyRefunded').label).toBe('Partially Refunded');
      expect(getPaymentStatusBadgeInfo('Unknown').label).toBe('Unknown');
    });
  });
});
