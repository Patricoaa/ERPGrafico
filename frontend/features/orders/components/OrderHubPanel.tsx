"use client"

import { useState, useMemo } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
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

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Content Container - No internal ScrollArea to avoid double scrollbars */}
            <div className="flex-1 w-full p-4 pt-0">
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
