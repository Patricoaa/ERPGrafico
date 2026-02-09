"use client"

import { useRouter } from "next/navigation"

import { useState, useEffect, useRef } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

import { BaseModal } from "@/components/shared/BaseModal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
    ScrollText,
    LayoutDashboard,
    CheckCircleIcon,
    PlayCircle,
    AlertCircle,
    XCircle,
    Edit,
    Check,
    Ban,
    FileBadge
} from "lucide-react"
import { ActionCategory } from "./ActionCategory"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { TransactionNumberForm } from "@/components/forms/TransactionNumberForm"
import { cn, translateStatus, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { getHubStatuses, getNoteHubStatuses } from "@/lib/order-status-utils"

interface OrderCommandCenterProps {
    orderId?: number | null
    invoiceId?: number | null
    type: 'purchase' | 'sale' | 'obligation'
    open: boolean
    onOpenChange: (open: boolean) => void
    onActionSuccess?: () => void
    onEdit?: (orderId: number) => void
    posSessionId?: number | null
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

// Helper to prevent duplicate prefixes (e.g. OC-OC-123)
const formatDocumentId = (prefix: string, number: string | number, displayId?: string) => {
    if (displayId) return displayId
    const numStr = String(number || '')
    const cleanPrefix = prefix.replace('-', '') // Handle both "OC" and "OC-" inputs if needed, though we usually pass "OC"

    // Check if it already starts with the prefix (case insensitive)
    if (numStr.toUpperCase().startsWith(cleanPrefix.toUpperCase())) {
        return numStr
    }
    return `${prefix}-${numStr}`
}

export function OrderCommandCenter({
    orderId,
    invoiceId,
    type,
    open,
    onOpenChange,
    onActionSuccess,
    onEdit,
    posSessionId = null
}: OrderCommandCenterProps) {
    const [order, setOrder] = useState<any>(null)
    const [activeInvoice, setActiveInvoice] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [userPermissions, setUserPermissions] = useState<string[]>([])
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: any, id: number | string }>({ open: false, type: 'sale_order', id: 0 })
    const { openWorkOrder } = useGlobalModals()
    const [trForm, setTrForm] = useState<{ open: boolean, id: number | null, initialValue: string }>({
        open: false,
        id: null,
        initialValue: ""
    })
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean,
        title: string,
        description: React.ReactNode,
        onConfirm: () => Promise<void> | void,
        variant?: 'destructive' | 'warning',
        confirmText?: string
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })
    const actionEngineRef = useRef<any>(null)

    const fetchOrderDetails = async () => {
        if (!orderId && !invoiceId) return
        setLoading(true)
        try {
            // Priority 1: Fetch Specific Invoice if provided
            if (invoiceId) {
                const invRes = await api.get(`/billing/invoices/${invoiceId}/`)
                setActiveInvoice(invRes.data)

                // If it belongs to an order, fetch order too for context
                if (invRes.data.sale_order || invRes.data.purchase_order) {
                    const oType = invRes.data.sale_order ? 'sales' : 'purchasing'
                    const oId = invRes.data.sale_order || invRes.data.purchase_order
                    const orderRes = await api.get(`/${oType}/orders/${oId}/`)
                    setOrder(orderRes.data)
                } else {
                    // Standalone invoice
                    setOrder(null)
                }
            } else if (orderId) {
                const endpoint =
                    type === 'purchase' ? `/purchasing/orders/${orderId}/` :
                        `/sales/orders/${orderId}/`
                const response = await api.get(endpoint)
                setOrder(response.data)
                setActiveInvoice(null)
            }
        } catch (error) {
            console.error("Error fetching order/invoice details:", error)
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

    const [showAnimations, setShowAnimations] = useState(false)

    useEffect(() => {
        if (open && (orderId || invoiceId)) {
            fetchOrderDetails()
            fetchUserPermissions()
        } else {
            setOrder(null)
            setActiveInvoice(null)
            setShowAnimations(false)
        }
    }, [open, orderId, invoiceId])

    const router = useRouter()

    useEffect(() => {
        if (order) {
            // Small delay to ensure the initial 0 is rendered before the target value
            const timer = setTimeout(() => setShowAnimations(true), 100)
            return () => clearTimeout(timer)
        }
    }, [order])

    const handleConfirmOrder = async (id: number) => {
        try {
            await api.post(`/purchasing/orders/${id}/confirm/`)
            toast.success("Orden confirmada correctamente")
            fetchOrderDetails()
            onActionSuccess?.()
        } catch (error: any) {
            toast.error("Error al confirmar la orden")
        }
    }

    const handleAnnulDocument = async (id: number, force: boolean = false) => {
        try {
            await api.post(`/billing/invoices/${id}/annul/`, { force })
            toast.success("Documento anulado correctamente")
            setConfirmModal(prev => ({ ...prev, open: false }))
            fetchOrderDetails()
            onActionSuccess?.()
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || "Error al anular documento"
            if (errorMessage.includes("pagos asociados") && !force) {
                setConfirmModal({
                    open: true,
                    title: "Anular Documento con Pagos",
                    variant: "warning",
                    confirmText: "Anular Todo",
                    onConfirm: () => handleAnnulDocument(id, true),
                    description: "El documento tiene pagos asociados. ¿Deseas anular el documento y todos sus pagos vinculados? Esta acción es irreversible."
                })
            } else {
                toast.error(errorMessage)
            }
        }
    }

    const handleDeletePayment = async (id: number, isConfirmed = false) => {
        if (!isConfirmed) {
            setConfirmModal({
                open: true,
                title: "Eliminar/Anular Pago",
                variant: "destructive",
                confirmText: "Eliminar",
                onConfirm: () => handleDeletePayment(id, true),
                description: "¿Está seguro de que desea eliminar este pago?"
            })
            return
        }

        try {
            await api.delete(`/treasury/payments/${id}/`)
            toast.success("Pago eliminado correctamente")
            setConfirmModal(prev => ({ ...prev, open: false }))
            fetchOrderDetails()
            onActionSuccess?.()
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || ""
            // Identify if error is due to POSTED status (standardize backend to return this specific code/msg)
            if (errorMessage.includes("publicado") || error.response?.status === 400) {
                // Close previous modal
                setConfirmModal(prev => ({ ...prev, open: false }))

                // Open new modal for Annulment
                setTimeout(() => {
                    setConfirmModal({
                        open: true,
                        title: "Anular Pago Confirmado",
                        variant: "warning",
                        confirmText: "Anular Pago",
                        onConfirm: async () => {
                            try {
                                await api.post(`/treasury/payments/${id}/annul/`)
                                toast.success("Pago anulado correctamente")
                                setConfirmModal(prev => ({ ...prev, open: false }))
                                fetchOrderDetails()
                                onActionSuccess?.()
                            } catch (err: any) {
                                toast.error(err.response?.data?.error || "Error al anular pago")
                            }
                        },
                        description: "No se puede eliminar un pago ya contabilizado. ¿Desea ANULARLO en su lugar? Esto creará un contra-asiento contable."
                    })
                }, 100)
            } else {
                toast.error(errorMessage || "Error al eliminar el pago")
            }
        }
    }

    const handleDeleteDraft = async (id: number, isConfirmed = false) => {
        if (!isConfirmed) {
            setConfirmModal({
                open: true,
                title: "Eliminar Borrador",
                variant: "destructive",
                confirmText: "Eliminar Borrador",
                onConfirm: () => handleDeleteDraft(id, true),
                description: "¿Estás seguro de que deseas eliminar este borrador de factura? Esta acción no se puede deshacer."
            })
            return
        }

        try {
            await api.delete(`/billing/invoices/${id}/`)
            toast.success("Borrador eliminado correctamente")
            setConfirmModal(prev => ({ ...prev, open: false }))
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

    const handleAnnulWorkOrder = async (id: number) => {
        setConfirmModal({
            open: true,
            title: "Anular Orden de Trabajo",
            variant: "destructive",
            confirmText: "Anular OT",
            onConfirm: async () => {
                try {
                    await api.post(`/production/orders/${id}/annul/`)
                    toast.success("OT anulada correctamente")
                    setConfirmModal(prev => ({ ...prev, open: false }))
                    fetchOrderDetails()
                } catch (error: any) {
                    toast.error(error.response?.data?.error || "Error al anular OT")
                }
            },
            description: "Esta acción reverterá los consumos de materiales y liberará las reservas. ¿Está seguro?"
        })
    }

    const handleAnnulLogistics = async (id: number, docType: string) => {
        const isDelivery = docType === 'sale_delivery'
        let label = 'Documento'
        if (docType === 'sale_delivery') label = 'Despacho'
        else if (docType === 'purchase_receipt') label = 'Recepción'
        else if (docType === 'sale_return' || docType === 'purchase_return') label = 'Devolución'

        setConfirmModal({
            open: true,
            title: `Anular ${label}`,
            variant: "destructive",
            confirmText: `Anular ${label}`,
            onConfirm: async () => {
                try {
                    let endpoint = ''
                    if (docType === 'sale_delivery') endpoint = `/sales/deliveries/${id}/annul/`
                    else if (docType === 'purchase_receipt') endpoint = `/purchasing/receipts/${id}/annul/`
                    else if (docType === 'sale_return') endpoint = `/sales/returns/${id}/annul/`
                    else if (docType === 'purchase_return') endpoint = `/purchasing/returns/${id}/annul/`

                    await api.post(endpoint)
                    toast.success(`${label} anulado correctamente`)
                    setConfirmModal(prev => ({ ...prev, open: false }))
                    fetchOrderDetails()
                } catch (error: any) {
                    toast.error(error.response?.data?.error || `Error al anular ${label}`)
                }
            },
            description: `Esta acción reverterá los movimientos de inventario asociados. ¿Está seguro de anular este ${label.toLowerCase()}?`
        })
    }

    if (!order && !activeInvoice) return null

    const isNoteMode = activeInvoice && ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(activeInvoice.dte_type)
    const isCreditNote = activeInvoice?.dte_type === 'NOTA_CREDITO'
    const activeDoc = activeInvoice || order
    if (!activeDoc) return null

    const registry = (type === 'purchase' || type === 'obligation') ? purchaseOrderActions : saleOrderActions
    const isSale = type === 'sale'
    const billingActions = registry.notes?.actions || []

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            openWorkOrder(Number(docId))
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    const getStatusLabel = (status: string) => {
        return translateStatus(status).toUpperCase()
    }

    // Production Progress
    const totalOTs = activeDoc.work_orders?.length || 0
    const totalOTProgress = totalOTs > 0
        ? (activeDoc.work_orders || []).reduce((sum: number, ot: any) => sum + (ot.production_progress || 0), 0) / totalOTs
        : 0

    // Calculate if there are issues with invoices (drafts or missing folio)
    // MUST be declared before logisticsDocs since it's used there
    const invoices = activeDoc.related_documents?.invoices || []
    // Unified Note Status Logic
    const noteStatuses = getNoteHubStatuses(activeInvoice || {})
    const billingIsComplete = (() => {
        if (isNoteMode) return noteStatuses.billing === 'success'
        return invoices.length > 0 && !invoices.some((inv: any) =>
            inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
        )
    })()

    // Resolve Logistics Documents with Nomenclature and individual progress if applicable
    const logisticsDocs = (() => {
        const docs: any[] = []

        // 1. [NEW] Returns for Notes/Orders
        if (activeDoc.related_returns?.length > 0) {
            docs.push(...activeDoc.related_returns.map((doc: any) => ({
                type: doc.type,
                number: formatDocumentId('DEV', doc.number || doc.id, doc.display_id),
                icon: Package,
                id: doc.id,
                docType: doc.docType,
                status: doc.status,
                actions: [
                    ...((doc.status !== 'CANCELLED') ? [{
                        icon: Ban,
                        title: 'Anular Devolución',
                        color: 'text-orange-500 hover:bg-orange-500/10',
                        onClick: () => handleAnnulLogistics(doc.id, doc.docType)
                    }] : [])
                ]
            })))
        }

        // 2. High-level Deliveries/Receipts
        const specificDocs = isSale ? activeDoc.related_documents?.deliveries : (activeDoc.related_documents?.receipts || activeDoc.related_documents?.receptions)
        if (specificDocs?.length > 0) {
            docs.push(...specificDocs.map((doc: any) => ({
                type: isSale ? 'Despacho' : 'Recepción',
                number: formatDocumentId(isSale ? 'DES' : 'REC', doc.number || doc.id, doc.display_id),
                icon: Package,
                id: doc.id,
                docType: doc.docType || (isSale ? 'sale_delivery' : 'inventory'),
                status: doc.status,
                actions: [
                    ...((doc.status !== 'CANCELLED' && invoices.some((inv: any) => inv.status === 'DRAFT')) ? [{
                        icon: Ban,
                        title: isSale ? 'Anular Despacho' : 'Anular Recepción',
                        color: 'text-orange-500 hover:bg-orange-500/10',
                        onClick: () => handleAnnulLogistics(doc.id, isSale ? 'sale_delivery' : 'purchase_receipt')
                    }] : [])
                ]
            })))
        }

        // 3. Low-level Stock Moves (only if no high-level docs found to avoid clutter)
        if (docs.length === 0 && activeDoc.related_stock_moves?.length > 0) {
            docs.push(...activeDoc.related_stock_moves.map((m: any) => ({
                type: m.move_type_display || 'Movimiento',
                number: formatDocumentId('MOV', m.id, m.display_id),
                icon: Package,
                id: m.id,
                docType: 'inventory',
                status: m.state || 'Realizado',
                actions: []
            })))
        }

        return docs
    })()

    // Calculate dynamic logistics progress - Always use frontend logic to sync with docs
    const logisticsProgress = isNoteMode ? noteStatuses.logisticsProgress : (() => {
        const lines = activeDoc.lines || activeDoc.items || []
        if (lines.length === 0) return 0

        const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
        if (totalOrdered === 0) return 100

        const totalProcessed = lines.reduce((acc: number, line: any) => {
            const processedField = isSale
                ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

            const processed = line[processedField] || 0
            return acc + (parseFloat(processed) || 0)
        }, 0)

        return Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    })()

    // Calculate if there are pending transaction numbers in treasury
    const payments = activeDoc.serialized_payments || activeDoc.payments_detail || activeDoc.related_documents?.payments || []
    const hasPendingTransactions = payments.some((pay: any) => {
        const requiresTR = (
            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'CARD' || pay.payment_method === 'TRANSFER')) ||
            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
        )
        return requiresTR && !pay.transaction_number
    })

    const getGlobalStatus = () => {
        const docToEvaluate = isNoteMode ? activeInvoice : order
        if (docToEvaluate.status === 'CANCELLED') return { label: 'Anulado', variant: 'destructive', icon: XCircle }

        if (isNoteMode) {
            if (noteStatuses.isComplete) return { label: 'Completado', variant: 'success', icon: CheckCircleIcon }

            const hasProgress = noteStatuses.logistics !== 'neutral' || noteStatuses.treasury !== 'neutral'
            if (hasProgress) return { label: 'En Progreso', variant: 'active', icon: PlayCircle }

            return { label: 'Borrador', variant: 'neutral', icon: AlertCircle }
        }

        // Logic for completado/progreso/pendiente based on phases
        const stages = []
        if (isSale && totalOTs > 0) stages.push(totalOTProgress === 100)
        if (activeDoc.document_type !== 'SERVICE_OBLIGATION') stages.push(logisticsProgress === 100)
        stages.push(billingIsComplete)
        stages.push((activeDoc.status === 'PAID' || activeDoc.payment_status === 'PAID' || parseFloat(activeDoc.pending_amount || '0') <= 0) && !hasPendingTransactions)

        if (stages.every(s => s)) return { label: 'Completado', variant: 'success', icon: CheckCircleIcon }
        if (stages.some(s => s)) return { label: 'En Progreso', variant: 'active', icon: PlayCircle }

        return { label: 'Pendiente', variant: 'neutral', icon: AlertCircle }
    }

    const globalStatus = getGlobalStatus()
    const StatusIcon = globalStatus.icon

    // Calculate visible columns for dynamic width
    const showProduction = isSale && !isCreditNote && ((order?.work_orders?.length || 0) > 0 || (activeDoc.lines || activeDoc.items || []).some((l: any) => l.is_manufacturable))
    const showLogistics = (activeDoc.lines || activeDoc.items || []).length > 0 && !(activeDoc.lines || activeDoc.items || []).every((l: any) => l.product_type === 'SUBSCRIPTION')

    let visibleCols = 3 // Origen, Facturación, Tesorería
    if (showProduction) visibleCols++
    if (showLogistics) visibleCols++

    const maxWidth = {
        5: "max-w-[1600px]",
        4: "max-w-[1300px]",
        3: "max-w-[1000px]"
    }[visibleCols as 3 | 4 | 5] || "max-w-[1600px]"

    const gridCols = {
        5: "lg:grid-cols-5",
        4: "lg:grid-cols-4",
        3: "lg:grid-cols-3"
    }[visibleCols as 3 | 4 | 5] || "lg:grid-cols-5"

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                size="full"
                className={cn("bg-background/95 backdrop-blur-md border-border transition-all duration-500", maxWidth)}
                contentClassName="p-0"
                title={
                    <div className="flex items-center gap-3">
                        <LayoutDashboard className="h-6 w-6 text-primary" />
                        {isNoteMode ? (
                            <span className="flex items-center gap-2">
                                HUB de {activeInvoice.dte_type_display} {(activeInvoice.number && activeInvoice.number !== 'Draft') ? `${activeInvoice.dte_type === 'NOTA_CREDITO' ? 'NC-' : 'ND-'}${activeInvoice.number}` : '(BORRADOR)'}
                            </span>
                        ) : "HUB de mando"}
                        <span className="text-muted-foreground font-light mx-2">|</span>
                        <Badge
                            variant='outline'
                            className={cn(
                                "rounded-sm border-2 px-2 py-0.5 gap-1.5 font-bold uppercase tracking-tight text-[10px]",
                                globalStatus.variant === 'success' && "border-green-600 text-green-600 dark:border-green-400 dark:text-green-400 bg-green-500/5",
                                globalStatus.variant === 'active' && "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-500/5",
                                globalStatus.variant === 'destructive' && "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400 bg-red-500/5",
                                globalStatus.variant === 'neutral' && "border-muted-foreground text-muted-foreground bg-muted/5"
                            )}
                        >
                            <StatusIcon className='size-3' />
                            {globalStatus.label}
                        </Badge>
                    </div>
                }
                description={
                    <span className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                            <span className="text-muted-foreground/30 ml-2">
                                {isNoteMode ? (activeInvoice.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND') : (type === 'purchase' ? 'OCS' : type === 'obligation' ? 'OB' : 'NV')}
                                -{activeDoc.number || activeDoc.id}
                            </span>
                            <span className="text-muted-foreground/30">|</span>
                            {new Date(activeDoc.created_at || activeDoc.date).toLocaleDateString()}
                            <span className="text-muted-foreground/30 ml-2">|</span>
                            <span className="text-foreground tracking-tight font-semibold ml-1">
                                {isNoteMode ? (activeDoc.contact_name || activeDoc.contact?.name) : (type === 'purchase' ? activeDoc.supplier_name : activeDoc.customer_name)}
                            </span>
                        </span>
                    </span>
                }
            >
                <TooltipProvider delayDuration={0}>
                    <div className="p-6 pt-2">
                        {/* Responsive Grid: dynamic columns based on content */}
                        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4", gridCols)}>

                            {/* 1. Origen */}
                            <PhaseCard
                                title="Origen"
                                icon={TrendingUp}
                                variant={isNoteMode ? noteStatuses.origin : (activeDoc.status !== 'DRAFT' ? 'success' : 'neutral')}
                                isComplete={isNoteMode && noteStatuses.origin === 'success'}
                                documents={isNoteMode ? [
                                    {
                                        type: 'Documento Rectificado',
                                        number: formatDocumentId('FACT', activeInvoice?.corrected_invoice?.number || '---', activeInvoice?.corrected_invoice?.display_id),
                                        icon: FileText,
                                        id: activeInvoice?.corrected_invoice?.id,
                                        docType: 'invoice',
                                        actions: []
                                    }
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
                                                color: 'text-red-500 hover:bg-red-500/10',
                                                onClick: () => api.delete(type === 'purchase' ? `/purchasing/orders/${order?.id}/` : `/sales/orders/${order?.id}/`).then(() => { toast.success("Borrador eliminado"); onActionSuccess?.() })
                                            }] : []),
                                            ...((order?.status !== 'CANCELLED' && order?.status !== 'DRAFT') ? [{
                                                icon: X,
                                                title: 'Anular Orden',
                                                color: 'text-red-600 hover:bg-red-600/10',
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
                                ] : []))}
                                onViewDetail={openDetails}
                                actions={isNoteMode ? [] : (order ? [
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
                                ] : [])}
                                order={activeDoc}
                                userPermissions={userPermissions}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                actionEngineRef={actionEngineRef}
                            >
                                <div className="space-y-1 py-1">
                                    {(activeDoc?.lines || activeDoc?.items || []).map((line: any, idx: number) => (
                                        <div key={idx} className="flex items-start justify-between text-[10px] gap-2 py-0.5 border-b border-white/5 last:border-0">
                                            <span className="text-foreground/70 line-clamp-2 leading-tight">
                                                {line.product_name || line.description}
                                            </span>
                                            <span className="shrink-0 font-bold text-primary/80">
                                                {Math.round(line.quantity)} {line.uom_name || line.unit_name || 'un'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </PhaseCard>

                            {/* 2. Producción */}
                            {showProduction && (
                                <PhaseCard
                                    title="Producción"
                                    icon={ClipboardList}
                                    variant={totalOTs === 0 ? 'neutral' : (totalOTProgress === 100 ? 'success' : 'active')}
                                    documents={activeDoc.work_orders?.map((ot: any) => ({
                                        type: 'Orden de Trabajo',
                                        number: ot.display_id || `OT-${ot.code || ot.id}`,
                                        icon: ClipboardList,
                                        id: ot.id,
                                        docType: 'work_order',
                                        status: ot.status,
                                        progressValue: ot.production_progress || 0,
                                        actions: [
                                            // Only show OT annulment if invoice is DRAFT and stage is pre-impresion or earlier
                                            ...((ot.status !== 'CANCELLED' &&
                                                invoices.some((inv: any) => inv.status === 'DRAFT') &&
                                                ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(ot.current_stage)) ? [{
                                                    icon: Ban,
                                                    title: 'Anular OT',
                                                    color: 'text-orange-500 hover:bg-orange-500/10',
                                                    onClick: () => handleAnnulWorkOrder(ot.id)
                                                }] : [])
                                        ]
                                    })) || []}
                                    onViewDetail={openDetails}
                                    actions={(registry.production?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                                    emptyMessage="Sin órdenes de trabajo"
                                    order={activeDoc}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    actionEngineRef={actionEngineRef}
                                    showDocProgress={true}
                                    stageId="production"
                                    isComplete={totalOTProgress === 100 && totalOTs > 0}
                                >
                                    {totalOTs > 0 ? (
                                        <div className="space-y-1 px-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/60">
                                                <span>PROGRESO</span>
                                                <span className="text-primary">{Math.round(showAnimations ? totalOTProgress : 0)}%</span>
                                            </div>
                                            <Progress value={showAnimations ? totalOTProgress : 0} className="h-1 bg-white/5 transition-all duration-1000" />
                                        </div>
                                    ) : (
                                        <div className="py-2 text-center text-[9px] text-muted-foreground/30 italic">Sin inicio</div>
                                    )}
                                </PhaseCard>
                            )}

                            {/* 3. Logística / Cumplimiento */}
                            {showLogistics && (
                                <PhaseCard
                                    title={(() => {
                                        const lines = activeDoc?.lines || activeDoc?.items || []
                                        const allServices = lines.every((l: any) => ['SERVICE', 'SUBSCRIPTION'].includes(l.product_type))
                                        const hasServices = lines.some((l: any) => ['SERVICE', 'SUBSCRIPTION'].includes(l.product_type))
                                        const onlySubscriptions = lines.every((l: any) => l.product_type === 'SUBSCRIPTION')

                                        if (onlySubscriptions) return 'Suscripciones'
                                        return allServices ? 'Cumplimiento' : (hasServices ? 'Logística/Cumplimiento' : 'Logística')
                                    })()}
                                    icon={Package}
                                    variant={isNoteMode ? noteStatuses.logistics : (logisticsProgress === 100 ? 'success' : logisticsProgress > 0 ? 'active' : 'neutral')}
                                    documents={logisticsDocs}
                                    onViewDetail={openDetails}
                                    actions={(isNoteMode ? (registry[isSale ? 'deliveries' : 'receptions']?.actions || registry.returns?.actions || []) : (registry[isSale ? 'deliveries' : 'receptions']?.actions || [])).filter((a: any) => !a.id.includes('view-'))}
                                    emptyMessage={isNoteMode ? "Sin movimientos asociados" : "Sin movimientos"}
                                    order={activeDoc}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    actionEngineRef={actionEngineRef}
                                    stageId="logistics"
                                    isComplete={logisticsProgress >= 100}
                                >
                                    <div className="space-y-1.5 py-1">
                                        {(activeDoc?.lines || activeDoc?.items || []).map((line: any, idx: number) => {
                                            const total = parseFloat(line.quantity) || 1
                                            const processedField = isSale
                                                ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                                                : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

                                            const current = parseFloat(line[processedField] || 0)
                                            const pct = Math.min(100, Math.round((current / total) * 100))

                                            return (
                                                <div key={idx} className="space-y-0.5">
                                                    <div className="flex items-center justify-between text-[10px] gap-2">
                                                        <span className="text-foreground/70 line-clamp-1 flex-1">
                                                            {line.product_name || line.description}
                                                        </span>
                                                        <span className="shrink-0 font-bold text-primary/80">
                                                            {Math.round(showAnimations ? current : 0)}/{Math.round(total)}
                                                        </span>
                                                    </div>
                                                    <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn("h-full transition-all duration-1000", pct === 100 ? "bg-green-500/30" : "bg-primary/30")}
                                                            style={{ width: `${showAnimations ? pct : 0}%` }}
                                                            role="progressbar"
                                                            aria-valuenow={pct}
                                                            aria-valuemin={0}
                                                            aria-valuemax={100}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </PhaseCard>
                            )}

                            {/* 4. Facturación */}
                            <PhaseCard
                                title="Facturación"
                                icon={FileText}
                                variant={isNoteMode ? noteStatuses.billing : (billingIsComplete ? 'success' : (invoices.length > 0 ? 'active' : 'neutral'))}
                                documents={invoices.map((inv: any) => ({
                                    type: inv.dte_type_display || 'Documento',
                                    number: formatDocumentId(inv.dte_type === 'BOLETA' ? 'BOL' : 'FACT', inv.number || '---', inv.display_id),
                                    icon: FileText,
                                    id: inv.id,
                                    docType: 'invoice',
                                    status: inv.status,
                                    actions: [
                                        ...((inv.status === 'DRAFT') ? [{
                                            icon: Trash2,
                                            title: 'Eliminar Borrador',
                                            color: 'text-red-500 hover:bg-red-500/10',
                                            onClick: () => handleDeleteDraft(inv.id)
                                        }] : []),
                                        ...((inv.status !== 'CANCELLED' && inv.status !== 'DRAFT') ? [{
                                            icon: X,
                                            title: 'Anular Documento',
                                            color: 'text-orange-600 hover:bg-orange-600/10',
                                            onClick: () => handleAnnulDocument(inv.id)
                                        }] : [])
                                    ]
                                }))}
                                onViewDetail={openDetails}
                                actions={(isNoteMode ? [] : registry.billing?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                                emptyMessage="Sin documentos emitidos"
                                order={activeDoc}
                                userPermissions={userPermissions}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                actionEngineRef={actionEngineRef}
                                stageId="billing"
                                isComplete={billingIsComplete} posSessionId={posSessionId}
                            />

                            {/* 5. Tesorería */}
                            <PhaseCard
                                title="Tesorería"
                                icon={Banknote}
                                variant={
                                    isNoteMode ? noteStatuses.treasury :
                                        ((parseFloat(activeDoc.pending_amount || '0') <= 0 && !hasPendingTransactions) ? 'success' :
                                            (payments.length > 0 || hasPendingTransactions ? 'active' : 'neutral'))
                                }
                                documents={payments.map((p: any) => ({
                                    type: p.payment_method_display || 'Pago',
                                    number: formatDocumentId(p.payment_type === 'INBOUND' ? 'ING' : 'EGR', p.id, p.display_id),
                                    icon: Banknote,
                                    id: p.id,
                                    docType: 'payment',
                                    status: p.status || 'Pagado',
                                    amount: p.amount,
                                    documentReference: p.reference,
                                    actions: [
                                        ...((((p.payment_type === 'OUTBOUND' && (p.payment_method === 'CARD' || p.payment_method === 'TRANSFER')) || (p.payment_type === 'INBOUND' && p.payment_method === 'TRANSFER'))) && !p.transaction_number ? [{
                                            icon: Hash,
                                            title: 'Ingresar N° Transacción',
                                            color: 'text-orange-500 hover:bg-orange-500/10',
                                            onClick: () => setTrForm({ open: true, id: p.id, initialValue: "" })
                                        }] : []),
                                        ...((p.status !== 'CANCELLED') ? [{
                                            icon: Trash2,
                                            title: 'Eliminar/Anular Pago',
                                            color: 'text-red-500 hover:bg-red-500/10',
                                            onClick: () => handleDeletePayment(p.id)
                                        }] : [])
                                    ]
                                }))}
                                onViewDetail={openDetails}
                                actions={(isNoteMode ? (registry.notes_payments?.actions || []) : (registry.payments?.actions || [])).filter((a: any) => !a.id.includes('view-'))}
                                emptyMessage="Sin pagos registrados"
                                order={activeDoc}
                                userPermissions={userPermissions}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                actionEngineRef={actionEngineRef}
                                stageId="treasury"
                                isComplete={parseFloat(activeDoc.pending_amount || '0') <= 0 && !hasPendingTransactions} posSessionId={posSessionId}
                            >
                                <div className="space-y-1 py-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-muted-foreground">PAGADO</span>
                                        <span className="text-green-500">
                                            {formatCurrency((activeDoc.total || 0) - (activeDoc.pending_amount || 0))}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-muted-foreground">PENDIENTE</span>
                                        <span className={cn(parseFloat(activeDoc.pending_amount || '0') > 0 ? "text-orange-500" : "text-muted-foreground/30")}>
                                            {formatCurrency(activeDoc.pending_amount || 0)}
                                        </span>
                                    </div>
                                    {hasPendingTransactions && (
                                        <div className="flex items-center gap-1 mt-1 text-[9px] text-orange-400 animate-pulse font-medium">
                                            <AlertCircle className="size-3" />
                                            FALTA N° TRANSACCIÓN
                                        </div>
                                    )}
                                </div>
                            </PhaseCard>
                        </div>
                    </div>

                    {/* Global Action Engine for header buttons */}
                    <div className="sr-only pointer-events-none">
                        <ActionCategory
                            ref={actionEngineRef}
                            category={{
                                actions: [
                                    ...(isNoteMode ? (registry.documents?.actions || []) : []),
                                    ...(isNoteMode ? (registry[isSale ? 'deliveries' : 'receptions']?.actions || []) : []),
                                    ...(registry.notes?.actions || []),
                                    ...(registry.payments?.actions || [])
                                ]
                            } as any}
                            order={activeDoc}
                            userPermissions={userPermissions}
                            onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                            layout="flex"
                            posSessionId={posSessionId}
                        />
                    </div>
                </TooltipProvider>
            </BaseModal>

            {/* Sub-modales */}
            <TransactionViewModal
                open={detailsModal.open}
                onOpenChange={(open) => setDetailsModal({ ...detailsModal, open })}
                id={detailsModal.id}
                type={detailsModal.type}
            />

            <TransactionNumberForm
                open={trForm.open}
                onOpenChange={(open) => setTrForm({ ...trForm, open })}
                paymentId={trForm.id}
                initialValue={trForm.initialValue}
                onSuccess={() => {
                    fetchOrderDetails()
                    onActionSuccess?.()
                }}
            />

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
    isComplete = false,
    posSessionId = null
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

    // Separate actions into primary (closing) and secondary
    const categorizedActions = (() => {
        const filtered = actions?.filter((action: any) => {
            if (action.requiredPermissions && !action.requiredPermissions.some((p: string) => userPermissions.includes(p))) {
                return false
            }
            if (action.excludedStatus && action.excludedStatus.includes(order?.status)) {
                return false
            }
            if (action.checkAvailability) {
                if (!order) return false
                if (!action.checkAvailability(order)) return false
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
            "flex flex-col h-full transition-all duration-500 border-2 rounded-3xl relative overflow-hidden backdrop-blur-sm group/card bg-transparent",
            variantStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')],
            "hover:translate-y-[-4px] hover:shadow-2xl hover:border-white/20 shadow-none",
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

                {/* Header Action Icons (Replacing status dots) */}
                <div className="flex items-center gap-1.5">
                    {categorizedActions.secondary.filter((a: any) =>
                        ['create-note', 'create-credit-note', 'create-debit-note', 'payment-history'].includes(a.id)
                    ).map((action: any, idx: number) => {
                        const disabled = action.isDisabled?.(order) || false
                        let tooltipText = action.label
                        if (disabled && action.disabledTooltip) {
                            tooltipText = typeof action.disabledTooltip === 'function'
                                ? action.disabledTooltip(order)
                                : action.disabledTooltip
                        }

                        return (
                            <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                    <div className={disabled ? "cursor-not-allowed opacity-50" : ""}>
                                        {/* Wrapped in div to allow tooltip on disabled button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={disabled}
                                            className={cn(
                                                "h-8 w-8 rounded-full transition-all active:scale-90 border border-white/10 shadow-sm",
                                                "bg-white/5 hover:bg-white/10",
                                                (action.id.includes('note')) && "text-orange-500 bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/40",
                                                action.id === 'payment-history' && "text-primary bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40",
                                                disabled && "pointer-events-none"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                console.log(`[PhaseCard] Header button clicked: ${action.id}`);
                                                actionEngineRef.current?.handleActionClick(action.id);
                                            }}
                                        >
                                            <action.icon className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{tooltipText}</p>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>
            </div>

            <CardContent className="p-5 flex-1 flex flex-col gap-4 relative z-10">
                {/* Documents List - Uniform Row Style */}
                <div className="space-y-2 min-h-[40px]">
                    {documents.length > 0 ? (
                        documents.map((doc: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-muted/5 rounded-2xl border border-border/40 hover:bg-muted/10 transition-all duration-300 group/doc h-12">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="h-8 w-8 flex items-center justify-center bg-background rounded-xl border border-border/20 shadow-sm shrink-0">
                                        <doc.icon className="h-4 w-4 text-primary/80" />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[11px] font-black text-foreground/90 truncate max-w-[120px]" title={doc.number}>
                                            {doc.number}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-0.5 opacity-20 group-hover/doc:opacity-100 transition-opacity">
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
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-4 border border-dashed border-border/20 rounded-2xl bg-muted/5">
                            <span className="text-[9px] text-muted-foreground/30 font-black uppercase tracking-widest">{emptyMessage}</span>
                        </div>
                    )}
                </div>

                {/* Visual Support Container - FLAT */}
                <div className="flex-1 flex flex-col justify-center min-h-[100px]">
                    {children}
                </div>

                {/* Actions Section */}
                <div className="mt-auto">
                    {!isSuccess && categorizedActions.primary.length > 0 && (
                        <ActionCategory
                            category={{ actions: categorizedActions.primary } as any}
                            order={order}
                            userPermissions={userPermissions}
                            onActionSuccess={onActionSuccess}
                            layout="grid"
                            compact={true}
                            showBadge={false}
                            posSessionId={posSessionId}
                        />
                    )}

                    {isSuccess && (
                        <div className="flex flex-col items-center justify-center py-2 opacity-30">
                            <Settings2 className="h-3 w-3 text-muted-foreground mb-1" />
                            <span className="text-[7px] text-muted-foreground font-black uppercase tracking-widest">Etapa Completada</span>
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Bottom Ghost Actions - Centered and Borderless - FLAT */}
            {categorizedActions.secondary.filter((a: any) =>
                !['create-note', 'create-credit-note', 'create-debit-note', 'payment-history'].includes(a.id)
            ).length > 0 && (
                    <div className="pb-1 px-4">
                        <ActionCategory
                            category={{
                                actions: categorizedActions.secondary.filter((a: any) =>
                                    !['create-note', 'create-credit-note', 'create-debit-note', 'payment-history'].includes(a.id)
                                )
                            } as any}
                            order={order}
                            userPermissions={userPermissions}
                            onActionSuccess={onActionSuccess}
                            layout="flex"
                            compact={true}
                            ghost={true}
                            showBadge={false}
                            posSessionId={posSessionId}
                        />
                    </div>
                )}
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
