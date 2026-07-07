'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ordersApi } from '../api/ordersApi'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { SALES_KEYS } from '@/features/sales'
import { PURCHASING_KEYS } from '@/features/purchasing'
import { INVOICES_QUERY_KEY } from '@/features/billing'
import { MOVEMENTS_KEYS, PAYMENTS_KEYS } from '@/features/treasury'
import { PRODUCTS_KEYS } from '@/features/inventory'

// ─── Billing mutations ────────────────────────────────────────────────────────

export function useAnnulInvoice() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const annulInvoiceMutation = useMutation({
        mutationFn: ({ id, force, reason }: { id: number; force?: boolean; reason?: string }) =>
            ordersApi.annulInvoice(id, force ?? false, reason ?? ''),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Documento anulado correctamente')
            invalidateCrossFeature(queryClient, [INVOICES_QUERY_KEY, SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { annulInvoice: annulInvoiceMutation.mutateAsync, isAnnulingInvoice: annulInvoiceMutation.isPending }
}

export function useCancelInvoice() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const cancelInvoiceMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            ordersApi.cancelInvoice(id, reason ?? ''),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Borrador cancelado correctamente')
            invalidateCrossFeature(queryClient, [INVOICES_QUERY_KEY, SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { cancelInvoice: cancelInvoiceMutation.mutateAsync, isCancellingInvoice: cancelInvoiceMutation.isPending }
}

export function useConfirmInvoice() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const confirmInvoiceMutation = useMutation({
        mutationFn: ({ id, formData }: { id: number; formData: Record<string, unknown> }) =>
            ordersApi.confirmInvoice(id, formData),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [INVOICES_QUERY_KEY, SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { confirmInvoice: confirmInvoiceMutation.mutateAsync, isConfirmingInvoice: confirmInvoiceMutation.isPending }
}

export function useCreateInvoiceFromOrder() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const createInvoiceFromOrderMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => ordersApi.createInvoiceFromOrder(data),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [INVOICES_QUERY_KEY])
        },
    })
    return { createInvoiceFromOrder: createInvoiceFromOrderMutation.mutateAsync, isCreatingInvoiceFromOrder: createInvoiceFromOrderMutation.isPending }
}

export function useProcessLogistics() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const processLogisticsMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            ordersApi.processLogistics(id, data),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Logística procesada correctamente')
            invalidateCrossFeature(queryClient, [INVOICES_QUERY_KEY, PRODUCTS_KEYS.all])
        },
    })
    return { processLogistics: processLogisticsMutation.mutateAsync, isProcessingLogistics: processLogisticsMutation.isPending }
}

export function useCancelOrder(orderType: 'sale' | 'purchase') {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const cancelOrderMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            orderType === 'purchase'
                ? ordersApi.cancelPurchaseOrder(id, reason ?? '')
                : ordersApi.cancelSaleOrder(id, reason ?? ''),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Orden cancelada correctamente')
            invalidateCrossFeature(queryClient, [SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { cancelOrder: cancelOrderMutation.mutateAsync, isCancellingOrder: cancelOrderMutation.isPending }
}

// ─── Logistics mutations ──────────────────────────────────────────────────────

export function useAnnulLogistics() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const annulLogisticsMutation = useMutation({
        mutationFn: ({ id, docType, reason }: { id: number; docType: string; reason?: string }) => {
            switch (docType) {
                case 'sale_delivery': return ordersApi.annulSaleDelivery(id, reason ?? '')
                case 'purchase_receipt': return ordersApi.annulPurchaseReceipt(id, reason ?? '')
                case 'sale_return': return ordersApi.annulSaleReturn(id, reason ?? '')
                case 'purchase_return': return ordersApi.annulPurchaseReturn(id, reason ?? '')
                default: throw new Error(`Unknown logistics docType: ${docType}`)
            }
        },
        onSuccess: () => {
            markLocalMutation()
            toast.success('Movimiento anulado correctamente')
            invalidateCrossFeature(queryClient, [SALES_KEYS.all, PURCHASING_KEYS.all, PRODUCTS_KEYS.all])
        },
    })
    return { annulLogistics: annulLogisticsMutation.mutateAsync, isAnnulingLogistics: annulLogisticsMutation.isPending }
}

// ─── Treasury mutations ───────────────────────────────────────────────────────

export function useRegisterPaymentMovement() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const registerPaymentMovementMutation = useMutation({
        mutationFn: ({ data, idempotencyKey }: { data: Record<string, unknown>; idempotencyKey?: string }) =>
            ordersApi.registerPaymentMovement(data, idempotencyKey),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Operación de tesorería registrada')
            invalidateCrossFeature(queryClient, [MOVEMENTS_KEYS.all, PAYMENTS_KEYS.all, SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { registerPaymentMovement: registerPaymentMovementMutation.mutateAsync, isRegisteringPaymentMovement: registerPaymentMovementMutation.isPending }
}

export function useAnnulPayment() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const annulPaymentMutation = useMutation({
        mutationFn: ({ id, reason, treasuryAccountId, amount }: {
            id: number; reason?: string; treasuryAccountId?: number; amount?: number
        }) =>
            ordersApi.annulPayment(id, reason ?? '', treasuryAccountId, amount),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Pago anulado correctamente')
            invalidateCrossFeature(queryClient, [PAYMENTS_KEYS.all, MOVEMENTS_KEYS.all, SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { annulPayment: annulPaymentMutation.mutateAsync, isAnnulingPayment: annulPaymentMutation.isPending }
}

export function useRegisterPaymentReturn() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const registerPaymentReturnMutation = useMutation({
        mutationFn: ({ paymentId, amount, reason, treasuryAccountId }: {
            paymentId: number; amount: number; reason?: string; treasuryAccountId?: number | null
        }) =>
            ordersApi.registerPaymentReturn(paymentId, {
                amount,
                reason: reason ?? '',
                treasury_account_id: treasuryAccountId,
            }),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Devolución de pago registrada correctamente')
            invalidateCrossFeature(queryClient, [PAYMENTS_KEYS.all, MOVEMENTS_KEYS.all, SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { registerPaymentReturn: registerPaymentReturnMutation.mutateAsync, isRegisteringPaymentReturn: registerPaymentReturnMutation.isPending }
}

export function useCancelPayment() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const cancelPaymentMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            ordersApi.cancelPayment(id, reason ?? ''),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Pago cancelado correctamente')
            invalidateCrossFeature(queryClient, [PAYMENTS_KEYS.all, MOVEMENTS_KEYS.all, SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { cancelPayment: cancelPaymentMutation.mutateAsync, isCancellingPayment: cancelPaymentMutation.isPending }
}

// ─── Production mutations ─────────────────────────────────────────────────────

export function useAnnulWorkOrder() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const annulWorkOrderMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            ordersApi.annulWorkOrder(id, reason ?? ''),
        onSuccess: () => {
            markLocalMutation()
            toast.success('OT anulada correctamente')
            invalidateCrossFeature(queryClient, [SALES_KEYS.all, PURCHASING_KEYS.all])
        },
    })
    return { annulWorkOrder: annulWorkOrderMutation.mutateAsync, isAnnulingWorkOrder: annulWorkOrderMutation.isPending }
}

// ─── Imperative API access (for read operations in useEffect-based components) ─

export { ordersApi } from '../api/ordersApi'
