'use client'

/**
 * Flujo unificado de cancelación/anulación de órdenes desde el HUB.
 *
 * Consulta `cancel_impact`, construye el modal de confirmación (con motivo
 * obligatorio cuando el backend ejecutará reversos) y dispara el endpoint
 * `/cancel/` — el backend decide soft-cancel vs full-annul según el árbol.
 *
 * Consumido por OriginPhase y ActionCategory; reemplaza a los builders
 * duplicados y al annul directo sin confirmación (gap G-07 / G-14).
 */
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { ordersApi } from '../api/ordersApi'
import { useCancelOrder } from './useOrdersMutations'

export interface CancelImpact {
    order_status: string
    invoices: { id: number; display_id: string; status: string }[]
    deliveries?: { id: number; status: string }[]
    receipts?: { id: number; status: string }[]
    payments: { id: number; amount: string; status: string }[]
    work_orders?: { id: number; number: string; status: string; stage: string }[]
    has_confirmed_deliveries?: boolean
    has_confirmed_receipts?: boolean
    has_posted_payments: boolean
    has_folio_invoices?: boolean
    period_open?: boolean
    requires_reason?: boolean
    action: string
}

export interface CancelFlowModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (reason?: string) => Promise<void>
    title: string
    description: React.ReactNode
    variant: 'destructive' | 'warning'
    confirmText: string
    requireReason: boolean
    reasonLabel: string
}

function buildImpactDescription(impact: CancelImpact): React.ReactNode {
    const isAnnul = impact.action === 'full_annul'
    const items: string[] = [
        ...impact.invoices.map(i => `• Factura ${i.display_id} — ${i.status}`),
        ...(impact.deliveries || []).map(d => `• Despacho #${d.id} — ${d.status}`),
        ...(impact.receipts || []).map(r => `• Recepción #${r.id} — ${r.status}`),
        ...impact.payments.map(p => `• Pago #${p.id} — ${p.status}`),
        ...(impact.work_orders || []).map(w => `• OT ${w.number} — ${w.stage}`),
    ]

    return (
        <div className="flex flex-col gap-2 text-sm">
            <p>¿Qué desea hacer con esta orden?</p>
            <p className="text-xs text-muted-foreground">
                {isAnnul
                    ? 'Se revertirán asientos contables y movimientos de stock.'
                    : 'Se cancelarán los documentos en Borrador sin reversos.'}
            </p>
            {impact.has_folio_invoices && (
                <p className="text-xs font-medium text-warning">
                    ⚠ Existe una factura con folio asignado: si es un documento emitido,
                    la operación será bloqueada y deberá emitir una Nota de Crédito.
                </p>
            )}
            {items.length > 0 && (
                <div className="flex flex-col gap-0.5 text-xs font-mono bg-muted p-2 rounded">
                    {items.map((line, i) => (
                        <span key={i}>{line}</span>
                    ))}
                </div>
            )}
        </div>
    )
}

export function useCancelOrderFlow(
    orderType: 'sale' | 'purchase',
    options?: { onSuccess?: () => void; orderId?: number | null },
) {
    const cancelOrder = useCancelOrder(orderType)

    const { data: impact } = useQuery({
        queryKey: ['cancel-impact', orderType, options?.orderId],
        queryFn: () => options?.orderId
            ? (orderType === 'sale'
                ? ordersApi.getCancelSaleImpact(options.orderId!)
                : ordersApi.getCancelPurchaseImpact(options.orderId!))
            : Promise.resolve(null),
        enabled: !!options?.orderId,
        staleTime: 30_000,
    })

    const isAnnulBlocked = impact?.has_folio_invoices === true
        || (impact?.work_orders?.length ?? 0) > 0
        || impact?.has_posted_payments === true
        || impact?.period_open === false

    const annulBlockedReason = (() => {
        if (!isAnnulBlocked) return ''
        if (impact?.has_folio_invoices) return 'Debe emitir una Nota de Crédito/Débito para ajustar esta orden'
        if ((impact?.work_orders?.length ?? 0) > 0) return 'Existen órdenes de trabajo asociadas. Anule o complete las OT primero'
        if (impact?.has_posted_payments) return 'Existen pagos contabilizados. Debe reversarlos manualmente antes de anular'
        if (impact?.period_open === false) return 'El período contable o tributario actual está cerrado. No se pueden anular documentos'
        return ''
    })()

    const [modal, setModal] = useState<{
        open: boolean
        orderId: number | null
        action: 'soft_cancel' | 'full_annul' | null
        description: React.ReactNode
        variant: 'destructive' | 'warning'
        confirmText: string
        requireReason: boolean
    }>({
        open: false,
        orderId: null,
        action: null,
        description: null,
        variant: 'destructive',
        confirmText: 'Cancelar Orden',
        requireReason: false,
    })

    const requestCancel = useCallback(async (orderId: number) => {
        try {
            const impact: CancelImpact = orderType === 'sale'
                ? await ordersApi.getCancelSaleImpact(orderId)
                : await ordersApi.getCancelPurchaseImpact(orderId)

            const isAnnul = impact.action === 'full_annul'
            setModal({
                open: true,
                orderId,
                action: impact.action as 'soft_cancel' | 'full_annul',
                description: buildImpactDescription(impact),
                variant: isAnnul ? 'warning' : 'destructive',
                confirmText: isAnnul ? 'Anular Todo' : 'Cancelar Orden',
                requireReason: impact.requires_reason ?? isAnnul,
            })
        } catch {
            toast.error('Error al obtener impacto de cancelación')
        }
    }, [orderType])

    const handleConfirm = useCallback(async (reason?: string) => {
        if (!modal.orderId) return
        try {
            if (modal.action === 'full_annul') {
                const annulFn = orderType === 'sale'
                    ? ordersApi.annulSaleOrder
                    : ordersApi.annulPurchaseOrder
                await annulFn(modal.orderId, reason ?? '', true)
            } else {
                await cancelOrder.mutateAsync({ id: modal.orderId, reason })
            }
            setModal(prev => ({ ...prev, open: false, orderId: null }))
            options?.onSuccess?.()
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || 'Error al cancelar orden')
            throw error
        }
    }, [modal.orderId, modal.action, orderType, cancelOrder, options])

    const modalProps: CancelFlowModalProps = {
        open: modal.open,
        onOpenChange: (open: boolean) => setModal(prev => ({ ...prev, open })),
        onConfirm: handleConfirm,
        title: modal.confirmText === 'Anular Todo' ? 'Anular Orden' : 'Cancelar Orden',
        description: modal.description,
        variant: modal.variant,
        confirmText: modal.confirmText,
        requireReason: modal.requireReason,
        reasonLabel: 'Motivo de la anulación',
    }

    return { requestCancel, modalProps, isModalOpen: modal.open, impact, isAnnulBlocked, annulBlockedReason }
}
