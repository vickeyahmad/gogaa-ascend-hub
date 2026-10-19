import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api-client';
import {
  getAdminWallets,
  getAdminWalletTransactions,
  formatWalletBalance,
  formatWalletDate,
  getTransactionTypeBadge,
  getTransactionSourceBadge,
  type AdminWalletSummaryDto,
  type AdminWalletTransactionDto,
  type PagedResult,
} from '@/lib/wallets-api';

describe('wallets-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdminWallets', () => {
    it('calls /api/admin/wallets with default options when no query provided', async () => {
      const mockResult: PagedResult<AdminWalletSummaryDto> = {
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

      const res = await getAdminWallets();

      expect(spy).toHaveBeenCalledWith('/api/admin/wallets', {
        method: 'GET',
        skipCsrf: true,
      });
      expect(res.items).toEqual([]);
      expect(res.page).toBe(1);
    });

    it('passes search, currency, page, and pageSize query parameters', async () => {
      const mockResult: PagedResult<AdminWalletSummaryDto> = {
        items: [
          {
            walletId: 101,
            customerId: 'cust-1',
            customerFullName: 'Alice Johnson',
            customerEmail: 'alice@example.com',
            currentBalance: 25000.75,
            currency: 'PKR',
            createdAt: '2026-10-18T10:00:00Z',
            updatedAt: '2026-10-18T10:00:00Z',
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

      const res = await getAdminWallets({
        page: 2,
        pageSize: 10,
        currency: 'PKR',
        search: 'alice',
      });

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/wallets?page=2&pageSize=10&search=alice&currency=PKR',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.items.length).toBe(1);
      expect(res.items[0].walletId).toBe(101);
      expect(res.items[0].currentBalance).toBe(25000.75);
    });

    it('ignores "all" for currency in query string', async () => {
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

      await getAdminWallets({ currency: 'all', page: 1, pageSize: 20 });

      expect(spy).toHaveBeenCalledWith('/api/admin/wallets?page=1&pageSize=20', {
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

      const res = await getAdminWallets({ page: 2, pageSize: 50 });
      expect(res.items).toEqual([]);
      expect(res.page).toBe(2);
      expect(res.pageSize).toBe(50);
      expect(res.totalCount).toBe(0);
    });
  });

  describe('getAdminWalletTransactions', () => {
    it('throws ApiClientError 400 when walletId is invalid', async () => {
      await expect(getAdminWalletTransactions(0)).rejects.toThrow('Wallet ID must be a positive number.');
      await expect(getAdminWalletTransactions(-5)).rejects.toThrow('Wallet ID must be a positive number.');
    });

    it('calls /api/admin/wallets/:walletId/transactions with pagination and filters', async () => {
      const mockResult: PagedResult<AdminWalletTransactionDto> = {
        items: [
          {
            transactionId: 501,
            walletId: 101,
            transactionType: 'Credit',
            amount: 5000,
            currency: 'PKR',
            balanceBefore: 0,
            balanceAfter: 5000,
            sourceType: 'DepositVerification',
            sourceReferenceId: 'PAY-20261018-001',
            description: 'Approved manual deposit',
            createdAt: '2026-10-18T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };

      const spy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
        success: true,
        data: mockResult,
        message: 'Success',
      });

      const res = await getAdminWalletTransactions(101, {
        page: 1,
        pageSize: 10,
        transactionType: 'Credit',
        sourceType: 'DepositVerification',
      });

      expect(spy).toHaveBeenCalledWith(
        '/api/admin/wallets/101/transactions?page=1&pageSize=10&transactionType=Credit&sourceType=DepositVerification',
        {
          method: 'GET',
          skipCsrf: true,
        }
      );
      expect(res.items.length).toBe(1);
      expect(res.items[0].transactionId).toBe(501);
      expect(res.items[0].balanceAfter).toBe(5000);
    });

    it('ignores "all" values for transactionType and sourceType', async () => {
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

      await getAdminWalletTransactions(102, {
        transactionType: 'all',
        sourceType: 'all',
        page: 1,
        pageSize: 20,
      });

      expect(spy).toHaveBeenCalledWith('/api/admin/wallets/102/transactions?page=1&pageSize=20', {
        method: 'GET',
        skipCsrf: true,
      });
    });
  });

  describe('formatWalletBalance', () => {
    it('handles null, undefined, empty, and invalid inputs safely', () => {
      expect(formatWalletBalance(null)).toBe('0.00 PKR');
      expect(formatWalletBalance(undefined)).toBe('0.00 PKR');
      expect(formatWalletBalance('')).toBe('0.00 PKR');
      expect(formatWalletBalance('invalid')).toBe('0.00 PKR');
    });

    it('preserves fractional decimal amounts up to 4 places', () => {
      expect(formatWalletBalance(50000)).toMatch(/50,000\.00 PKR/);
      expect(formatWalletBalance(1234.5678)).toMatch(/1,234\.5678 PKR/);
      expect(formatWalletBalance(100.25, 'USDT')).toMatch(/100\.25 USDT/);
    });
  });

  describe('getTransactionTypeBadge', () => {
    it('returns Credit badge with plus prefix', () => {
      const badge = getTransactionTypeBadge('Credit');
      expect(badge.label).toBe('Credit');
      expect(badge.prefix).toBe('+');
      expect(badge.badgeClass).toContain('emerald');
    });

    it('returns Debit badge with minus prefix', () => {
      const badge = getTransactionTypeBadge('Debit');
      expect(badge.label).toBe('Debit');
      expect(badge.prefix).toBe('−');
      expect(badge.badgeClass).toContain('rose');
    });

    it('returns fallback badge for unknown transaction type', () => {
      const badge = getTransactionTypeBadge('Unknown');
      expect(badge.label).toBe('Unknown');
      expect(badge.prefix).toBe('');
    });
  });

  describe('getTransactionSourceBadge', () => {
    it('returns human-readable labels for standard source types', () => {
      expect(getTransactionSourceBadge('DepositVerification').label).toBe('Deposit Verification');
      expect(getTransactionSourceBadge('OrderPayment').label).toBe('Order Payment');
      expect(getTransactionSourceBadge('Refund').label).toBe('Refund');
      expect(getTransactionSourceBadge('AdminAdjustment').label).toBe('Admin Adjustment');
      expect(getTransactionSourceBadge('CompensatingCorrection').label).toBe('Compensating Correction');
      expect(getTransactionSourceBadge('Other').label).toBe('Other');
    });
  });

  describe('formatWalletDate', () => {
    it('formats ISO dates and handles empty strings', () => {
      expect(formatWalletDate('2026-10-18T10:00:00Z')).toContain('2026');
      expect(formatWalletDate(null)).toBe('—');
      expect(formatWalletDate('')).toBe('—');
    });
  });
});
