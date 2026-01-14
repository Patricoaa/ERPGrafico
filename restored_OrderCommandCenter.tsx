"use client"

import { useState, useEffect, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Settings2,
    Package,
    FileText,
    Banknote,
    ClipboardList,
    TrendingUp,
    Receipt,
    Eye,
    Info,
    Trash2,
    X,
    Hash,
    ScrollText
} from "lucide-react"
import { ActionCategory } from "./ActionCategory"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { TransactionNumberForm } from "@/components/forms/TransactionNumberForm"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface OrderCommandCenterProps {
    orderId: number | null
    type: 'purchase' | 'sale' | 'obligation'
    open: boolean
    onOpenChange: (open: boolean) => void
    onActionSuccess?: () => void
}

const pulseGlow = `
@keyframes pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(var(--primary), 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(var(--primary), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--primary), 0); }
}
@keyframes slide-in-bottom {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes check-draw {
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
}
`

export function OrderCommandCenter({
    orderId,
    type,
    open,
    onOpenChange,
    onActionSuccess
}: OrderCommandCenterProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [userPermissions, setUserPermissions] = useState<string[]>([])
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: any, id: number | string }>({ open: false, type: 'sale_order', id: 0 })
    const [trForm, setTrForm] = useState<{ open: boolean, id: number | null, initialValue: string }>({
        open: false,
        id: null,
        initialValue: ""
    })
    const actionEngineRef = useRef<any>(null)

    const fetchOrderDetails = async () => {
        if (!orderId) return
        setLoading(true)
        try {
            const endpoint =
                type === 'purchase' ? `/purchasing/orders/${orderId}/` :
                    type === 'obligation' ? `/services/obligations/${orderId}/` :
                        `/sales/orders/${orderId}/`
            const response = await api.get(endpoint)
            setOrder(response.data)
        } catch (error) {
            console.error("Error fetching order details:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchUserPermissions = async () => {
        try {
            const response = await api.get('/auth/user/')
            setUserPermissions(response.data.permissions || [])
        } catch (error) {
            console.error("Error fetching permissions:", error)
        }
    }

    useEffect(() => {
        if (open && orderId) {
            fetchOrderDetails()
            fetchUserPermissions()
        }
    }, [open, orderId])

    const handleAnnulDocument = async (id: number, force: boolean = false) => {
        try {
            await api.post(`/billing/invoices/${id}/annul/`, { force })
            toast.success("Documento anulado correctamente")
            fetchOrderDetails()
            onActionSuccess?.()
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || "Error al anular documento"
            if (errorMessage.includes("pagos asociados") && !force) {
                if (confirm("El documento tiene pagos asociados. ¿Deseas anular el documento y todos sus pagos?")) {
                    handleAnnulDocument(id, true)
                }
            } else {
                toast.error(errorMessage)
            }
        }
    }

    const handleDeletePayment = async (id: number) => {
        if (!confirm("¿Está seguro de anular este pago?")) return
        try {
            await api.delete(`/treasury/payments/${id}/`)
            toast.success("Pago anulado correctamente")
            fetchOrderDetails()
            onActionSuccess?.()
        } catch (error: any) {
            toast.error("Error al anular el pago")
        }
    }

    const handleDeleteDraft = async (id: number) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este borrador?")) return
        try {
            await api.delete(`/billing/invoices/${id}/`)
            toast.success("Borrador eliminado correctamente")
            fetchOrderDetails()
            onActionSuccess?.()
        } catch (error: any) {
            toast.error("No se pudo eliminar el borrador")
        }
    }

    const handleAnnulOrder = async (id: number, force: boolean = false) => {
        try {
            await api.post(type === 'purchase' ? `/purchasing/orders/${id}/annul/` : `/sales/orders/${id}/annul/`, { force })
            toast.success("Orden anulada correctamente")
            fetchOrderDetails()
            onActionSuccess?.()
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || "Error al anular orden"
            toast.error(errorMessage)
        }
    }

    if (!order) return null

    const registry = (type === 'purchase' || type === 'obligation') ? purchaseOrderActions : saleOrderActions
    const isSale = type === 'sale'
    const billingActions = registry.notes?.actions || []

    const openDetails = (docType: string, docId: number | string) => {
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'PENDING': 'PENDIENTE',
            'PARTIAL': 'PARCIAL',
            'RECEIVED': 'RECIBIDA',
            'DELIVERED': 'DESPACHADA',
            'POSTED': 'EMITIDA',
            'PAID': 'PAGADA',
            'CANCELLED': 'ANULADA',
            'DRAFT': 'BORRADOR',
            'CONFIRMED': 'CONFIRMADA'
        }
        return labels[status.toUpperCase()] || status
    }

    const totalOTs = order.work_orders?.length || 0
    const totalOTProgress = order.production_progress || 0

    // Resolve Logistics Documents with Nomenclature and individual progress if applicable
    const logisticsDocs = (() => {
        if (order.related_stock_moves?.length > 0) return order.related_stock_moves.map((m: any) => ({
            type: m.move_type_display || 'Movimiento',
            number: `${m.move_type_display || 'Movimiento'} - MOV-${m.id}`,
            icon: Package,
            id: m.id,
            docType: 'inventory',
            status: m.state || 'Realizado'
        }))

        const specificDocs = isSale ? order.related_documents?.deliveries : (order.related_documents?.receipts || order.related_documents?.receptions)
        return (specificDocs || []).map((doc: any) => ({
            type: isSale ? 'Despacho' : 'Recepción',
            number: `${isSale ? 'Despacho' : 'Recepción'} - ${doc.number || doc.reference || `MOV-${doc.id}`}`,
            icon: Package,
            id: doc.id,
            docType: 'inventory',
            status: doc.status
        }))
    })()

    // Calculate dynamic logistics progress - Always use frontend logic to sync with docs
    const logisticsProgress = (() => {
        const lines = order.lines || order.items || []
        if (lines.length === 0) return 0

        const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
        if (totalOrdered === 0) return 100

        const totalProcessed = lines.reduce((acc: number, line: any) => {
            const processed = isSale
                ? (line.quantity_delivered || 0)
                : (line.quantity_received || 0)
            return acc + (parseFloat(processed) || 0)
        }, 0)

        return Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    })()

    // Calculate if there are pending transaction numbers in treasury
    const payments = order.serialized_payments || order.payments_detail || order.related_documents?.payments || []
    const hasPendingTransactions = payments.some((pay: any) => {
        const requiresTR = (
            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'CARD' || pay.payment_method === 'TRANSFER')) ||
            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
        )
        return requiresTR && !pay.transaction_number
    })

    // Calculate if there are issues with invoices (drafts or missing folio)
    const invoices = order.related_documents?.invoices || []
    const billingIsComplete = invoices.length > 0 && !invoices.some((inv: any) =>
        inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
    )

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[95vw] max-w-[1600px] max-h-[95vh] overflow-y-auto bg-background/95 backdrop-blur-md border-border p-0 rounded-xl">
                    <div className="p-6 pb-2">
                        <DialogHeader className="pb-4 border-b">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                        <Settings2 className="h-6 w-6 text-primary" />
                                        {order.document_type === 'SERVICE_OBLIGATION' || type === 'obligation' ? 'Obligación de Servicio' : 'Centro de Comandos'}
                                        <span className="text-muted-foreground font-light mx-2">|</span>
                                        <span className="font-mono text-xl">{type === 'purchase' ? 'OC' : type === 'obligation' ? 'OB' : 'NV'}-{order.number || order.id}</span>
                                    </DialogTitle>
                                    <DialogDescription className="flex items-center gap-4">
                                        <span className="flex items-center gap-1.5 text-xs font-medium">
                                            <span className={cn("w-2 h-2 rounded-full",
                                                order.status === 'PAID' ? 'bg-green-500' :
                                                    order.status === 'CANCELLED' ? 'bg-destructive' :
                                                        'bg-primary'
                                            )} />
                                            {getStatusLabel(order.status_display || order.status)}
                                            <span className="text-muted-foreground/30">|</span>
                                            {new Date(order.created_at || order.date).toLocaleDateString()}
                                            <span className="text-muted-foreground/30 ml-2">|</span>
                                            <span className="text-foreground tracking-tight font-semibold ml-1">
                                                {type === 'purchase' ? order.supplier_name : order.customer_name}
                                            </span>
                                        </span>
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-6 pt-2">
                        {/* Responsive Grid: sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pb-4">

                            {/* 1. Origen */}
                            <PhaseCard
                                title="Origen"
                                icon={TrendingUp}
                                variant={order.status !== 'DRAFT' ? 'success' : 'neutral'}
                                documents={[
                                    {
                                        type: (type === 'obligation' || order.document_type === 'SERVICE_OBLIGATION') ? 'Obligación' : (isSale ? 'Nota de Venta' : 'Orden de Compra'),
                                        number: `${(type === 'obligation' || order.document_type === 'SERVICE_OBLIGATION') ? 'Obligación' : (isSale ? 'Nota de Venta' : 'Orden de Compra')} - ${(isSale ? 'NV' : (type === 'obligation' ? 'OB' : 'OC')) + '-' + (order.number || order.id)}`,
                                        icon: FileText,
                                        id: order.id,
                                        docType: type === 'sale' ? 'sale_order' : (order.document_type === 'SERVICE_OBLIGATION' ? 'service_obligation' : 'purchase_order'),
                                        actions: [
                                            ...(order.status === 'DRAFT' ? [{
                                                icon: Trash2,
                                                title: 'Eliminar Borrador',
                                                color: 'text-red-500 hover:bg-red-500/10',
                                                onClick: () => api.delete(type === 'purchase' ? `/purchasing/orders/${order.id}/` : `/sales/orders/${order.id}/`).then(() => { toast.success("Borrador eliminado"); onActionSuccess?.() })
                                            }] : []),
                                            ...((order.status !== 'CANCELLED' && order.status !== 'DRAFT') ? [{
                                                icon: X,
                                                title: 'Anular Orden',
                                                color: 'text-red-600 hover:bg-red-600/10',
                                                onClick: () => handleAnnulOrder(order.id)
                                            }] : [])
                                        ]
                                    }
                                ]}
                                onViewDetail={openDetails}
                                actions={[]}
                                order={order}
                                userPermissions={userPermissions}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                actionEngineRef={actionEngineRef}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase mb-1">
                                        <ScrollText className="h-3 w-3" />
                                        <span>Productos</span>
                                    </div>
                                    <div className="max-h-[100px] overflow-y-auto custom-scrollbar space-y-1 pr-1 bg-muted/10 rounded p-1.5 border border-border/30">
                                        {(order.lines || order.items || []).map((line: any, idx: number) => (
                                            <div key={idx} className="flex items-start justify-between text-[10px] gap-2 border-b border-border/20 last:border-0 pb-1 mb-1 last:mb-0 last:pb-0">
                                                <span className="font-medium text-foreground line-clamp-2 leading-tight">
                                                    {line.product_name || line.description}
                                                </span>
                                                <span className="shrink-0 font-bold bg-primary/10 px-1 rounded text-primary">
                                                    {Math.round(line.quantity)} {line.uom_name || line.unit_name || 'un'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </PhaseCard>

                            {/* 2. Producción */}
                            {isSale && (
                                <PhaseCard
                                    title="Producción"
                                    icon={ClipboardList}
                                    variant={totalOTs === 0 ? 'neutral' : (totalOTProgress === 100 ? 'success' : 'active')}
                                    documents={order.work_orders?.map((ot: any) => ({
                                        type: 'Orden de Trabajo',
                                        number: `OT - ${ot.code || ot.id}`,
                                        icon: ClipboardList,
                                        id: ot.id,
                                        docType: 'work_order',
                                        status: ot.status,
                                        progressValue: ot.production_progress || 0
                                    })) || []}
                                    onViewDetail={openDetails}
                                    actions={(registry.production?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                                    emptyMessage="Sin órdenes de trabajo"
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    actionEngineRef={actionEngineRef}
                                    showDocProgress={true}
                                    stageId="production"
                                    isComplete={totalOTProgress === 100 && totalOTs > 0}
                                >
                                    {totalOTs > 0 ? (
                                        <div className="space-y-1.5 px-0.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                <span>General</span>
                                                <span className="text-primary">{Math.round(totalOTProgress)}%</span>
                                            </div>
                                            <Progress value={totalOTProgress} className="h-1.5" />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center py-2 px-2 rounded-lg bg-muted/5 border border-dashed border-border/40">
                                            <span className="text-[9px] text-muted-foreground/40 font-medium italic">Sin órdenes de trabajo iniciadas</span>
                                        </div>
                                    )}
                                </PhaseCard>
                            )}

                            {/* 3. Logística */}
                            {order.document_type !== 'SERVICE_OBLIGATION' && (
                                <PhaseCard
                                    title="Logística"
                                    icon={Package}
                                    variant={
                                        logisticsProgress === 100 ? 'success' :
                                            logisticsProgress > 0 ? 'active' : 'neutral'
                                    }
                                    documents={logisticsDocs}
                                    onViewDetail={openDetails}
                                    actions={(registry[isSale ? 'deliveries' : 'receptions']?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                                    emptyMessage="Sin movimientos"
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    actionEngineRef={actionEngineRef}
                                    stageId="logistics"
                                    isComplete={logisticsProgress >= 100}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter">
                                            <Package className="h-3 w-3" />
                                            <span>Estado de Entrega/Recepción</span>
                                        </div>
                                        <div className="max-h-[140px] overflow-y-auto custom-scrollbar space-y-2 pr-2 bg-white/5 rounded-2xl p-3 border border-white/5 shadow-inner">
                                            {(order.lines || order.items || []).map((line: any, idx: number) => {
                                                const total = parseFloat(line.quantity) || 1
                                                const current = parseFloat(isSale ? (line.quantity_delivered || 0) : (line.quantity_received || 0))
                                                const pct = Math.min(100, Math.round((current / total) * 100))

                                                return (
                                                    <div key={idx} className="space-y-1 group/line">
                                                        <div className="flex items-center justify-between text-[11px] gap-2">
                                                            <span className="font-bold text-foreground/80 line-clamp-1 flex-1">
                                                                {line.product_name || line.description}
                                                            </span>
                                                            <span className="shrink-0 font-black text-primary px-1 rounded text-[10px]">
                                                                {Math.round(current)}/{Math.round(total)} {line.uom_name || line.unit_name || 'un'}
                                                            </span>
                                                        </div>
                                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full transition-all duration-1000", pct === 100 ? "bg-green-500/50" : "bg-primary/40")}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </PhaseCard>
                            )}

                            {/* 4. Facturación */}
                            <PhaseCard
                                title="Facturación"
                                icon={Receipt}
                                variant={billingIsComplete ? 'success' : 'neutral'}
                                documents={(order.related_documents?.invoices || []).map((inv: any) => ({
                                    type: inv.type_display,
                                    number: `${inv.type_display} - #${inv.number || 'BORRADOR'}`,
                                    icon: Receipt,
                                    id: inv.id,
                                    docType: 'invoice',
                                    status: inv.status,
                                    actions: [
                                        ...(inv.status === 'DRAFT' || inv.number === 'Draft' ? [{
                                            icon: Trash2,
                                            title: 'Eliminar Borrador',
                                            color: 'text-red-500 hover:bg-red-500/10',
                                            onClick: () => handleDeleteDraft(inv.id)
                                        }] : []),
                                        ...(inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && inv.number !== 'Draft' ? [{
                                            icon: X,
                                            title: 'Anular Documento',
                                            color: 'text-red-600 hover:bg-red-600/10',
                                            onClick: () => handleAnnulDocument(inv.id)
                                        }] : [])
                                    ]
                                }))}
                                onViewDetail={openDetails}
                                actions={[...(registry.documents?.actions || []), ...billingActions].filter((a: any) => !a.id.includes('view-'))}
                                emptyMessage="Pendiente de emisión"
                                order={order}
                                userPermissions={userPermissions}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                actionEngineRef={actionEngineRef}
                            >
                                <div className="p-2.5 bg-muted/20 rounded-lg border border-border/40">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Monto Total</span>
                                        <span className="text-sm font-black text-foreground">${parseFloat(order.total).toLocaleString()}</span>
                                    </div>
                                </div>
                            </PhaseCard>

                            {/* 5. Tesorería */}
                            <PhaseCard
                                title="Tesorería"
                                icon={Banknote}
                                variant={
                                    (order.status === 'PAID' || order.payment_status === 'PAID' || parseFloat(order.pending_amount) <= 0) && !hasPendingTransactions ? 'success' :
                                        (parseFloat(order.pending_amount) < parseFloat(order.total) || hasPendingTransactions) ? 'active' : 'neutral'
                                }
                                documents={(order.serialized_payments || order.payments_detail || order.related_documents?.payments || []).map((pay: any) => ({
                                    type: pay.payment_type === 'INBOUND' ? 'Ingreso' : 'Egreso',
                                    number: `${pay.payment_type === 'INBOUND' ? 'Ingreso' : 'Egreso'} - ${pay.transaction_number || `PAGO-${pay.id}`}`,
                                    icon: Banknote,
                                    id: pay.id,
                                    docType: 'payment',
                                    status: pay.payment_method,
                                    actions: [
                                        ...(((
                                            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'CARD' || pay.payment_method === 'TRANSFER')) ||
                                            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
                                        ) && !pay.transaction_number) ? [{
                                            icon: Hash,
                                            title: 'Registrar N° Transacción',
                                            color: 'text-orange-600 hover:bg-orange-600/10',
                                            onClick: () => setTrForm({
                                                open: true,
                                                id: pay.id,
                                                initialValue: pay.transaction_number || ""
                                            })
                                        }] : []),
                                        {
                                            icon: X,
                                            title: 'Anular Pago',
                                            color: 'text-red-600 hover:bg-red-600/10',
                                            onClick: () => handleDeletePayment(pay.id)
                                        }
                                    ]
                                }))}
                                onViewDetail={openDetails}
                                actions={(registry.payments?.actions || []).filter((a: any) =>
                                    !a.id.includes('view-') &&
                                    (a.id.includes('history') ? (order.related_documents?.payments?.length > 0 || order.payments_detail?.length > 0) : true)
                                )}
                                emptyMessage="Sin pagos registrados"
                                order={order}
                                userPermissions={userPermissions}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                actionEngineRef={actionEngineRef}
                            >
                                <div className="space-y-1.5 px-0.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <span>Pagado</span>
                                        <span className="text-primary">
                                            {Math.round((1 - (order.pending_amount / (order.total || 1))) * 100)}%
                                        </span>
                                    </div>
                                    <Progress
                                        value={(1 - (order.pending_amount / (order.total || 1))) * 100}
                                        className="h-1.5 shadow-inner"
                                    />
                                    <div className="flex justify-between items-center text-[10px] pt-1">
                                        <span className="text-muted-foreground font-semibold">POR PAGAR:</span>
                                        <span className="font-bold text-red-500">${Math.round(order.pending_amount).toLocaleString()}</span>
                                    </div>
                                </div>
                            </PhaseCard>
                        </div>
                    </div>

                    <div className="hidden">
                        <ActionCategory
                            ref={actionEngineRef}
                            category={{ actions: [] } as any}
                            order={order}
                            userPermissions={userPermissions}
                            onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                        />
                    </div>
                </DialogContent>
            </Dialog >

            <TransactionViewModal
                open={detailsModal.open}
                onOpenChange={(isOpen) => setDetailsModal(prev => ({ ...prev, open: isOpen }))}
                type={detailsModal.type}
                id={detailsModal.id}
                view="details"
            />

            <TransactionNumberForm
                open={trForm.open}
                onOpenChange={(isOpen) => setTrForm(prev => ({ ...prev, open: isOpen }))}
                paymentId={trForm.id}
                initialValue={trForm.initialValue}
                onSuccess={fetchOrderDetails}
            />
        </>
    )
}


function PhaseCard({
    title,
    icon: Icon,
    children,
    actions,
    order,
    userPermissions,
    onActionSuccess,
    variant = 'neutral',
    documents = [],
    onViewDetail,
    emptyMessage = "No disponible",
    actionEngineRef,
    showDocProgress = false,
    stageId = '',
    isComplete = false
}: any) {
    const isSuccess = variant === 'success' || isComplete
    const isActive = variant === 'active'

    const variantStyles: Record<string, string> = {
        success: 'border-green-500/40 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]',
        active: 'border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]',
        neutral: 'border-white/10 bg-white/5',
    }

    const iconStyles: Record<string, string> = {
        success: 'bg-green-500/20 text-green-400',
        active: 'bg-primary/20 text-primary',
        neutral: 'bg-white/10 text-muted-foreground',
    }

    const statusDot: Record<string, string> = {
        success: 'bg-green-500 shadow-green-500/50',
        active: 'bg-primary shadow-primary/50 animate-pulse',
        neutral: 'bg-white/20',
    }

    // Separate actions into primary (closing) and secondary
    const categorizedActions = (() => {
        const filtered = actions?.filter((action: any) => {
            if (action.requiredPermissions && !action.requiredPermissions.some((p: string) => userPermissions.includes(p))) {
                return false
            }
            if (action.checkAvailability && !action.checkAvailability(order)) {
                return false
            }
            return true
        }) || []

        const secondaryIds = ['history', 'note', 'view-']
        const secondary = filtered.filter((a: any) => secondaryIds.some(id => a.id.toLowerCase().includes(id)))
        const primary = filtered.filter((a: any) => !secondaryIds.some(id => a.id.toLowerCase().includes(id)))

        return { primary, secondary }
    })()

    return (
        <Card className={cn(
            "flex flex-col h-full transition-all duration-500 border-2 rounded-3xl relative overflow-hidden backdrop-blur-sm group/card",
            variantStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')],
            "hover:translate-y-[-4px] hover:shadow-2xl hover:border-white/20",
            isSuccess && "animate-in fade-in zoom-in-95 duration-700"
        )}>
            {/* Background Gradient for Success */}
            {isSuccess && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent pointer-events-none" />
            )}

            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
                <div className={cn("p-2 rounded-xl shadow-inner transition-transform duration-500 group-hover/card:scale-110", iconStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')])}>
                    {isSuccess ? <div className="relative">
                        <Icon className="h-4 w-4" />
                        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full border-2 border-background">
                            <svg className="w-2 h-2 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div> : <Icon className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                    <h3 className="font-black text-[12px] uppercase tracking-widest text-foreground/90 leading-none">
                        {title}
                    </h3>
                </div>
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px]", statusDot[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')])} />
            </div>

            <CardContent className="p-5 flex-1 flex flex-col gap-6 relative z-10">
                {/* Documents List - Flat Design */}
                <div className="space-y-2 min-h-[60px]">
                    {documents.length > 0 ? (
                        documents.map((doc: any, i: number) => (
                            <div key={i} className="flex flex-col p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all duration-300 gap-2 group/doc shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-background/50 rounded-xl shadow-sm shrink-0">
                                            <doc.icon className="h-4 w-4 text-primary/80" />
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-[11px] font-black text-foreground/90 truncate max-w-[140px]" title={doc.number}>{doc.number}</span>
                                            {doc.status && (
                                                <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">{doc.status}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-40 group-hover/doc:opacity-100 transition-opacity">
                                        {doc.actions?.map((action: any, idx: number) => (
                                            <Button
                                                key={idx}
                                                variant="ghost"
                                                size="icon"
                                                className={cn("h-7 w-7 rounded-lg", action.color, action.isPrimary && "animate-[pulse-glow_2s_infinite] bg-primary/10")}
                                                onClick={(e) => { e.stopPropagation(); action.onClick() }}
                                                title={action.title}
                                            >
                                                <action.icon className="h-4 w-4" />
                                            </Button>
                                        ))}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/20 rounded-lg"
                                            onClick={() => !doc.disabled && onViewDetail?.(doc.docType, doc.id)}
                                            disabled={doc.disabled}
                                            title="Ver Detalles"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {showDocProgress && (doc.progressValue !== undefined) && (
                                    <div className="px-1">
                                        <div className="flex items-center justify-between text-[8px] font-black uppercase mb-1 text-muted-foreground/40 tracking-widest">
                                            <span>Avance</span>
                                            <span>{Math.round(doc.progressValue)}%</span>
                                        </div>
                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary/50 transition-all duration-700" style={{ width: `${doc.progressValue}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-white/10 rounded-2xl bg-white/2">
                            <Info className="h-5 w-5 text-muted-foreground/20 mb-2" />
                            <span className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest">{emptyMessage}</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    {children}
                </div>

                {/* Actions Section */}
                <div className="mt-auto space-y-4">
                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-5 px-3 border border-dotted border-white/10 rounded-2xl bg-white/2">
                            <Settings2 className="h-5 w-5 text-muted-foreground/10 mb-2" />
                            <span className="text-[9px] text-muted-foreground/30 font-black uppercase tracking-widest">Etapa Completada</span>
                        </div>
                    ) : (
                        categorizedActions.primary.length > 0 && (
                            <div className="space-y-3">
                                <div className="h-px bg-white/5 w-full" />
                                <ActionCategory
                                    category={{ actions: categorizedActions.primary } as any}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    layout="grid"
                                    compact={true}
                                />
                            </div>
                        )
                    )}

                    {categorizedActions.secondary.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-[1px] bg-white/5 flex-1" />
                                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">Opciones</span>
                                <div className="h-[1px] bg-white/5 flex-1" />
                            </div>
                            <ActionCategory
                                category={{ actions: categorizedActions.secondary } as any}
                                order={order}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                layout="grid"
                                compact={true}
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function PhaseConnector({ active, complete }: { active: boolean, complete: boolean }) {
    return (
        <div className="hidden lg:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-0 items-center justify-center w-4 h-full">
            <div className={cn(
                "w-full h-[2px] transition-all duration-1000 ease-in-out",
                complete ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]" :
                    active ? "bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]" :
                        "bg-white/10"
            )} />
            <div className={cn(
                "absolute w-2 h-2 rounded-full transition-all duration-1000",
                complete ? "bg-green-500 scale-125" :
                    active ? "bg-primary animate-pulse" :
                        "bg-white/20"
            )} />
        </div>
    )
}
