import { getErrorMessage } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { FileText, Trash2, X, Edit, TrendingUp } from "lucide-react"
import { formatEntity } from '@/features/orders/utils/status'
import { toast } from "sonner"
import { useAnnulOrder, useCancelOrder } from "../../hooks/useOrdersMutations"
import { ordersApi } from "../../api/ordersApi"
import { useRouter } from "next/navigation"
import { ActionConfirmModal } from '@/components/shared'
import { saleOrderActions } from '@/features/sales/actions'
import { purchaseOrderActions } from '@/features/purchasing/actions'
import { Order, OrderLine, PhaseDocument } from "../../types"

interface CancelImpact {
    order_status: string
    invoices: { id: number; display_id: string; status: string }[]
    deliveries?: { id: number; status: string }[]
    receipts?: { id: number; status: string }[]
    payments: { id: number; amount: string; status: string }[]
    has_confirmed_deliveries: boolean
    has_posted_payments: boolean
    action: string
}

interface OriginPhaseProps {
    isNoteMode: boolean
    activeInvoice: Order | null
    noteStatuses: Record<string, string | boolean | number>
    order: Order | null
    activeDoc: Order
    type: 'purchase' | 'sale' | 'obligation'
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    onEdit?: (orderId: number) => void
    userPermissions: string[]
    // Accordion props
    collapsible?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export function OriginPhase({
    isNoteMode,
    activeInvoice,
    noteStatuses,
    order,
    activeDoc,
    collapsible,
    isOpen,
    onOpenChange,
    type,
    onActionSuccess,
    openDetails,
    onEdit,
    userPermissions
}: OriginPhaseProps) {
    const isSale = type === 'sale'
    const registry = isSale ? saleOrderActions : purchaseOrderActions
    const router = useRouter()
    const orderType = type === 'obligation' ? 'purchase' : type
    const annulOrder = useAnnulOrder(orderType)
    const cancelOrder = useCancelOrder(orderType)

    const [cancelImpact, setCancelImpact] = useState<CancelImpact | null>(null)
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean
        title: string
        description: React.ReactNode
        onConfirm: () => Promise<void> | void
        variant?: 'destructive' | 'warning'
        confirmText?: string
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const handleCancelOrder = async (id: number, isConfirmed = false) => {
        if (!isConfirmed) {
            try {
                const impact = isSale
                    ? await ordersApi.getCancelSaleImpact(id)
                    : await ordersApi.getCancelPurchaseImpact(id)
                setCancelImpact(impact)

                const items: string[] = [
                    ...impact.invoices.map((i: any) => `• Factura ${i.display_id} — ${i.status}`),
                    ...(impact.deliveries || []).map((d: any) => `• Despacho #${d.id} — ${d.status}`),
                    ...(impact.receipts || []).map((r: any) => `• Recepción #${r.id} — ${r.status}`),
                    ...impact.payments.map((p: any) => `• Pago #${p.id} — ${p.status}`),
                ]

                setConfirmModal({
                    open: true,
                    title: "Cancelar Orden",
                    variant: impact.action === 'full_annul' ? 'warning' : 'destructive',
                    confirmText: impact.action === 'full_annul' ? 'Anular Todo' : 'Cancelar Orden',
                    onConfirm: () => handleCancelOrder(id, true),
                    description: (
                        <div className="flex flex-col gap-2 text-sm">
                            <p>¿Qué desea hacer con esta orden?</p>
                            <p className="text-xs text-muted-foreground">
                                {impact.action === 'full_annul'
                                    ? 'Se revertirán asientos contables y movimientos de stock.'
                                    : 'Se cancelarán los documentos en Borrador sin reversos.'}
                            </p>
                            {items.length > 0 && (
                                <div className="flex flex-col gap-0.5 text-xs font-mono bg-muted p-2 rounded">
                                    {items.map((line, i) => (
                                        <span key={i}>{line}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ),
                })
            } catch {
                toast.error("Error al obtener impacto de cancelación")
            }
            return
        }

        try {
            await cancelOrder.mutateAsync(id)
            setConfirmModal(prev => ({ ...prev, open: false }))
            setCancelImpact(null)
            onActionSuccess?.()
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error) || "Error al cancelar orden"
            toast.error(errorMessage)
        }
    }

    const handleAnnulOrder = async (id: number) => {
        try {
            await annulOrder.mutateAsync(id)
            onActionSuccess?.()
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error) || "Error al anular orden"
            toast.error(errorMessage)
        }
    }

    const documents: PhaseDocument[] = isNoteMode ? [
        {
            type: 'Documento Rectificado',
            number: formatEntity('FACT', activeInvoice?.corrected_invoice?.number || '---', activeInvoice?.corrected_invoice?.display_id),
            icon: FileText,
            id: activeInvoice?.corrected_invoice?.id as number,
            docType: 'invoice',
            actions: []
        },
        ...(order ? [{
            type: isSale ? 'Nota de Venta' : 'Orden de compras y servicios',
            number: formatEntity(isSale ? 'NV' : 'OCS', order?.number || order?.id, order?.display_id),
            icon: FileText,
            id: order?.id,
            docType: type === 'obligation' ? 'service_obligation' : (type === 'sale' ? 'sale_order' : 'purchase_order'),
            actions: []
        }] : [])
    ] : (order ? [
        {
            type: isSale ? 'Nota de Venta' : 'Orden de compras y servicios',
            number: formatEntity(isSale ? 'NV' : 'OCS', order?.number || order?.id, order?.display_id),
            icon: FileText,
            id: order?.id,
            docType: type === 'obligation' ? 'service_obligation' : (type === 'sale' ? 'sale_order' : 'purchase_order'),
            actions: [
                    ...(order?.status === 'DRAFT' ? [{
                    icon: Trash2,
                    title: 'Cancelar Orden',
                    color: 'text-destructive hover:bg-destructive/10',
                    onClick: () => handleCancelOrder(order?.id)
                }] : []),
                ...((order?.status !== 'CANCELLED' && order?.status !== 'DRAFT') ? [{
                    icon: X,
                    title: 'Anular Orden',
                    color: 'text-destructive hover:bg-destructive/10',
                    onClick: () => handleAnnulOrder(order?.id)
                }] : [])
            ]
        }
    ] : (activeInvoice ? [
        {
            type: activeInvoice?.dte_type_display || 'Factura Directa',
            number: formatEntity('FACT', activeInvoice?.number || '---', activeInvoice?.display_id),
            icon: FileText,
            id: activeInvoice?.id,
            docType: 'invoice',
            actions: []
        }
    ] : []))

    const actions = isNoteMode ? [] : (order ? [
        ...(order.status === 'DRAFT' ? [{
            id: 'edit-order',
            label: 'Editar Orden',
            icon: Edit,
            onClick: () => {
                if (type === 'purchase') {
                    if (onEdit) {
                        onEdit(order?.id)
                    } else {
                        router.push(`/purchasing/checkout?orderId=${order?.id}`)
                    }
                } else {
                    toast.info("Edición de ventas no implementada desde aquí")
                }
            }
        }] : [])
    ] : [])

    return (
        <>
        <PhaseCard
            title="Origen"
            icon={TrendingUp}
            variant={(isNoteMode ? noteStatuses.origin : (activeDoc.status === 'CANCELLED' ? 'destructive' : 'success')) as any}
            isComplete={isNoteMode && noteStatuses.origin === 'success'}
            documents={documents}
            onViewDetail={openDetails}
            actions={actions}
            order={activeDoc}
            userPermissions={userPermissions}
            onActionSuccess={onActionSuccess}
            collapsible={collapsible}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
        >
            <div className="flex flex-col gap-1">
                {(activeDoc?.lines || activeDoc?.items || []).slice(0, 3).map((line: OrderLine, idx: number) => (
                    <div key={idx} className="flex items-start justify-between text-[10px] gap-2 py-0.5 border-b border-border last:border-0">
                        <span className="text-foreground/70 line-clamp-1 leading-tight flex-1">
                            {line.product_name || line.description}
                        </span>
                        <span className="shrink-0 font-black text-primary text-[11px]">
                            {Math.round(line.quantity as number)} {line.uom_name || line.unit_name || 'un'}
                        </span>
                    </div>
                ))}
                {(activeDoc?.lines || activeDoc?.items || []).length > 3 && (
                    <div className="text-[9px] text-muted-foreground/60 italic pt-1 flex justify-between items-center border-t border-border/10 mt-1">
                        <span>Y {(activeDoc?.lines || activeDoc?.items || []).length - 3} productos más...</span>
                        <span className="font-bold text-primary/60 text-[9px] uppercase tracking-widest">Total {(activeDoc?.lines || activeDoc?.items || []).length} ítems</span>
                    </div>
                )}
            </div>
        </PhaseCard>

            <ActionConfirmModal
                open={confirmModal.open}
                onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}
                title={confirmModal.title}
                description={confirmModal.description}
                onConfirm={confirmModal.onConfirm}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
            />
        </>
    )
}
