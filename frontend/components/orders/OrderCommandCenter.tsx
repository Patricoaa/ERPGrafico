
"use client"

import { useRouter } from "next/navigation"

import { useState, useEffect, useRef } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

import { BaseModal } from "@/components/shared/BaseModal"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import {
    LayoutDashboard,
    CheckCircleIcon,
    PlayCircle,
    AlertCircle,
    XCircle,
} from "lucide-react"
import { ActionCategory } from "./ActionCategory"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { cn, translateStatus } from "@/lib/utils"
import { toast } from "sonner"
import { getNoteHubStatuses, getHubStatuses } from "@/lib/order-status-utils"
import { OriginPhase } from "./phases/OriginPhase"
import { ProductionPhase } from "./phases/ProductionPhase"
import { LogisticsPhase } from "./phases/LogisticsPhase"
import { BillingPhase } from "./phases/BillingPhase"
import { TreasuryPhase } from "./phases/TreasuryPhase"
// import { OrderHeaderDashboard } from "./OrderHeaderDashboard"

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

    useEffect(() => {
        if (order) {
            // Small delay to ensure the initial 0 is rendered before the target value
            const timer = setTimeout(() => setShowAnimations(true), 100)
            return () => clearTimeout(timer)
        }
    }, [order])

    if (!order && !activeInvoice) return null

    const isNoteMode = activeInvoice && ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(activeInvoice.dte_type)
    const isCreditNote = activeInvoice?.dte_type === 'NOTA_CREDITO'
    const activeDoc = activeInvoice || order
    if (!activeDoc) return null

    const registry = (type === 'purchase' || type === 'obligation') ? purchaseOrderActions : saleOrderActions
    const isSale = type === 'sale'

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            openWorkOrder(Number(docId))
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    // Production Progress
    const totalOTs = activeDoc.work_orders?.length || 0
    const totalOTProgress = totalOTs > 0
        ? (activeDoc.work_orders || []).reduce((sum: number, ot: any) => sum + (ot.production_progress || 0), 0) / totalOTs
        : 0

    // Calculate if there are issues with invoices (drafts or missing folio)
    const invoices = activeDoc.related_documents?.invoices || []

    // Unified Note Status Logic
    const noteStatuses = getNoteHubStatuses(activeInvoice || {})

    const billingIsComplete = (() => {
        if (isNoteMode) return noteStatuses.billing === 'success'
        return invoices.length > 0 && !invoices.some((inv: any) =>
            inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number
        )
    })()

    // Calculate logistics progress for global status
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

    // Calculate pending transactions for global status
    const payments = activeDoc.serialized_payments || activeDoc.payments_detail || activeDoc.related_documents?.payments || []
    const hasPendingTransactions = payments.some((pay: any) => {
        const requiresTR = (
            (pay.payment_type === 'OUTBOUND' && (pay.payment_method === 'CARD' || pay.payment_method === 'TRANSFER')) ||
            (pay.payment_type === 'INBOUND' && pay.payment_method === 'TRANSFER')
        )
        return requiresTR && !pay.transaction_number
    })

    // Calculate visible columns for dynamic width
    const showProduction = isSale && !isCreditNote && ((order?.work_orders?.length || 0) > 0 || (activeDoc.lines || activeDoc.items || []).some((l: any) => l.is_manufacturable))
    const showLogistics = (activeDoc.lines || activeDoc.items || []).length > 0 && !(activeDoc.lines || activeDoc.items || []).every((l: any) => l.product_type === 'SUBSCRIPTION')

    // Get phase statuses for dashboard
    const hubStatuses = getHubStatuses(activeDoc)

    // Override with specific logic used in components if needed, or rely on hubStatuses
    // The components perform their own status checks, but for the dashboard we want high-level summary.
    // We should allow hubStatuses to be the source of truth for the dashboard.
    // Ensure getHubStatuses logic matches what we expect from the components.

    // For Production in Dashboard:
    const prodStatus = totalOTs === 0 ? 'not_applicable' : (totalOTProgress === 100 ? 'success' : (totalOTProgress > 0 ? 'active' : 'neutral'))

    // For Logistics in Dashboard
    const logStatus = showLogistics ? (logisticsProgress === 100 ? 'success' : (logisticsProgress > 0 ? 'active' : 'neutral')) : 'not_applicable'

    const phasesStatus = {
        origin: isNoteMode ? noteStatuses.origin : (activeDoc.status !== 'DRAFT' ? 'success' : 'neutral'),
        production: prodStatus,
        logistics: isNoteMode ? noteStatuses.logistics : logStatus,
        billing: isNoteMode ? noteStatuses.billing : (billingIsComplete ? 'success' : 'neutral'),
        treasury: isNoteMode ? noteStatuses.treasury : (hubStatuses.treasury === 'success' ? 'success' : (hubStatuses.treasury === 'active' ? 'active' : 'neutral'))
    }


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

    let visibleCols = 3 // Origen, Facturación, Tesorería
    if (showProduction) visibleCols++
    if (showLogistics) visibleCols++

    const maxWidth = {
        5: "max-w-[1700px]",
        4: "max-w-[1400px]",
        3: "max-w-[1100px]"
    }[visibleCols as 3 | 4 | 5] || "max-w-[1700px]"

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
                            <OriginPhase
                                isNoteMode={!!isNoteMode}
                                activeInvoice={activeInvoice}
                                noteStatuses={noteStatuses}
                                order={order}
                                activeDoc={activeDoc}
                                type={type}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                onEdit={onEdit}
                                userPermissions={userPermissions}
                                actionEngineRef={actionEngineRef}
                            />

                            {/* 2. Producción */}
                            <ProductionPhase
                                order={order}
                                activeDoc={activeDoc}
                                registry={registry}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                actionEngineRef={actionEngineRef}
                                showAnimations={showAnimations}
                            />

                            {/* 3. Logística / Cumplimiento */}
                            <LogisticsPhase
                                activeDoc={activeDoc}
                                isNoteMode={!!isNoteMode}
                                noteStatuses={noteStatuses}
                                isSale={isSale}
                                invoices={invoices}
                                registry={registry}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                actionEngineRef={actionEngineRef}
                                showAnimations={showAnimations}
                            />

                            {/* 4. Facturación */}
                            <BillingPhase
                                isNoteMode={!!isNoteMode}
                                noteStatuses={noteStatuses}
                                activeDoc={activeDoc}
                                invoices={invoices}
                                billingIsComplete={billingIsComplete}
                                registry={registry}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                actionEngineRef={actionEngineRef}
                                posSessionId={posSessionId}
                            />

                            {/* 5. Tesorería */}
                            <TreasuryPhase
                                isNoteMode={!!isNoteMode}
                                noteStatuses={noteStatuses}
                                activeDoc={activeDoc}
                                payments={payments}
                                registry={registry}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                actionEngineRef={actionEngineRef}
                                posSessionId={posSessionId}
                            />
                        </div>

                        {userPermissions.length > 0 && (
                            <div className="mt-2 border-t border-border/40 pt-4">
                                <ActionCategory
                                    category={{
                                        title: 'Acciones Disponibles',
                                        actions: [
                                            ...(registry.global?.actions || []),
                                            ...(isNoteMode ? [] : (registry.actions || []) as unknown as any[]),
                                            ...(isNoteMode ? (registry.notes_global?.actions || []) : [])
                                        ]
                                    } as any}
                                    order={activeDoc}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    layout="flex"
                                    compact={false}
                                    ref={actionEngineRef}
                                    posSessionId={posSessionId}
                                />
                            </div>
                        )}
                    </div>
                </TooltipProvider>

                {/* Shared Modal for viewing Details */}
                <TransactionViewModal
                    open={detailsModal.open}
                    onOpenChange={(open) => setDetailsModal(prev => ({ ...prev, open }))}
                    type={detailsModal.type}
                    id={Number(detailsModal.id)}
                />
            </BaseModal >
        </>
    )
}
