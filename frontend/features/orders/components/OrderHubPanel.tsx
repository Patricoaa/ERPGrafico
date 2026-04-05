"use client"

import { useState, useMemo } from "react"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    CheckCircle2,
    PlayCircle,
    MinusCircle,
    XCircle,
    X,
    ShoppingCart,
    FileText,
    Receipt,
    User,
    ArrowLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { formatPlainDate } from "@/lib/utils"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubIntegrated } from "./OrderHubIntegrated"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBadge } from "@/components/shared/StatusBadge"

export interface OrderHubPanelProps {
    orderId?: number | null
    invoiceId?: number | null
    type?: 'purchase' | 'sale' | 'obligation'
    onClose?: () => void
    onActionSuccess?: () => void
    onEdit?: (orderId: number) => void
    posSessionId?: number | null
    showHeader?: boolean
}

export function OrderHubPanel({
    orderId,
    invoiceId,
    type,
    onClose,
    onActionSuccess,
    onEdit,
    posSessionId = null,
    showHeader = false,
}: OrderHubPanelProps) {
    const hubData = useOrderHubData({ orderId, invoiceId, type, enabled: true })
    const { activeDoc, activeInvoice, isNoteMode, fetchOrderDetails } = hubData
    
    const { setHubTemporarilyHidden } = useHubPanel()
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: any, id: number | string }>({ open: false, type: 'sale_order', id: 0 })
    
    const { openWorkOrder } = useGlobalModals()

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            openWorkOrder(Number(docId))
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    const globalStatus = useMemo(() => {
        if (!activeDoc) return { label: 'Cargando', status: 'neutral', icon: MinusCircle }
        
        const { noteStatuses, hubStatuses, billingIsComplete, totalOTs, totalOTProgress, logisticsProgress } = hubData
        
        const docToEvaluate = isNoteMode ? activeInvoice : activeDoc
        if (docToEvaluate?.status === 'CANCELLED') return { label: 'Anulado', status: 'cancelled', icon: XCircle }

        if (isNoteMode) {
            if (noteStatuses.isComplete) return { label: 'Completado', status: 'success', icon: CheckCircle2 }
            const hasProgress = noteStatuses.logistics !== 'neutral' || noteStatuses.treasury !== 'neutral'
            if (hasProgress) return { label: 'En Progreso', status: 'active', icon: PlayCircle }
            return { label: 'Borrador', status: 'neutral', icon: MinusCircle }
        }

        const stages = []
        if (type === 'sale' && totalOTs > 0) stages.push(totalOTProgress === 100)
        if (activeDoc.document_type !== 'SERVICE_OBLIGATION') stages.push(logisticsProgress === 100)
        stages.push(billingIsComplete)
        stages.push((activeDoc.status === 'PAID' || activeDoc.payment_status === 'PAID' || parseFloat(activeDoc.pending_amount || '0') <= 0) && !hubStatuses.hasPendingTransactions)

        if (stages.every(s => s)) return { label: 'Completado', status: 'success', icon: CheckCircle2 }
        if (stages.some(s => s)) return { label: 'En Progreso', status: 'active', icon: PlayCircle }

        return { label: 'Pendiente', status: 'neutral', icon: MinusCircle }
    }, [hubData, isNoteMode, activeInvoice, activeDoc, type])

    if (!activeDoc) {
        return (
            <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
                <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
                    <div className="relative flex items-center justify-center">
                        <div className="h-20 w-20 border-t-2 border-primary rounded-full animate-spin shadow-[0_0_15px_rgba(var(--primary),0.2)]" />
                        <div className="absolute inset-0 h-20 w-20 border-2 border-primary/10 rounded-full" />
                        <ShoppingCart className="absolute h-8 w-8 text-primary/40 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-xs font-heading font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                            Consolidando Entidad
                        </span>
                        <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/40 w-1/3 animate-progress transition-all duration-1000 ease-in-out" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Derive document type label
    const docTypeLabel = (() => {
        if (activeDoc.dte_type === 'NOTA_CREDITO') return 'NOTA DE CRÉDITO'
        if (activeDoc.dte_type === 'NOTA_DEBITO') return 'NOTA DE DÉBITO'
        if (type === 'purchase' || type === 'obligation') return 'COMPRA'
        return 'VENTA'
    })()

    const StatusIcon = globalStatus.icon

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex flex-col h-full overflow-hidden">
            {/* ── Panel Header (only in panel context) ──────────────────── */}
            {showHeader && (
                <div className="flex items-center gap-3 shrink-0 border-b-4 border-border/40 px-4 py-3">
                    {/* Document type + ID */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-[9px] font-heading font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-0.5">
                            {docTypeLabel}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="font-heading font-black text-[15px] text-foreground leading-tight truncate">
                                {activeDoc.display_id || activeDoc.folio || `#${activeDoc.id}`}
                            </span>
                            {/* Global status badge */}
                            <span className={cn(
                                "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-[0.25rem] border shrink-0",
                                globalStatus.status === 'success' && "text-success border-success/30 bg-success/10",
                                globalStatus.status === 'active' && "text-primary border-primary/30 bg-primary/10",
                                globalStatus.status === 'cancelled' && "text-destructive border-destructive/30 bg-destructive/10",
                                globalStatus.status === 'neutral' && "text-muted-foreground border-border/40 bg-muted/10",
                            )}>
                                <StatusIcon className="h-2.5 w-2.5" />
                                {globalStatus.label}
                            </span>
                        </div>
                        {/* Partner name */}
                        {(activeDoc.customer_name || activeDoc.supplier_name) && (
                            <span className="text-[10px] text-muted-foreground/60 truncate mt-0.5 flex items-center gap-1">
                                <User className="h-2.5 w-2.5 shrink-0" />
                                {activeDoc.customer_name || activeDoc.supplier_name}
                            </span>
                        )}
                    </div>

                    {/* Date */}
                    {activeDoc.date && (
                        <span className="text-[9px] text-muted-foreground/40 font-mono shrink-0 hidden sm:block">
                            {formatPlainDate(activeDoc.date)}
                        </span>
                    )}

                    {/* Close button */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="h-7 w-7 rounded text-muted-foreground/50 hover:text-foreground hover:bg-white/10 shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Cerrar Hub</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
            {/* ── Scrollable Phase Content ──────────────────────── */}
            <ScrollArea className="flex-1 w-full">
                <div className="px-4 pb-4">
                    <OrderHubIntegrated
                        data={hubData}
                        type={type}
                        onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                        openDetails={openDetails}
                        onEdit={onEdit}
                        posSessionId={posSessionId}
                        compact={true}
                    />
                </div>
            </ScrollArea>

            {/* Shared Modal for viewing Details */}
            <TransactionViewModal
                open={detailsModal.open}
                onOpenChange={(open) => setDetailsModal((prev: any) => ({ ...prev, open }))}
                type={detailsModal.type}
                id={Number(detailsModal.id)}
            />
            </div>
        </TooltipProvider>
    )
}

