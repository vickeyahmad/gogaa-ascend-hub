import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  FulfillmentCapabilitiesBanner,
  ProductFulfillmentCapability,
} from '@/components/admin/fulfillment-capabilities';
import * as fulfillmentsApi from '@/lib/fulfillments-api';
import type { AdminFulfillmentCapabilitiesDto } from '@/lib/fulfillments-api';

describe('Fulfillment Capabilities Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('FulfillmentCapabilitiesBanner (Global)', () => {
    it('renders loading state initially while fetching', () => {
      // Return a pending promise that does not resolve immediately
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockImplementation(
        () => new Promise(() => {})
      );

      render(<FulfillmentCapabilitiesBanner />);

      expect(screen.getByTestId('fulfillment-capabilities-loading')).toBeInTheDocument();
    });

    it('renders default global disabled state correctly', async () => {
      const defaultData: AdminFulfillmentCapabilitiesDto = {
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Manual fulfillment is disabled by server configuration.',
        isProductApproved: null,
      };

      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue(
        defaultData
      );

      render(<FulfillmentCapabilitiesBanner />);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      });

      // Master switch is disabled
      const globalSwitch = screen.getByTestId('metric-global-switch');
      expect(globalSwitch).toHaveTextContent('Disabled');
      expect(globalSwitch).toHaveTextContent('ManualFulfillment:Enabled');

      // Allowlist policy is empty
      const allowlistPolicy = screen.getByTestId('metric-allowlist-policy');
      expect(allowlistPolicy).toHaveTextContent('Empty (Fail-Closed)');

      // Approved product count is 0
      const approvedCount = screen.getByTestId('metric-approved-count');
      expect(approvedCount).toHaveTextContent('0 SKUs');
      expect(approvedCount).toHaveTextContent('No approved products');

      // Effective availability is unavailable
      const effectiveStatus = screen.getByTestId('capability-effective-status');
      expect(effectiveStatus).toHaveTextContent('Manual Fulfillment Unavailable');

      // Backend status message is safely rendered as escaped text
      const statusMessage = screen.getByTestId('capability-status-message');
      expect(statusMessage).toHaveTextContent(
        'Manual fulfillment is disabled by server configuration.'
      );

      // Read-only indicator is present
      expect(screen.getByText('READ-ONLY')).toBeInTheDocument();
    });

    it('renders enabled-with-allowlist state using mocked API response', async () => {
      const enabledData: AdminFulfillmentCapabilitiesDto = {
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: true,
        approvedProductCount: 3,
        isEffectivelyAvailable: true,
        statusMessage: 'Manual fulfillment is active for 3 approved product(s).',
        isProductApproved: null,
      };

      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue(
        enabledData
      );

      render(<FulfillmentCapabilitiesBanner />);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('metric-global-switch')).toHaveTextContent('Globally Enabled');
      expect(screen.getByTestId('metric-allowlist-policy')).toHaveTextContent('Allowlist Active');
      expect(screen.getByTestId('metric-approved-count')).toHaveTextContent('3 SKUs');
      expect(screen.getByTestId('capability-effective-status')).toHaveTextContent(
        'Available for Approved SKUs'
      );
      expect(screen.getByTestId('capability-status-message')).toHaveTextContent(
        'Manual fulfillment is active for 3 approved product(s).'
      );
    });

    it('renders fail-closed status when globally enabled but allowlist is empty', async () => {
      const emptyAllowlistData: AdminFulfillmentCapabilitiesDto = {
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage:
          'Manual fulfillment is disabled: product allowlist is empty (fail-closed policy).',
        isProductApproved: null,
      };

      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue(
        emptyAllowlistData
      );

      render(<FulfillmentCapabilitiesBanner />);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('metric-global-switch')).toHaveTextContent('Globally Enabled');
      expect(screen.getByTestId('metric-allowlist-policy')).toHaveTextContent('Empty (Fail-Closed)');
      expect(screen.getByTestId('metric-approved-count')).toHaveTextContent('0 SKUs');
      expect(screen.getByTestId('capability-effective-status')).toHaveTextContent(
        'Manual Fulfillment Unavailable'
      );
    });

    it('displays "Capability status unavailable" on API error and allows retry', async () => {
      let callCount = 0;
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockImplementation(
        () => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Network connection timeout.'));
          }
          return Promise.resolve({
            isGloballyEnabled: false,
            hasProductAllowlistPolicy: false,
            approvedProductCount: 0,
            isEffectivelyAvailable: false,
            statusMessage: 'Manual fulfillment is disabled by server configuration.',
          });
        }
      );

      render(<FulfillmentCapabilitiesBanner />);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-error')).toBeInTheDocument();
      });

      // Verifies rule: MUST display "Capability status unavailable" and NOT falsely say "Disabled" or "Enabled"
      expect(screen.getByText('Capability status unavailable')).toBeInTheDocument();
      expect(screen.getByText('Network connection timeout.')).toBeInTheDocument();
      expect(screen.queryByTestId('metric-global-switch')).not.toBeInTheDocument();

      // Click retry
      const retryBtn = screen.getByTestId('retry-capabilities-button');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      });
      expect(screen.getByTestId('metric-global-switch')).toHaveTextContent('Disabled');
    });

    it('refreshes capabilities when the refresh button is clicked', async () => {
      const mockApi = vi
        .spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities')
        .mockResolvedValue({
          isGloballyEnabled: false,
          hasProductAllowlistPolicy: false,
          approvedProductCount: 0,
          isEffectivelyAvailable: false,
          statusMessage: 'Initial message',
        });

      render(<FulfillmentCapabilitiesBanner />);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      });

      expect(mockApi).toHaveBeenCalledTimes(1);

      const refreshBtn = screen.getByTestId('refresh-capabilities-button');
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledTimes(2);
      });
    });

    it('refreshes capabilities when external refreshTrigger increments', async () => {
      const mockApi = vi
        .spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities')
        .mockResolvedValue({
          isGloballyEnabled: false,
          hasProductAllowlistPolicy: false,
          approvedProductCount: 0,
          isEffectivelyAvailable: false,
          statusMessage: 'Initial',
        });

      const { rerender } = render(<FulfillmentCapabilitiesBanner refreshTrigger={0} />);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      });

      expect(mockApi).toHaveBeenCalledTimes(1);

      rerender(<FulfillmentCapabilitiesBanner refreshTrigger={1} />);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledTimes(2);
      });
    });

    it('guarantees that NO feature toggle switches or mutation controls exist', async () => {
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue({
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Disabled',
      });

      render(<FulfillmentCapabilitiesBanner />);

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-capabilities-banner')).toBeInTheDocument();
      });

      // No switches or checkboxes
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      // No edit, save, or enable buttons
      expect(screen.queryByRole('button', { name: /enable/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /disable/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /configure/i })).not.toBeInTheDocument();
    });
  });

  describe('ProductFulfillmentCapability (Product-Specific)', () => {
    it('handles missing or empty SKU gracefully without making an API call', () => {
      const mockApi = vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities');

      render(<ProductFulfillmentCapability productSku="" />);

      expect(screen.getByTestId('product-capability-unknown')).toHaveTextContent(
        'Product SKU not specified · Capability status unknown'
      );
      expect(mockApi).not.toHaveBeenCalled();
    });

    it('renders product approved status with clear pilot disclaimer', async () => {
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue({
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: true,
        approvedProductCount: 1,
        isEffectivelyAvailable: true,
        statusMessage: 'Manual fulfillment is active for 1 approved product(s).',
        isProductApproved: true,
      });

      render(<ProductFulfillmentCapability productSku="VAL-VP-1000" />);

      await waitFor(() => {
        expect(screen.getByTestId('product-capability-section')).toBeInTheDocument();
      });

      const badge = screen.getByTestId('product-approval-badge');
      expect(badge).toHaveTextContent('Product Approved for Pilot');

      // Crucial requirement: Must never imply that approved SKU alone authorizes delivery
      expect(
        screen.getByText(/Informational Pilot Status Only/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Parent order to be in Processing status with verified payment/i)
      ).toBeInTheDocument();
    });

    it('renders product not approved status clearly', async () => {
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue({
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: true,
        approvedProductCount: 1,
        isEffectivelyAvailable: true,
        statusMessage: 'Manual fulfillment is active for 1 approved product(s).',
        isProductApproved: false,
      });

      render(<ProductFulfillmentCapability productSku="PUBG-UC-600" />);

      await waitFor(() => {
        expect(screen.getByTestId('product-capability-section')).toBeInTheDocument();
      });

      const badge = screen.getByTestId('product-approval-badge');
      expect(badge).toHaveTextContent('Product Not Approved');
      expect(
        screen.getByText(/This product SKU is not on the server allowlist/i)
      ).toBeInTheDocument();
    });

    it('distinguishes global disabled state when inspecting an unapproved product', async () => {
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue({
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Manual fulfillment is disabled by server configuration.',
        isProductApproved: false,
      });

      render(<ProductFulfillmentCapability productSku="SPOTIFY-PREM-1M" />);

      await waitFor(() => {
        expect(screen.getByTestId('product-capability-section')).toBeInTheDocument();
      });

      // Product is not approved
      expect(screen.getByTestId('product-approval-badge')).toHaveTextContent(
        'Product Not Approved'
      );
      // Global disabled context is explicitly highlighted
      expect(
        screen.getByText('Manual fulfillment is globally disabled by server configuration.')
      ).toBeInTheDocument();
    });

    it('handles product status unknown when backend returns null isProductApproved', async () => {
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue({
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Disabled',
        isProductApproved: null,
      });

      render(<ProductFulfillmentCapability productSku="UNKNOWN-SKU" />);

      await waitFor(() => {
        expect(screen.getByTestId('product-capability-section')).toBeInTheDocument();
      });

      expect(screen.getByTestId('product-approval-badge')).toHaveTextContent(
        'Product Status Unknown'
      );
    });

    it('displays error state on failure and retries successfully', async () => {
      let callCount = 0;
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockImplementation(
        () => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Gateway timeout'));
          }
          return Promise.resolve({
            isGloballyEnabled: false,
            hasProductAllowlistPolicy: false,
            approvedProductCount: 0,
            isEffectivelyAvailable: false,
            statusMessage: 'Disabled',
            isProductApproved: false,
          });
        }
      );

      render(<ProductFulfillmentCapability productSku="TEST-SKU" />);

      await waitFor(() => {
        expect(screen.getByTestId('product-capability-error')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Capability status unavailable for/i)
      ).toBeInTheDocument();

      const retryBtn = screen.getByTestId('retry-product-capability-button');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByTestId('product-capability-section')).toBeInTheDocument();
      });
      expect(screen.getByTestId('product-approval-badge')).toHaveTextContent(
        'Product Not Approved'
      );
    });

    it('discards stale response when switching between order items rapidly', async () => {
      let resolveFirst: (data: AdminFulfillmentCapabilitiesDto) => void;
      const firstPromise = new Promise<AdminFulfillmentCapabilitiesDto>((res) => {
        resolveFirst = res;
      });

      let resolveSecond: (data: AdminFulfillmentCapabilitiesDto) => void;
      const secondPromise = new Promise<AdminFulfillmentCapabilitiesDto>((res) => {
        resolveSecond = res;
      });

      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockImplementation(
        (sku?: string) => {
          if (sku === 'SKU-SLOW') {
            return firstPromise;
          }
          return secondPromise;
        }
      );

      const { rerender } = render(<ProductFulfillmentCapability productSku="SKU-SLOW" />);

      // Switch to SKU-FAST before SKU-SLOW resolves
      rerender(<ProductFulfillmentCapability productSku="SKU-FAST" />);

      // Second request resolves first with Approved
      resolveSecond!({
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: true,
        approvedProductCount: 1,
        isEffectivelyAvailable: true,
        statusMessage: 'Active',
        isProductApproved: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('product-approval-badge')).toHaveTextContent(
          'Product Approved for Pilot'
        );
      });

      // Out-of-order first request resolves with Not Approved
      resolveFirst!({
        isGloballyEnabled: false,
        hasProductAllowlistPolicy: false,
        approvedProductCount: 0,
        isEffectivelyAvailable: false,
        statusMessage: 'Disabled',
        isProductApproved: false,
      });

      // The newer state (SKU-FAST) must NOT be overwritten by the stale SKU-SLOW response
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.getByTestId('product-approval-badge')).toHaveTextContent(
        'Product Approved for Pilot'
      );
    });

    it('guarantees that NO Start, Complete, or manual mutation buttons are rendered', async () => {
      vi.spyOn(fulfillmentsApi, 'getAdminFulfillmentCapabilities').mockResolvedValue({
        isGloballyEnabled: true,
        hasProductAllowlistPolicy: true,
        approvedProductCount: 1,
        isEffectivelyAvailable: true,
        statusMessage: 'Active',
        isProductApproved: true,
      });

      render(<ProductFulfillmentCapability productSku="APPROVED-SKU" />);

      await waitFor(() => {
        expect(screen.getByTestId('product-capability-section')).toBeInTheDocument();
      });

      // Strictly no manual fulfillment action buttons
      expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /deliver/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /fulfill/i })).not.toBeInTheDocument();
    });
  });
});
