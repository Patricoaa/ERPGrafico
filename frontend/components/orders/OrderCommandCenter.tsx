
"use client"

import { useRouter } from "next/navigation"

import { useState, useEffect, useRef } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle,
    SheetDescription
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
    LayoutDashboard,
    CheckCircleIcon,
    PlayCircle,
    AlertCircle,
    XCircle,
    X,
    Settings2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ActionCategory } from "./ActionCategory"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { cn, translateStatus, formatPlainDate } from "@/lib/utils"
import { toast } from "sonner"
import { getNoteHubStatuses, getHubStatuses } from "@/lib/order-status-utils"
import { OriginPhase } from "./phases/OriginPhase"
import { ProductionPhase } from "./phases/ProductionPhase"
import { LogisticsPhase } from "./phases/LogisticsPhase"
import { BillingPhase } from "./phases/BillingPhase"
import { TreasuryPhase } from "./phases/TreasuryPhase"
// import { OrderHeaderDashboard } from "./OrderHeaderDashboard"

export interface OrderCommandCenterProps {
    orderId?: number | null
    invoiceId?: number | null
    type?: 'purchase' | 'sale' | 'obligation'
    open: boolean
    onOpenChange: (open: boolean) => void
    onActionSuccess?: () => void
    onEdit?: (orderId: number) => void
    posSessionId?: number | null
    isExternalModalOpen?: boolean
}

