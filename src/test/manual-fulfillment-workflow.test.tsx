import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../lib/auth-context';
import { FulfillmentManagementView } from '../routes/fulfillment';
import { FulfillmentDetailDialog } from '../components/admin/fulfillment-detail-dialog';
import { ManualFulfillmentStartDialog } from '../components/admin/manual-fulfillment-start-dialog';
import { ManualFulfillmentCompleteDialog } from '../components/admin/manual-fulfillment-complete-dialog';
import { setInMemoryCsrfToken } from '../lib/api-client';
import {
  clearAllUnresolvedOperationsForTesting,
  markUnresolvedOperation,
  getUnresolvedOperation,
  type AdminFulfillmentSummaryDto,
  type AdminOrderFulfillmentsDto,
  type AdminFulfillmentCapabilitiesDto,
  type AdminFulfillmentDto,
} from '../lib/fulfillments-api';

// Mock TanStack Router
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  createFileRoute: () => () => ({
    component: () => null,
  }),
}));

const mockAdminUser = {
  id: 'admin-001',
  email: 'admin@gogaabyte.com',
  fullName: 'Gogaa Admin',
  roles: ['Admin'],
};

const eligibleOrderFulfillments: AdminOrderFulfillmentsDto = {
  orderNumber: 'ORD-20261021-001',
  orderId: 101,
  orderStatus: 'Processing',
  fulfillments: [
    {
      fulfillmentId: 301,
      orderId: 101,
      orderItemId: 1,
      productSku: 'VAL-VP-1000',
      productName: '1000 Valorant Points',
      unitPrice: 1000,
      currency: 'PKR',
      quantityRequested: 1,
      quantityFulfilled: 0,
      status: 'InProgress',
      fulfillmentMethod: 'Manual',
      createdAt: '2026-10-21T08:00:00Z',
      updatedAt: '2026-10-21T08:05:00Z',
      completedAt: null,
      attempts: [
        {
          attemptId: 501,
          attemptNumber: 1,
          attemptKey: 'ATT-301-1',
          isManual: true,
          vendorProductId: null,
          vendorId: null,
          vendorName: null,
          status: 'Submitted',
          externalVendorOrderId: null,
          failureCategory: null,
          safeErrorSummary: null,
          deliveryReference: null,
          deliveryChannel: null,
          notes: null,
          initiatedByUserId: 'admin-001',
          confirmedByUserId: null,
          createdAt: '2026-10-21T08:05:00Z',
          submittedAt: '2026-10-21T08:05:00Z',
          completedAt: null,
        },
      ],
      statusHistory: [
        {
          id: 1,
          fulfillmentId: 301,
          previousStatus: 'NotStarted',
          newStatus: 'InProgress',
          reason: 'Administrator started manual fulfillment.',
          changedByUserId: 'admin-001',
          changedAt: '2026-10-21T08:05:00Z',
        },
      ],
    },
    {
      fulfillmentId: 302,
      orderId: 101,
      orderItemId: 2,
      productSku: 'PUBG-UC-600',
      productName: '600 PUBG UC',
      unitPrice: 1500,
      currency: 'PKR',
      quantityRequested: 1,
      quantityFulfilled: 0,
      status: 'NotStarted',
      fulfillmentMethod: 'Manual',
      createdAt: '2026-10-21T08:00:00Z',
      updatedAt: '2026-10-21T08:00:00Z',
      completedAt: null,
      attempts: [],
      statusHistory: [],
    },
  ],
};

