"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Badge } from "@/components/ui/badge"
import {
    LayoutDashboard,
    CheckCircle2,
    PlayCircle,
    MinusCircle,
    XCircle,
    X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { cn, formatPlainDate } from "@/lib/utils"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubIntegrated } from "./OrderHubIntegrated"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface OrderHubPanelProps {
    orderId?: number | null
    invoiceId?: number | null
    type?: 'purchase' | 'sale' | 'obligation'
    onClose: () => void
    onActionSuccess?: () => void
    onEdit?: (orderId: number) => void
    posSessionId?: number | null
}

export function OrderHubPanel({
    orderId,
    invoiceId,
    type,
    onClose,
    onActionSuccess,
    onEdit,
    posSessionId = null,
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
        if (!activeDoc) return { label: 'Cargando', variant: 'neutral', icon: MinusCircle }
        
        const { noteStatuses, hubStatuses, billingIsComplete, totalOTs, totalOTProgress, logisticsProgress, payments } = hubData
        
        const docToEvaluate = isNoteMode ? activeInvoice : activeDoc
        if (docToEvaluate?.status === 'CANCELLED') return { label: 'Anulado', variant: 'destructive', icon: XCircle }

        if (isNoteMode) {
            if (noteStatuses.isComplete) return { label: 'Completado', variant: 'success', icon: CheckCircle2 }
            const hasProgress = noteStatuses.logistics !== 'neutral' || noteStatuses.treasury !== 'neutral'
            if (hasProgress) return { label: 'En Progreso', variant: 'active', icon: PlayCircle }
            return { label: 'Borrador', variant: 'neutral', icon: MinusCircle }
        }

        const stages = []
        if (type === 'sale' && totalOTs > 0) stages.push(totalOTProgress === 100)
        if (activeDoc.document_type !== 'SERVICE_OBLIGATION') stages.push(logisticsProgress === 100)
        stages.push(billingIsComplete)
        stages.push((activeDoc.status === 'PAID' || activeDoc.payment_status === 'PAID' || parseFloat(activeDoc.pending_amount || '0') <= 0) && !hubStatuses.hasPendingTransactions)

        if (stages.every(s => s)) return { label: 'Completado', variant: 'success', icon: CheckCircle2 }
        if (stages.some(s => s)) return { label: 'En Progreso', variant: 'active', icon: PlayCircle }

        return { label: 'Pendiente', variant: 'neutral', icon: MinusCircle }
    }, [hubData, isNoteMode, activeInvoice, activeDoc, type])

    if (!activeDoc) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <LayoutDashboard className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold text-muted-foreground">HUB de Mando</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <span className="text-sm font-medium">Cargando datos...</span>
                    </div>
                </div>
            </div>
        )
    }

    const StatusIcon = globalStatus.icon

    const prefix = isNoteMode 
        ? (activeInvoice.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND') 
        : (type === 'purchase' ? 'OCS' : type === 'obligation' ? 'OB' : 'NV')

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="p-3 pb-1 border-b bg-background shrink-0">
                <div className="flex items-center justify-between w-full text-left">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm border border-primary/5 hidden sm:block">
                            <LayoutDashboard className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-bold tracking-tight text-foreground leading-none">
                                    {isNoteMode ? activeInvoice.dte_type_display : "HUB de Mando"}
                                </h2>
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
                            <p className="text-xs font-medium text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">
                                        {prefix}-{activeDoc.number || activeDoc.id}
                                    </span>
                                    <span className="opacity-40">|</span>
                                    {formatPlainDate(activeDoc.created_at || activeDoc.date)}
                                    <span className="opacity-40">|</span>
                                    <span className="text-foreground">
                                        {isNoteMode ? (activeDoc.contact_name || activeDoc.contact?.name) : (type === 'purchase' ? activeDoc.supplier_name : activeDoc.customer_name)}
                                    </span>
                                </span>
                            </p>
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-full bg-slate-50/50 backdrop-blur-sm border shadow-sm text-muted-foreground hover:bg-white hover:text-rose-500 transition-all shrink-0" 
                        onClick={onClose}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>
            
            {/* Content wrapped in ScrollArea */}
            <ScrollArea className="flex-1 w-full" type="always">
                <div className="p-3 pt-1">
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
                onOpenChange={(open) => setDetailsModal(prev => ({ ...prev, open }))}
                type={detailsModal.type}
                id={Number(detailsModal.id)}
            />
        </div>
    )
}