export function OrderCommandCenter({
    orderId,
    invoiceId,
    type,
    open,
    onOpenChange,
    onActionSuccess,
    onEdit,
    posSessionId = null,
    isExternalModalOpen = false
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
    const activeOTs = activeDoc.work_orders?.filter((ot: any) => ot.status !== 'CANCELLED') || []
    const totalOTs = activeOTs.length
    const totalOTProgress = totalOTs > 0
        ? activeOTs.reduce((sum: number, ot: any) => sum + (ot.production_progress || 0), 0) / totalOTs
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

    const isCollapsed = isExternalModalOpen || detailsModal.open
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
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="right" 
                className={cn(
                    "max-w-[100vw] w-full sm:max-w-[500px] sm:w-[500px] p-0 flex flex-col border-l shadow-2xl overflow-visible rounded-l-3xl z-[100] transition-all duration-500 ease-in-out",
                    isCollapsed ? "translate-x-full border-transparent" : "translate-x-0"
                )}
                // Avoid overlay blocking interaction with foreground modals when collapsed
                onPointerDownOutside={(e) => { if (isCollapsed) e.preventDefault() }}
                onInteractOutside={(e) => { if (isCollapsed) e.preventDefault() }}
            >
                {/* Vertical Tab (Solapa) - Only visible when collapsed */}
                <div 
                    onClick={() => isCollapsed && setDetailsModal(p => ({ ...p, open: false }))}
                    className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-[42px] h-[140px] bg-primary/95 backdrop-blur-md rounded-l-2xl border-l border-y border-primary/20 shadow-[-15px_0_30px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center cursor-pointer transition-all duration-500 overflow-hidden group",
                        isCollapsed ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none translate-x-0"
                    )}
                >
                    <div className="flex flex-col items-center gap-3 py-4 animate-in fade-in slide-in-from-right-4 duration-700">
                        <LayoutDashboard className="h-5 w-5 text-primary-foreground/90 group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col items-center whitespace-nowrap">
                            <span className="text-[13px] font-black text-primary-foreground [writing-mode:vertical-rl] rotate-180 tracking-widest">
                                {isNoteMode ? (activeInvoice.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND') : (type === 'purchase' ? 'OCS' : type === 'obligation' ? 'OB' : 'NV')}
                                -{activeDoc.number || activeDoc.id}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={cn("flex flex-col h-full bg-background transition-opacity duration-300", isCollapsed ? "opacity-20 grayscale pointer-events-none" : "opacity-100")}>
                <SheetHeader className="p-4 pb-2 border-b bg-background sticky top-0 z-50 shrink-0">
                    <div className="flex items-center justify-between w-full pr-12 text-left">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm border border-primary/5 hidden sm:block">
                                <LayoutDashboard className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-3">
                                    <SheetTitle className="text-lg font-bold tracking-tight text-foreground leading-none">
                                        {isNoteMode ? activeInvoice.dte_type_display : "HUB de Mando"}
                                    </SheetTitle>
                                    <Badge
                                        variant='outline'
                                        className={cn(
                                            "rounded-sm border px-1.5 py-0.5 gap-1 font-bold uppercase tracking-tight text-[10px]",
                                            globalStatus.variant === 'success' && "border-green-600/30 text-green-600 bg-green-500/5",
                                            globalStatus.variant === 'active' && "border-blue-600/30 text-blue-600 bg-blue-500/5",
                                            globalStatus.variant === 'destructive' && "border-red-600/30 text-red-600 bg-red-500/5",
                                            globalStatus.variant === 'neutral' && "border-muted-foreground/30 text-muted-foreground bg-muted/5"
                                        )}
                                    >
                                        <StatusIcon className='size-2.5' />
                                        {globalStatus.label}
                                    </Badge>
                                </div>
                                <SheetDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                                    <span className="flex items-center gap-2">
                                        <span className="font-bold text-foreground">
                                            {isNoteMode ? (activeInvoice.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND') : (type === 'purchase' ? 'OCS' : type === 'obligation' ? 'OB' : 'NV')}
                                            -{activeDoc.number || activeDoc.id}
                                        </span>
                                        <span className="opacity-40">|</span>
                                        {formatPlainDate(activeDoc.created_at || activeDoc.date)}
                                        <span className="opacity-40">|</span>
                                        <span className="text-foreground">
                                            {isNoteMode ? (activeDoc.contact_name || activeDoc.contact?.name) : (type === 'purchase' ? activeDoc.supplier_name : activeDoc.customer_name)}
                                        </span>
                                    </span>
                                </SheetDescription>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                {/* Custom Close Button for Sheet (Top Right Corner) */}
                <div className="absolute top-4 right-4 z-[60]">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-full bg-slate-50/50 backdrop-blur-sm border shadow-sm text-muted-foreground hover:bg-white hover:text-rose-500 transition-all" 
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin p-4 pt-2">
                    <TooltipProvider delayDuration={0}>
                        {/* Vertical Stack: Cards are stacked vertically for scanning */}
                        <div className="flex flex-col gap-2 pb-10">
                            {/* 1. Origen */}
                            <OriginPhase
                                isNoteMode={!!isNoteMode}
                                activeInvoice={activeInvoice}
                                noteStatuses={noteStatuses}
                                order={order}
                                activeDoc={activeDoc}
                                type={type || 'sale'}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                openDetails={openDetails}
                                onEdit={onEdit}
                                userPermissions={userPermissions}
                                actionEngineRef={actionEngineRef}
                            />

                            {/* 2. Producción */}
                            {showProduction && (
                                <ProductionPhase
                                    order={order}
                                    activeDoc={activeDoc}
                                    registry={registry}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    openDetails={openDetails}
                                    actionEngineRef={actionEngineRef}
                                    showAnimations={showAnimations}
                                />
                            )}

                            {/* 3. Logística / Cumplimiento */}
                            {showLogistics && (
                                <LogisticsPhase
                                    activeDoc={activeDoc}
                                    isNoteMode={!!isNoteMode}
                                    noteStatuses={noteStatuses}
                                    isSale={isSale}
                                    invoices={invoices}
                                    registry={registry}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                    openDetails={openDetails}
                                    actionEngineRef={actionEngineRef}
                                    showAnimations={showAnimations}
                                />
                            )}

                            {/* 4. Facturación */}
                            <BillingPhase
                                isNoteMode={!!isNoteMode}
                                noteStatuses={noteStatuses}
                                activeDoc={activeDoc}
                                invoices={invoices}
                                billingIsComplete={billingIsComplete}
                                registry={registry}
                                userPermissions={userPermissions}
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
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
                                onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                                openDetails={openDetails}
                                actionEngineRef={actionEngineRef}
                                posSessionId={posSessionId}
                            />

                            {/* Global Actions Category at the end of stack */}
                            {userPermissions.length > 0 && (
                                <div className="mt-2 border-t border-border/40 pt-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones Globales</h4>
                                    </div>
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
                                        layout="grid"
                                        compact={false}
                                        ref={actionEngineRef}
                                        posSessionId={posSessionId}
                                    />
                                </div>
                            )}
                        </div>
                    </TooltipProvider>
                </div>

                </div>

                {/* Shared Modal for viewing Details remains as is since it might need more space */}
                <TransactionViewModal
                    open={detailsModal.open}
                    onOpenChange={(open) => setDetailsModal(prev => ({ ...prev, open }))}
                    type={detailsModal.type}
                    id={Number(detailsModal.id)}
                />
            </SheetContent>
        </Sheet>
    )
}
