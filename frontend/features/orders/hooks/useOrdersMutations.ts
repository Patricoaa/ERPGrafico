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
        mutationFn: ({ id, force }: { id: number; force?: boolean }) =>
            ordersApi.annulInvoice(id, force ?? false),
        onSuccess: () => {
            toast.success('Documento anulado correctamente')
            queryClient.invalidateQueries({ queryKey: INVOICES_QUERY_KEY })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useDeleteInvoice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => ordersApi.deleteInvoice(id),
        onSuccess: () => {
            toast.success('Borrador eliminado correctamente')
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

// ─── Order mutations ──────────────────────────────────────────────────────────

export function useAnnulOrder(orderType: 'sale' | 'purchase') {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: number) =>
            orderType === 'purchase'
                ? ordersApi.annulPurchaseOrder(id)
                : ordersApi.annulSaleOrder(id),
        onSuccess: () => {
            toast.success('Orden anulada correctamente')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useDeleteOrder(orderType: 'sale' | 'purchase') {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: number) =>
            orderType === 'purchase'
                ? ordersApi.deletePurchaseOrder(id)
                : ordersApi.deleteSaleOrder(id),
        onSuccess: () => {
            toast.success('Borrador eliminado')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

// ─── Logistics mutations ──────────────────────────────────────────────────────

export function useAnnulLogistics() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, docType }: { id: number; docType: string }) => {
            switch (docType) {
                case 'sale_delivery': return ordersApi.annulSaleDelivery(id)
                case 'purchase_receipt': return ordersApi.annulPurchaseReceipt(id)
                case 'sale_return': return ordersApi.annulSaleReturn(id)
                case 'purchase_return': return ordersApi.annulPurchaseReturn(id)
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

export function useDeletePayment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => ordersApi.deletePayment(id),
        onSuccess: () => {
            toast.success('Pago eliminado correctamente')
            queryClient.invalidateQueries({ queryKey: PAYMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEYS.all })
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

export function useAnnulPayment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => ordersApi.annulPayment(id),
        onSuccess: () => {
            toast.success('Pago anulado correctamente')
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
        mutationFn: (id: number) => ordersApi.annulWorkOrder(id),
        onSuccess: () => {
            toast.success('OT anulada correctamente')
            queryClient.invalidateQueries({ queryKey: SALES_KEYS.all })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.all })
        },
    })
}

// ─── Imperative API access (for read operations in useEffect-based components) ─

export { ordersApi } from '../api/ordersApi'
