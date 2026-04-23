import { getErrorMessage } from "@/lib/errors"

import { PhaseCard } from "./PhaseCard"
import { FileText, Trash2, X, Edit, TrendingUp } from "lucide-react"
import { formatDocumentId } from '@/features/orders/utils/status'
import api from "@/lib/api"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { saleOrderActions } from '@/features/sales/actions'
import { purchaseOrderActions } from '@/features/purchasing/actions'
import { Order, OrderLine, PhaseDocument } from "../../types"

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
    const registry = (activeDoc?.document_type === 'PURCHASE_ORDER' || activeDoc?.document_type === 'SERVICE_OBLIGATION') 
        ? purchaseOrderActions 
        : saleOrderActions
    const router = useRouter()
    const isSale = type === 'sale'

    const handleAnnulOrder = async (id: number) => {
        try {
            await api.post(type === 'purchase' ? `/purchasing/orders/${id}/annul/` : `/sales/orders/${id}/annul/`, { force: false })
            toast.success("Orden anulada correctamente")
            onActionSuccess?.()
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error) || "Error al anular orden"
            toast.error(errorMessage)
        }
    }

    const documents: PhaseDocument[] = isNoteMode ? [
        {
            type: 'Documento Rectificado',
            number: formatDocumentId('FACT', activeInvoice?.corrected_invoice?.number || '---', activeInvoice?.corrected_invoice?.display_id),
            icon: FileText,
            id: activeInvoice?.corrected_invoice?.id as number,
            docType: 'invoice',
            actions: []
        },
        ...(order ? [{
            type: isSale ? 'Nota de Venta' : 'Orden de compras y servicios',
            number: formatDocumentId(isSale ? 'NV' : 'OCS', order?.number || order?.id, order?.display_id),
            icon: FileText,
            id: order?.id,
            docType: type === 'obligation' ? 'service_obligation' : (type === 'sale' ? 'sale_order' : 'purchase_order'),
            actions: []
        }] : [])
    ] : (order ? [
        {
            type: isSale ? 'Nota de Venta' : 'Orden de compras y servicios',
            number: formatDocumentId(isSale ? 'NV' : 'OCS', order?.number || order?.id, order?.display_id),
            icon: FileText,
            id: order?.id,
            docType: type === 'obligation' ? 'service_obligation' : (type === 'sale' ? 'sale_order' : 'purchase_order'),
            actions: [
                ...(order?.status === 'DRAFT' ? [{
                    icon: Trash2,
                    title: 'Eliminar Borrador',
                    color: 'text-destructive hover:bg-destructive/10',
                    onClick: () => api.delete(type === 'purchase' ? `/purchasing/orders/${order?.id}/` : `/sales/orders/${order?.id}/`).then(() => { toast.success("Borrador eliminado"); onActionSuccess?.() })
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
            number: formatDocumentId('FACT', activeInvoice?.number || '---', activeInvoice?.display_id),
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
                    <div key={idx} className="flex items-start justify-between text-[10px] gap-2 py-0.5 border-b border-white/5 last:border-0">
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
                        <span className="font-bold text-primary/60 text-[8px] uppercase tracking-widest">Total {(activeDoc?.lines || activeDoc?.items || []).length} ítems</span>
                    </div>
                )}
            </div>
        </PhaseCard>
    )
}
