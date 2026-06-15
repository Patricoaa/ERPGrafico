'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ordersApi } from '../api/ordersApi'
import { SALES_KEYS } from '@/features/sales/hooks/queryKeys'
import { PURCHASING_KEYS } from '@/features/purchasing/hooks/queryKeys'
import { INVOICES_QUERY_KEY } from '@/features/billing/hooks/queryKeys'
import { MOVEMENTS_KEYS, PAYMENTS_KEYS } from '@/features/treasury/hooks/queryKeys'
import { PRODUCTS_KEYS } from '@/features/inventory/hooks/queryKeys'

// ─── Billing mutations ────────────────────────────────────────────────────────

export function useAnnulInvoice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, force, reason }: { id: number; force?: boolean; reason?: string }) =>
            ordersApi.annulInvoice(id, force ?? false, reason ?? ''),
        onSuccess: () => {
            toast.success('Documento anulado correctamente')
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useCancelInvoice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            ordersApi.cancelInvoice(id, reason ?? ''),
        onSuccess: () => {
            toast.success('Borrador cancelado correctamente')
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useConfirmInvoice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, formData }: { id: number; formData: Record<string, unknown> }) =>
            ordersApi.confirmInvoice(id, formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useCreateInvoiceFromOrder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => ordersApi.createInvoiceFromOrder(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
        },
    })
}

export function useProcessLogistics() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            ordersApi.processLogistics(id, data),
        onSuccess: () => {
            toast.success('Logística procesada correctamente')
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.all })
        },
    })
}

export function useCancelOrder(orderType: 'sale' | 'purchase') {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            orderType === 'purchase'
                ? ordersApi.cancelPurchaseOrder(id, reason ?? '')
                : ordersApi.cancelSaleOrder(id, reason ?? ''),
        onSuccess: () => {
            toast.success('Orden cancelada correctamente')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

// ─── Logistics mutations ──────────────────────────────────────────────────────

export function useAnnulLogistics() {
    const queryClient = useQueryClient()
    return useMutation({
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
            toast.success('Movimiento anulado correctamente')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.all })
        },
    })
}

// ─── Treasury mutations ───────────────────────────────────────────────────────

export function useRegisterPaymentMovement() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: Record<string, unknown>) => ordersApi.registerPaymentMovement(data),
        onSuccess: () => {
            toast.success('Operación de tesorería registrada')
            queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PAYMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useAnnulPayment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, reason, treasuryAccountId, amount }: {
            id: number; reason?: string; treasuryAccountId?: number; amount?: number
        }) =>
            ordersApi.annulPayment(id, reason ?? '', treasuryAccountId, amount),
        onSuccess: () => {
            toast.success('Pago anulado correctamente')
            queryClient.invalidateQueries({ queryKey: PAYMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useRegisterPaymentReturn() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ paymentId, amount, reason, treasuryAccountId }: {
            paymentId: number; amount: number; reason?: string; treasuryAccountId?: number | null
        }) =>
            ordersApi.registerPaymentReturn(paymentId, {
                amount,
                reason: reason ?? '',
                treasury_account_id: treasuryAccountId,
            }),
        onSuccess: () => {
            toast.success('Devolución de pago registrada correctamente')
            queryClient.invalidateQueries({ queryKey: PAYMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useCancelPayment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            ordersApi.cancelPayment(id, reason ?? ''),
        onSuccess: () => {
            toast.success('Pago cancelado correctamente')
            queryClient.invalidateQueries({ queryKey: PAYMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

// ─── Production mutations ─────────────────────────────────────────────────────

export function useAnnulWorkOrder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            ordersApi.annulWorkOrder(id, reason ?? ''),
        onSuccess: () => {
            toast.success('OT anulada correctamente')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

// ─── Imperative API access (for read operations in useEffect-based components) ─

export { ordersApi } from '../api/ordersApi'