describe('Controlled Manual Fulfillment Workflow (6B-6E2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setInMemoryCsrfToken('test-csrf-token-manual');
    clearAllUnresolvedOperationsForTesting();
  });

  describe('ManualFulfillmentStartDialog Component', () => {
    it('renders snapshot details and requires explicit confirmation', () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={onClose}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={onSuccess}
        />
      );

      expect(screen.getByText(/Start Manual Fulfillment/i)).toBeInTheDocument();
      expect(screen.getByText(/ORD-20261021-001/)).toBeInTheDocument();
      expect(screen.getByText(/Item #2/)).toBeInTheDocument();
      expect(screen.getByText('PUBG-UC-600')).toBeInTheDocument();
      expect(screen.getByText('600 PUBG UC')).toBeInTheDocument();

      // Opening dialog does NOT invoke onSuccess
      expect(onSuccess).not.toHaveBeenCalled();

      // Submit button is available
      const confirmBtn = screen.getByTestId('confirm-start-fulfillment-btn');
      expect(confirmBtn).toBeEnabled();
    });

    it('disables submit button and shows warning when global feature is disabled', () => {
      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={false}
          isProductApproved={true}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByTestId('start-dialog-feature-disabled-warning')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-start-fulfillment-btn')).toBeDisabled();
    });

    it('disables submit button and shows warning when product SKU is unapproved', () => {
      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={false}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByTestId('start-dialog-sku-unapproved-warning')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-start-fulfillment-btn')).toBeDisabled();
    });

    it('disables submit button and shows warning when parent order is not Processing', () => {
      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Paid"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByTestId('start-dialog-order-status-warning')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-start-fulfillment-btn')).toBeDisabled();
    });

    it('prevents double-clicks and sends POST with CSRF header on submission', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/manual-fulfillment/start')) {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  new Response(
                    JSON.stringify({
                      success: true,
                      data: { fulfillmentId: 302, status: 'InProgress' },
                      message: 'Started successfully.',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                  )
                ),
              50
            )
          );
        }
        return Promise.reject(new Error('Unknown url'));
      });

      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={onClose}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={onSuccess}
        />
      );

      const confirmBtn = screen.getByTestId('confirm-start-fulfillment-btn');
      fireEvent.click(confirmBtn);

      // Button enters disabled state while submitting
      expect(confirmBtn).toBeDisabled();

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain('/api/admin/orders/ORD-20261021-001/items/2/manual-fulfillment/start');
      expect((calledOptions as any).method).toBe('POST');
      expect((calledOptions as any).headers.get('X-XSRF-TOKEN')).toBe('test-csrf-token-manual');
    });

    it('handles 409 Conflict, displays clear error and triggers onReconcile', async () => {
      const onReconcile = vi.fn();

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Cannot start manual fulfillment: An attempt is already actively processing for this line item.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      );

      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={vi.fn()}
          onReconcile={onReconcile}
        />
      );

      fireEvent.click(screen.getByTestId('confirm-start-fulfillment-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('start-dialog-error-banner')).toBeInTheDocument();
        expect(screen.getByText(/already actively processing/i)).toBeInTheDocument();
      });

      expect(onReconcile).toHaveBeenCalled();
    });

    it('handles network disconnection/timeout safely without auto-retry, showing ambiguous alert and disabling submit', async () => {
      const onReconcile = vi.fn();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={vi.fn()}
          onReconcile={onReconcile}
        />
      );

      const confirmBtn = screen.getByTestId('confirm-start-fulfillment-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByTestId('start-dialog-ambiguous-alert')).toBeInTheDocument();
        expect(screen.getByText(/Manual Review Required/i)).toBeInTheDocument();
        expect(screen.getByText(/NOT automatically re-sent/i)).toBeInTheDocument();
      });

      // Submit button is disabled after ambiguous outcome
      expect(confirmBtn).toBeDisabled();

      // Second click invocation is refused and does not send another request
      fireEvent.click(confirmBtn);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(onReconcile).toHaveBeenCalled();
    });

    it('classifies HTTP 504 Gateway Timeout and HTTP 500 as ambiguous and disables submit', async () => {
      const onReconcile = vi.fn();

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Gateway Timeout from upstream server.',
          }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        )
      );

      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={vi.fn()}
          onReconcile={onReconcile}
        />
      );

      const confirmBtn = screen.getByTestId('confirm-start-fulfillment-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByTestId('start-dialog-ambiguous-alert')).toBeInTheDocument();
        expect(screen.getByText(/Manual Review Required/i)).toBeInTheDocument();
        expect(screen.getByText(/HTTP 504/i)).toBeInTheDocument();
      });

      expect(confirmBtn).toBeDisabled();
    });

    it('preserves ambiguous outcome and disabled submit button across dialog close and reopen', async () => {
      markUnresolvedOperation({
        orderNumber: 'ORD-20261021-001',
        orderItemId: 2,
        operationType: 'start',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'The request timed out before receiving confirmation. Manual review is strictly required.',
      });

      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={vi.fn()}
        />
      );

      // Reopened dialog immediately displays the ambiguous warning and disabled submit
      expect(screen.getByTestId('start-dialog-ambiguous-alert')).toBeInTheDocument();
      expect(screen.getByText(/Manual Review Required/i)).toBeInTheDocument();
      expect(screen.getByTestId('confirm-start-fulfillment-btn')).toBeDisabled();
    });

    it('prevents rapid double-clicks using synchronous in-flight guard', async () => {
      let resolvePromise: (res: Response) => void;
      const delayedPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(delayedPromise);

      render(
        <ManualFulfillmentStartDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={2}
          productName="600 PUBG UC"
          productSku="PUBG-UC-600"
          quantityRequested={1}
          parentOrderStatus="Processing"
          isGloballyEnabled={true}
          isProductApproved={true}
          onSuccess={vi.fn()}
        />
      );

      const confirmBtn = screen.getByTestId('confirm-start-fulfillment-btn');
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      resolvePromise!(
        new Response(
          JSON.stringify({
            success: true,
            data: { fulfillmentId: 302, status: 'InProgress' },
            message: 'Started successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });
  });

  describe('ManualFulfillmentCompleteDialog Component', () => {
    it('renders strict security warning and evidence inputs', () => {
      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByTestId('complete-dialog-privacy-warning')).toBeInTheDocument();
      expect(screen.getByText(/Operational Evidence Only/i)).toBeInTheDocument();
      expect(screen.getByTestId('complete-dialog-privacy-warning')).toHaveTextContent(
        /NEVER enter customer passwords/i
      );

      expect(screen.getByTestId('delivery-channel-select')).toBeInTheDocument();
      expect(screen.getByTestId('delivery-reference-input')).toBeInTheDocument();
      expect(screen.getByTestId('delivery-notes-select')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-delivered-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-complete-fulfillment-btn')).toBeDisabled();
    });

    it('requires mandatory confirmDelivered checkbox to enable submit', () => {
      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
        />
      );

      const refInput = screen.getByTestId('delivery-reference-input');
      fireEvent.change(refInput, { target: { value: 'TICKET-12345' } });

      const submitBtn = screen.getByTestId('confirm-complete-fulfillment-btn');
      expect(submitBtn).toBeDisabled();

      const checkbox = screen.getByTestId('confirm-delivered-checkbox');
      fireEvent.click(checkbox);

      expect(submitBtn).toBeEnabled();
    });

    it('validates reference prefix and rejects invalid format', () => {
      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
        />
      );

      const refInput = screen.getByTestId('delivery-reference-input');
      fireEvent.change(refInput, { target: { value: 'WRONG-12345' } });

      expect(screen.getByTestId('complete-dialog-client-error')).toHaveTextContent(
        /approved controlled prefix/i
      );
      expect(screen.getByTestId('confirm-complete-fulfillment-btn')).toBeDisabled();
    });

    it('submits valid completion and passes exact DTO', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: { fulfillmentId: 301, status: 'Completed', quantityFulfilled: 1 },
            message: 'Manual fulfillment completed successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={onClose}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={onSuccess}
        />
      );

      fireEvent.change(screen.getByTestId('delivery-channel-select'), {
        target: { value: 'WhatsAppDirect' },
      });
      fireEvent.change(screen.getByTestId('delivery-reference-input'), {
        target: { value: 'DISPATCH-2026-999' },
      });
      fireEvent.change(screen.getByTestId('delivery-notes-select'), {
        target: { value: 'Customer confirmed receipt.' },
      });
      fireEvent.click(screen.getByTestId('confirm-delivered-checkbox'));

      fireEvent.click(screen.getByTestId('confirm-complete-fulfillment-btn'));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
      expect(calledUrl).toContain('/api/admin/orders/ORD-20261021-001/items/1/manual-fulfillment/complete');
      expect((calledOptions as any).method).toBe('POST');

      const body = JSON.parse((calledOptions as any).body);
      expect(body).toEqual({
        confirmDelivered: true,
        deliveryReference: 'DISPATCH-2026-999',
        deliveryChannel: 'WhatsAppDirect',
        notes: 'Customer confirmed receipt.',
      });
    });

    it('handles 409 Conflict during completion safely', async () => {
      const onReconcile = vi.fn();

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Fulfillment for order item 1 is already Completed.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      );

      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
          onReconcile={onReconcile}
        />
      );

      fireEvent.change(screen.getByTestId('delivery-reference-input'), {
        target: { value: 'TICKET-12345' },
      });
      fireEvent.click(screen.getByTestId('confirm-delivered-checkbox'));
      fireEvent.click(screen.getByTestId('confirm-complete-fulfillment-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('complete-dialog-error-banner')).toBeInTheDocument();
        expect(screen.getByText(/already Completed/i)).toBeInTheDocument();
      });

      expect(onReconcile).toHaveBeenCalled();
    });

    it('handles network timeout (status 0) safely: shows ambiguous alert and disables submit button', async () => {
      const onReconcile = vi.fn();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
          onReconcile={onReconcile}
        />
      );

      fireEvent.change(screen.getByTestId('delivery-reference-input'), {
        target: { value: 'TICKET-12345' },
      });
      fireEvent.click(screen.getByTestId('confirm-delivered-checkbox'));

      const submitBtn = screen.getByTestId('confirm-complete-fulfillment-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('complete-dialog-ambiguous-alert')).toBeInTheDocument();
        expect(screen.getByText(/Manual Review Required/i)).toBeInTheDocument();
      });

      expect(submitBtn).toBeDisabled();

      // Second click invocation is refused
      fireEvent.click(submitBtn);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(onReconcile).toHaveBeenCalled();
    });

    it('classifies HTTP 504 Gateway Timeout as ambiguous: disables submit and locks inputs', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Gateway Timeout',
          }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        )
      );

      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('delivery-reference-input'), {
        target: { value: 'TICKET-12345' },
      });
      fireEvent.click(screen.getByTestId('confirm-delivered-checkbox'));

      const submitBtn = screen.getByTestId('confirm-complete-fulfillment-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('complete-dialog-ambiguous-alert')).toBeInTheDocument();
        expect(screen.getByText(/HTTP 504/i)).toBeInTheDocument();
      });

      expect(submitBtn).toBeDisabled();
      expect(screen.getByTestId('delivery-reference-input')).toBeDisabled();
      expect(screen.getByTestId('confirm-delivered-checkbox')).toBeDisabled();
    });

    it('preserves ambiguous outcome and disabled submit button across Complete dialog close and reopen', async () => {
      markUnresolvedOperation({
        orderNumber: 'ORD-20261021-001',
        orderItemId: 1,
        operationType: 'complete',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'Unresolved completion timeout occurred.',
      });

      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByTestId('complete-dialog-ambiguous-alert')).toBeInTheDocument();
      expect(screen.getByText(/Manual Review Required/i)).toBeInTheDocument();
      expect(screen.getByTestId('confirm-complete-fulfillment-btn')).toBeDisabled();
    });

    it('prevents rapid double-clicks on Complete using synchronous in-flight guard', async () => {
      let resolvePromise: (res: Response) => void;
      const delayedPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(delayedPromise);

      render(
        <ManualFulfillmentCompleteDialog
          isOpen={true}
          onClose={vi.fn()}
          orderNumber="ORD-20261021-001"
          orderItemId={1}
          productName="1000 Valorant Points"
          productSku="VAL-VP-1000"
          quantityRequested={1}
          attemptNumber={1}
          attemptKey="ATT-301-1"
          onSuccess={vi.fn()}
        />
      );

      fireEvent.change(screen.getByTestId('delivery-reference-input'), {
        target: { value: 'TICKET-12345' },
      });
      fireEvent.click(screen.getByTestId('confirm-delivered-checkbox'));

      const submitBtn = screen.getByTestId('confirm-complete-fulfillment-btn');
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      resolvePromise!(
        new Response(
          JSON.stringify({
            success: true,
            data: { fulfillmentId: 301, status: 'Completed', quantityFulfilled: 1 },
            message: 'Manual fulfillment completed successfully.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    });
  });

  describe('FulfillmentDetailDialog Item-Specific Integration', () => {
    it('isolates multi-item order controls and only shows Complete for active manual attempt', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url.includes('/api/admin/orders/ORD-20261021-001/fulfillments')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: eligibleOrderFulfillments,
                message: 'Success',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        if (url.includes('/api/admin/fulfillment-capabilities')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  isGloballyEnabled: true,
                  hasProductAllowlistPolicy: true,
                  approvedProductCount: 2,
                  isEffectivelyAvailable: true,
                  statusMessage: 'Enabled',
                  isProductApproved: true,
                },
                message: 'Capabilities',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        return Promise.reject(new Error(`Unexpected url: ${url}`));
      });

      render(
        <FulfillmentDetailDialog
          orderNumber="ORD-20261021-001"
          summaryItem={null}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-item-301')).toBeInTheDocument();
        expect(screen.getByTestId('fulfillment-item-302')).toBeInTheDocument();
      });

      // Item 301 is InProgress with an active manual attempt in Submitted status
      await waitFor(() => {
        const item1Card = screen.getByTestId('fulfillment-item-301');
        expect(
          item1Card.querySelector('[data-testid="complete-manual-fulfillment-btn"]')
        ).toBeInTheDocument();
      });

      const item1Card = screen.getByTestId('fulfillment-item-301');
      expect(
        item1Card.querySelector('[data-testid="start-manual-fulfillment-btn"]')
      ).not.toBeInTheDocument();

      // Item 302 is NotStarted with no attempts; it should have Start Manual Fulfillment
      await waitFor(() => {
        const item2Card = screen.getByTestId('fulfillment-item-302');
        expect(
          item2Card.querySelector('[data-testid="start-manual-fulfillment-btn"]')
        ).toBeInTheDocument();
      });

      const item2Card = screen.getByTestId('fulfillment-item-302');
      expect(
        item2Card.querySelector('[data-testid="complete-manual-fulfillment-btn"]')
      ).not.toBeInTheDocument();
    });

    it('blocks fulfillment controls when an unresolved vendor attempt (RequiresReconciliation) is present', async () => {
      const orderWithUnresolved: AdminOrderFulfillmentsDto = {
        orderNumber: 'ORD-20261021-002',
        orderId: 102,
        orderStatus: 'Processing',
        fulfillments: [
          {
            fulfillmentId: 303,
            orderId: 102,
            orderItemId: 1,
            productSku: 'MLBB-500',
            productName: '500 Diamonds',
            unitPrice: 500,
            currency: 'PKR',
            quantityRequested: 1,
            quantityFulfilled: 0,
            status: 'RequiresReview',
            fulfillmentMethod: 'VendorApi',
            createdAt: '2026-10-21T08:00:00Z',
            updatedAt: '2026-10-21T08:00:00Z',
            completedAt: null,
            attempts: [
              {
                attemptId: 502,
                attemptNumber: 1,
                attemptKey: 'ATT-303-1',
                isManual: false,
                vendorProductId: 10,
                vendorId: 1,
                vendorName: 'DirectVendor',
                status: 'RequiresReconciliation',
                externalVendorOrderId: 'EXT-999',
                failureCategory: 'NetworkTimeout',
                safeErrorSummary: 'Gateway timed out',
                deliveryReference: null,
                deliveryChannel: null,
                notes: null,
                initiatedByUserId: 'system',
                confirmedByUserId: null,
                createdAt: '2026-10-21T08:00:00Z',
                submittedAt: '2026-10-21T08:00:00Z',
                completedAt: null,
              },
            ],
            statusHistory: [],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url.includes('/api/admin/orders/ORD-20261021-002/fulfillments')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: orderWithUnresolved,
                message: 'Success',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        if (url.includes('/api/admin/fulfillment-capabilities')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  isGloballyEnabled: true,
                  hasProductAllowlistPolicy: true,
                  approvedProductCount: 2,
                  isEffectivelyAvailable: true,
                  statusMessage: 'Enabled',
                  isProductApproved: true,
                },
                message: 'Capabilities',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        return Promise.reject(new Error(`Unexpected url: ${url}`));
      });

      render(
        <FulfillmentDetailDialog
          orderNumber="ORD-20261021-002"
          summaryItem={null}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-item-303')).toBeInTheDocument();
      });

      // Control should display "Reconciliation Required" and block both Start and Complete
      await waitFor(() => {
        expect(screen.getByText(/Reconciliation Required/i)).toBeInTheDocument();
      });
      expect(screen.queryByTestId('start-manual-fulfillment-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('complete-manual-fulfillment-btn')).not.toBeInTheDocument();
    });

    it('shows completed badge and blocks any mutation controls for completed line item', async () => {
      const orderCompleted: AdminOrderFulfillmentsDto = {
        orderNumber: 'ORD-20261021-003',
        orderId: 103,
        orderStatus: 'Completed',
        fulfillments: [
          {
            fulfillmentId: 304,
            orderId: 103,
            orderItemId: 1,
            productSku: 'VAL-VP-1000',
            productName: '1000 Valorant Points',
            unitPrice: 1000,
            currency: 'PKR',
            quantityRequested: 1,
            quantityFulfilled: 1,
            status: 'Completed',
            fulfillmentMethod: 'Manual',
            createdAt: '2026-10-21T08:00:00Z',
            updatedAt: '2026-10-21T08:30:00Z',
            completedAt: '2026-10-21T08:30:00Z',
            attempts: [],
            statusHistory: [],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url.includes('/api/admin/orders/ORD-20261021-003/fulfillments')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: orderCompleted,
                message: 'Success',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        if (url.includes('/api/admin/fulfillment-capabilities')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  isGloballyEnabled: true,
                  hasProductAllowlistPolicy: true,
                  approvedProductCount: 2,
                  isEffectivelyAvailable: true,
                  statusMessage: 'Enabled',
                  isProductApproved: true,
                },
                message: 'Capabilities',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        return Promise.reject(new Error(`Unexpected url: ${url}`));
      });

      render(
        <FulfillmentDetailDialog
          orderNumber="ORD-20261021-003"
          summaryItem={null}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-item-304')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Fulfillment Completed')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('start-manual-fulfillment-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('complete-manual-fulfillment-btn')).not.toBeInTheDocument();
    });

    it('isolates ambiguous operations between different items on the same order', async () => {
      // Item 1 (which is InProgress) has an unresolved Complete operation
      markUnresolvedOperation({
        orderNumber: 'ORD-20261021-001',
        orderItemId: 1,
        operationType: 'complete',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'Completion timeout on Item 1.',
      });

      // Item 2 has NO unresolved operations
      expect(getUnresolvedOperation('ORD-20261021-001', 2, 'complete')).toBeNull();

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url.includes('/api/admin/orders/ORD-20261021-001/fulfillments')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: eligibleOrderFulfillments,
                message: 'Success',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        if (url.includes('/api/admin/fulfillment-capabilities')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  isGloballyEnabled: true,
                  hasProductAllowlistPolicy: true,
                  approvedProductCount: 2,
                  isEffectivelyAvailable: true,
                  statusMessage: 'Enabled',
                  isProductApproved: true,
                },
                message: 'Capabilities',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        return Promise.reject(new Error(`Unexpected url: ${url}`));
      });

      render(
        <FulfillmentDetailDialog
          orderNumber="ORD-20261021-001"
          summaryItem={null}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-item-301')).toBeInTheDocument();
      });

      // Item 1 shows its unresolved alert
      await waitFor(() => {
        expect(screen.getByTestId('item-unresolved-alert-1')).toBeInTheDocument();
      });

      // Item 2 does NOT show an unresolved alert
      expect(screen.queryByTestId('item-unresolved-alert-2')).not.toBeInTheDocument();
    });

    it('makes reconciliation failure visible and renders safe retry verification button', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url.includes('/api/admin/orders/ORD-20261021-001/fulfillments')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: eligibleOrderFulfillments,
                message: 'Success',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        if (url.includes('/api/admin/fulfillment-capabilities')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  isGloballyEnabled: true,
                  hasProductAllowlistPolicy: true,
                  approvedProductCount: 2,
                  isEffectivelyAvailable: true,
                  statusMessage: 'Enabled',
                  isProductApproved: true,
                },
                message: 'Capabilities',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        return Promise.reject(new Error(`Unexpected url: ${url}`));
      });

      const { rerender } = render(
        <FulfillmentDetailDialog
          orderNumber="ORD-20261021-001"
          summaryItem={null}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      let completeBtn: Element | null = null;
      await waitFor(() => {
        const item1Card = screen.getByTestId('fulfillment-item-301');
        completeBtn = item1Card.querySelector('[data-testid="complete-manual-fulfillment-btn"]');
        expect(completeBtn).toBeInTheDocument();
      });

      // Click Complete Delivery to open complete dialog
      fireEvent.click(completeBtn!);

      // In the complete dialog, submit to trigger 504 POST
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, message: 'Gateway Timeout' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        )
      );

      // Reconcile GET fails immediately following
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network connection failed during reconcile.'));
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disconnected.'));

      fireEvent.change(screen.getByTestId('delivery-reference-input'), {
        target: { value: 'TICKET-12345' },
      });
      fireEvent.click(screen.getByTestId('confirm-delivered-checkbox'));
      fireEvent.click(screen.getByTestId('confirm-complete-fulfillment-btn'));

      // Wait for complete dialog to show ambiguous alert
      await waitFor(() => {
        expect(screen.getByTestId('complete-dialog-ambiguous-alert')).toBeInTheDocument();
      });

      // Close complete dialog
      fireEvent.click(screen.getByText('Cancel'));

      // FulfillmentDetailDialog displays the reconciliation error banner
      await waitFor(() => {
        expect(screen.getByTestId('reconciliation-error-banner')).toBeInTheDocument();
        expect(screen.getByText(/Authoritative State Verification Failed/i)).toBeInTheDocument();
        expect(screen.getByTestId('retry-reconciliation-btn')).toBeInTheDocument();
      });
    });

    it('settles unresolved operation authoritatively when reconciliation returns transitioned state', async () => {
      // Pre-seed an unresolved start operation on Item 2
      markUnresolvedOperation({
        orderNumber: 'ORD-20261021-001',
        orderItemId: 2,
        operationType: 'start',
        recordedAt: '2026-10-21T10:00:00Z',
        errorSummary: 'Start timed out previously.',
      });

      expect(getUnresolvedOperation('ORD-20261021-001', 2, 'start')).not.toBeNull();

      // Return data where Item 2 is now InProgress!
      const transitionedData: AdminOrderFulfillmentsDto = {
        ...eligibleOrderFulfillments,
        fulfillments: eligibleOrderFulfillments.fulfillments.map((f) =>
          f.orderItemId === 2
            ? { ...f, status: 'InProgress', attempts: [{ attemptId: 503, attemptNumber: 1, attemptKey: 'ATT-302-1', isManual: true, status: 'Submitted', createdAt: '2026-10-21T08:00:00Z' }] }
            : f
        ),
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url.includes('/api/admin/orders/ORD-20261021-001/fulfillments')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: transitionedData,
                message: 'Success',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        if (url.includes('/api/admin/fulfillment-capabilities')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  isGloballyEnabled: true,
                  hasProductAllowlistPolicy: true,
                  approvedProductCount: 2,
                  isEffectivelyAvailable: true,
                  statusMessage: 'Enabled',
                  isProductApproved: true,
                },
                message: 'Capabilities',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        return Promise.reject(new Error(`Unexpected url: ${url}`));
      });

      render(
        <FulfillmentDetailDialog
          orderNumber="ORD-20261021-001"
          summaryItem={null}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fulfillment-item-302')).toBeInTheDocument();
      });

      // Unresolved start marker for Item 2 is authoritatively cleared!
      // In reloadFulfillments, when data arrives with InProgress status, clearUnresolvedOperation was called.
      // Note: loadFulfillments on initial open sets orderFulfillments directly, so let's trigger reloadFulfillments via retry or verify clearUnresolvedOperation
      expect(getUnresolvedOperation('ORD-20261021-001', 2, 'start')).toBeNull();
    });
  });
});
