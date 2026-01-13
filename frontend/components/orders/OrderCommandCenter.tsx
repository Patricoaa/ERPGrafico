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
    FileEdit
} from "lucide-react"
import { ActionCategory } from "./ActionCategory"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface OrderCommandCenterProps {
    orderId: number | null
    type: 'purchase' | 'sale'
    open: boolean
    onOpenChange: (open: boolean) => void
    onActionSuccess?: () => void
}

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
    const actionEngineRef = useRef<any>(null)

    const fetchOrderDetails = async () => {
        if (!orderId) return
        setLoading(true)
        try {
            const endpoint = type === 'purchase' ? `/purchasing/orders/${orderId}/` : `/sales/orders/${orderId}/`
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

    const registry = type === 'purchase' ? purchaseOrderActions : saleOrderActions
    const isSale = type === 'sale'

    // Billing specific actions (Create Note, etc) should be in billing card
    const billingActions = registry.notes?.actions || []

    // Management actions for Origin
    // We handle delete/annul locally per document, so we might filter them out from generic actions
    // BUT user wants to keep the generic "management" buttons OR move them to Origin card.
    // The user request said: "Los botones de anulación deberían estar asignados por cada tarjeta anidada de documento asociado"
    // So we add "Delete" icon to DRAFT Invoice item, "X" icon to POSTED Invoice item.
    // Same for Order in Origin Card.

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

    // Generic logic for stock moves
    const logisticsDocs = (() => {
        // Try generic related_stock_moves first (works for invoices usually)
        if (order.related_stock_moves?.length > 0) return order.related_stock_moves.map((m: any) => ({
            type: m.move_type_display || 'Movimiento',
            number: `MOV-${m.id}`,
            icon: Package,
            id: m.id,
            docType: 'inventory',
            status: m.state || 'Realizado'
        }))

        // Fallback to specific deliveries/receptions on the order object
        const specificDocs = isSale ? order.related_documents?.deliveries : (order.related_documents?.receipts || order.related_documents?.receptions)
        return (specificDocs || []).map((doc: any) => ({
            type: isSale ? 'Despacho' : 'Recepción',
            number: doc.number || doc.reference || `MOV-${doc.id}`,
            icon: Package,
            id: doc.id,
            docType: 'inventory',
            status: doc.status
        }))
    })()

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-full max-w-[98vw] max-h-[95vh] overflow-y-auto bg-background/95 backdrop-blur-md border-border p-0 rounded-xl">
                    <div className="p-6 pb-2">
                        <DialogHeader className="pb-4 border-b">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                        <Settings2 className="h-6 w-6 text-primary" />
                                        {order.document_type === 'SERVICE_OBLIGATION' ? 'Obligación de Servicio' : 'Centro de Comandos'}
                                        <span className="text-muted-foreground font-light mx-2">|</span>
                                        <span className="font-mono text-xl">{type === 'purchase' ? 'OC' : 'NV'}-{order.number}</span>
                                    </DialogTitle>
                                    <DialogDescription className="flex items-center gap-4">
                                        <span className="flex items-center gap-1.5 text-xs font-medium">
                                            <div className={cn("w-2 h-2 rounded-full",
                                                order.status === 'PAID' ? 'bg-green-500' :
                                                    order.status === 'CANCELLED' ? 'bg-destructive' :
                                                        'bg-primary'
                                            )} />
                                            {getStatusLabel(order.status_display || order.status)}
                                            <span className="text-muted-foreground/30">|</span>
                                            {new Date(order.created_at || order.date).toLocaleDateString()}
                                        </span>
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    {/* Main Grid: w-full min-w-max to allow scroll if needed, justify-between to spread if space allows */}
                    <div className="p-6 pt-2 overflow-x-auto custom-scrollbar">
                        <div className="flex gap-4 pb-4 min-w-max">

                            {/* 1. Origen */}
                            <div className="w-[300px] shrink-0">
                                <PhaseCard
                                    title="Origen"
                                    icon={TrendingUp}
                                    variant="neutral"
                                    documents={[
                                        {
                                            type: order.document_type === 'SERVICE_OBLIGATION' ? 'Obligación' : (isSale ? 'Nota de Venta' : 'Orden de Compra'),
                                            number: order.document_type === 'SERVICE_OBLIGATION' ? `OB-${order.id}` : (isSale ? 'NV' : 'OC') + '-' + order.number,
                                            icon: FileText,
                                            id: order.id,
                                            docType: type === 'sale' ? 'sale_order' : (order.document_type === 'SERVICE_OBLIGATION' ? 'service_obligation' : 'purchase_order'),
                                            // Actions for Order
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
                                        },
                                        ...(['CREDIT_NOTE', 'DEBIT_NOTE'].includes(order.document_type) ? [{
                                            type: 'Doc. Origen',
                                            number: `#${order.origin_invoice_number || 'N/A'}`,
                                            icon: Receipt,
                                            id: null,
                                            docType: 'invoice',
                                            disabled: true
                                        }] : [])
                                    ]}
                                    onViewDetail={openDetails}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    actionEngineRef={actionEngineRef}
                                >
                                    <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Total</span>
                                            <span className="text-sm font-black text-foreground">${parseFloat(order.total).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </PhaseCard>
                            </div>

                            {/* 2. Producción */}
                            {isSale && (
                                <div className="w-[300px] shrink-0">
                                    <PhaseCard
                                        title="Producción"
                                        icon={ClipboardList}
                                        variant={totalOTs === 0 ? 'neutral' : (totalOTProgress === 100 ? 'success' : 'active')}
                                        documents={order.work_orders?.map((ot: any) => ({
                                            type: 'Orden de Trabajo',
                                            number: ot.code || `OT-${ot.id}`,
                                            icon: ClipboardList,
                                            id: ot.id,
                                            docType: 'work_order',
                                            status: ot.status
                                        })) || []}
                                        onViewDetail={openDetails}
                                        actions={(registry.production?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                                        emptyMessage="Sin manufactura"
                                        order={order}
                                        userPermissions={userPermissions}
                                        onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                        actionEngineRef={actionEngineRef}
                                    >
                                        {totalOTs > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    <span>Progreso</span>
                                                    <span className="text-primary">{Math.round(totalOTProgress)}%</span>
                                                </div>
                                                <Progress value={totalOTProgress} className="h-1.5" />
                                            </div>
                                        )}
                                    </PhaseCard>
                                </div>
                            )}

                            {/* 3. Logística */}
                            {order.document_type !== 'SERVICE_OBLIGATION' && (
                                <div className="w-[300px] shrink-0">
                                    <PhaseCard
                                        title="Logística"
                                        icon={Package}
                                        variant={
                                            (isSale ? order.delivery_status : order.receiving_status) === 'DELIVERED' ||
                                                (isSale ? order.delivery_status : order.receiving_status) === 'RECEIVED'
                                                ? 'success'
                                                : (isSale ? order.delivery_status : order.receiving_status) === 'PARTIAL'
                                                    ? 'active'
                                                    : 'neutral'
                                        }
                                        documents={logisticsDocs}
                                        onViewDetail={openDetails}
                                        actions={(registry[isSale ? 'deliveries' : 'receptions']?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                                        emptyMessage="Sin movimientos"
                                        order={order}
                                        userPermissions={userPermissions}
                                        onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                        actionEngineRef={actionEngineRef}
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                <span>{isSale ? 'Entregas' : 'Recepciones'}</span>
                                                <span className="text-primary">{(isSale ? order.delivery_progress : order.receiving_progress) || 0}%</span>
                                            </div>
                                            <Progress
                                                value={(isSale ? order.delivery_progress : order.receiving_progress) || 0}
                                                className="h-1.5"
                                            />
                                        </div>
                                    </PhaseCard>
                                </div>
                            )}

                            {/* 4. Facturación */}
                            <div className="w-[300px] shrink-0">
                                <PhaseCard
                                    title="Facturación"
                                    icon={Receipt}
                                    variant={(order.related_documents?.invoices?.length || 0) > 0 ? 'success' : 'neutral'}
                                    documents={(order.related_documents?.invoices || []).map((inv: any) => ({
                                        type: inv.type_display,
                                        number: `#${inv.number || 'BORRADOR'}`,
                                        icon: Receipt,
                                        id: inv.id,
                                        docType: 'invoice',
                                        status: inv.status,
                                        // Actions for Invoice
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
                                    <div className="space-y-3">
                                        {/* Placeholder for visual info in billing if needed */}
                                    </div>
                                </PhaseCard>
                            </div>

                            {/* 5. Tesorería */}
                            <div className="w-[300px] shrink-0">
                                <PhaseCard
                                    title="Tesorería"
                                    icon={Banknote}
                                    variant={
                                        (order.status === 'PAID' || order.payment_status === 'PAID') ? 'success' :
                                            (order.pending_amount < order.total && order.pending_amount > 0) ? 'active' : 'neutral'
                                    }
                                    documents={(order.related_documents?.payments || order.payments_detail || order.serialized_payments || []).map((pay: any) => ({
                                        type: pay.payment_type === 'INBOUND' ? 'Ingreso' : 'Egreso',
                                        number: pay.transaction_number || `PAGO-${pay.id}`,
                                        icon: Banknote,
                                        id: pay.id,
                                        docType: 'payment',
                                        status: pay.payment_method
                                    }))}
                                    onViewDetail={openDetails}
                                    actions={(registry.payments?.actions || []).filter((a: any) => !a.id.includes('view-') && !a.id.includes('history'))}
                                    emptyMessage="Sin pagos registrados"
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    actionEngineRef={actionEngineRef}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            <span>Pagado</span>
                                            <span className="text-primary">
                                                {Math.round((1 - (order.pending_amount / (order.total || 1))) * 100)}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={(1 - (order.pending_amount / (order.total || 1))) * 100}
                                            className="h-1.5"
                                        />
                                        <div className="flex justify-between items-center text-xs pt-1">
                                            <span className="text-muted-foreground">Saldo:</span>
                                            <span className="font-bold text-red-500">${order.pending_amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </PhaseCard>
                            </div>
                        </div>
                    </div>

                    {/* Hidden Action Engine for Global Triggers */}
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
            </Dialog>

            {/* Details Modal */}
            <TransactionViewModal
                open={detailsModal.open}
                onOpenChange={(isOpen) => setDetailsModal(prev => ({ ...prev, open: isOpen }))}
                type={detailsModal.type}
                id={detailsModal.id}
                view="details"
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
    actionEngineRef
}: any) {
    const variantStyles: Record<string, string> = {
        success: 'border-green-500/20 bg-card',
        active: 'border-blue-500/20 bg-card',
        neutral: 'border-border bg-card',
    }

    const iconStyles: Record<string, string> = {
        success: 'bg-green-500/10 text-green-600',
        active: 'bg-blue-500/10 text-blue-600',
        neutral: 'bg-muted text-muted-foreground',
    }

    const statusDot: Record<string, string> = {
        success: 'bg-green-500',
        active: 'bg-blue-500',
        neutral: 'bg-muted-foreground/30',
    }

    return (
        <Card className={cn(
            "flex flex-col h-full shadow-sm hover:shadow-md transition-shadow",
            variantStyles[variant] || variantStyles.neutral
        )}>
            {/* 1. Header */}
            <div className="p-4 border-b border-border/40 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", iconStyles[variant])}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-xs uppercase tracking-wide text-foreground">
                        {title}
                    </h3>
                </div>
                <div className={cn("w-2 h-2 rounded-full", statusDot[variant])} />
            </div>

            <CardContent className="p-4 flex-1 flex flex-col gap-4">

                {/* 2. Documents Section */}
                <div className="space-y-2 min-h-[60px]">
                    {documents.length > 0 ? (
                        documents.map((doc: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border/50 group hover:border-primary/20 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="p-1.5 bg-background rounded-md shadow-sm shrink-0">
                                        <doc.icon className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div className="flex flex-col overflow-hidden max-w-[100px]">
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground truncate">{doc.type}</span>
                                        <span className="text-xs font-bold text-foreground truncate" title={doc.number}>{doc.number}</span>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    {/* Custom Nested Actions (Delete/Annul) */}
                                    {doc.actions?.map((action: any, idx: number) => (
                                        <Button
                                            key={idx}
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-7 w-7", action.color)}
                                            onClick={(e) => { e.stopPropagation(); action.onClick() }}
                                            title={action.title}
                                        >
                                            <action.icon className="h-4 w-4" />
                                        </Button>
                                    ))}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                        onClick={() => !doc.disabled && onViewDetail?.(doc.docType, doc.id)}
                                        disabled={doc.disabled}
                                        title="Ver Detalles"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-4 border-2 border-dashed border-muted/50 rounded-lg bg-muted/10">
                            <Info className="h-4 w-4 text-muted-foreground/30 mb-1" />
                            <span className="text-[10px] text-muted-foreground font-medium">{emptyMessage}</span>
                        </div>
                    )}
                </div>

                <div className="bg-border/30 h-px w-full" />

                {/* 3. Visual Metrics */}
                <div className="min-h-[40px]">
                    {children}
                </div>

                <div className="bg-border/30 h-px w-full" />

                {/* 4. Action Buttons */}
                <div className="mt-auto">
                    {actions && actions.length > 0 ? (
                        <ActionCategory
                            category={{ actions } as any}
                            order={order}
                            userPermissions={userPermissions}
                            onActionSuccess={onActionSuccess}
                            layout="grid"
                            compact={true}
                        />
                    ) : (
                        <p className="text-[10px] text-center text-muted-foreground/50 italic py-2">Sin acciones</p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
