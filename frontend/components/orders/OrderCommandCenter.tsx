
"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { 
    Sheet, 
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
    X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CollapsibleSheet } from "@/components/shared/CollapsibleSheet"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { cn, formatPlainDate } from "@/lib/utils"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubIntegrated } from "./OrderHubIntegrated"

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
    const hubData = useOrderHubData({ orderId, invoiceId, type, enabled: open })
    const { activeDoc, activeInvoice, isNoteMode, fetchOrderDetails } = hubData
    
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: any, id: number | string }>({ open: false, type: 'sale_order', id: 0 })
    
    // BUG-03 fix: Use a ref counter instead of a boolean to prevent race conditions
    // when multiple ActionCategory instances call onModalChange simultaneously.
    const modalOpenCountRef = useRef(0)
    const [isInternalActionModalOpen, setIsInternalActionModalOpen] = useState(false)
    
    const handleModalChange = useCallback((isOpen: boolean) => {
        modalOpenCountRef.current += isOpen ? 1 : -1
        // Clamp to 0 minimum to prevent negative counts from mismatched calls
        if (modalOpenCountRef.current < 0) modalOpenCountRef.current = 0
        setIsInternalActionModalOpen(modalOpenCountRef.current > 0)
    }, [])
    
    const { openWorkOrder } = useGlobalModals()

    if (!activeDoc) return null

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            openWorkOrder(Number(docId))
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    const globalStatus = useMemo(() => {
        const { noteStatuses, hubStatuses, billingIsComplete, totalOTs, totalOTProgress, logisticsProgress, payments } = hubData
        
        const docToEvaluate = isNoteMode ? activeInvoice : activeDoc
        if (docToEvaluate.status === 'CANCELLED') return { label: 'Anulado', variant: 'destructive', icon: XCircle }

        if (isNoteMode) {
            if (noteStatuses.isComplete) return { label: 'Completado', variant: 'success', icon: CheckCircleIcon }
            const hasProgress = noteStatuses.logistics !== 'neutral' || noteStatuses.treasury !== 'neutral'
            if (hasProgress) return { label: 'En Progreso', variant: 'active', icon: PlayCircle }
            return { label: 'Borrador', variant: 'neutral', icon: AlertCircle }
        }

        const stages = []
        if (type === 'sale' && totalOTs > 0) stages.push(totalOTProgress === 100)
        if (activeDoc.document_type !== 'SERVICE_OBLIGATION') stages.push(logisticsProgress === 100)
        stages.push(billingIsComplete)
        stages.push((activeDoc.status === 'PAID' || activeDoc.payment_status === 'PAID' || parseFloat(activeDoc.pending_amount || '0') <= 0) && !hubStatuses.hasPendingTransactions)

        if (stages.every(s => s)) return { label: 'Completado', variant: 'success', icon: CheckCircleIcon }
        if (stages.some(s => s)) return { label: 'En Progreso', variant: 'active', icon: PlayCircle }

        return { label: 'Pendiente', variant: 'neutral', icon: AlertCircle }
    }, [hubData, isNoteMode, activeInvoice, activeDoc, type])

    const StatusIcon = globalStatus.icon

    const prefix = isNoteMode 
        ? (activeInvoice.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND') 
        : (type === 'purchase' ? 'OCS' : type === 'obligation' ? 'OB' : 'NV')
    const tabLabel = `${prefix}-${activeDoc.number || activeDoc.id}`

    return (
        <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
            <CollapsibleSheet
                sheetId="HUB_MANDO"
                open={open}
                onOpenChange={onOpenChange}
                tabLabel={tabLabel}
                tabIcon={LayoutDashboard}
                forceCollapse={isExternalModalOpen || detailsModal.open || isInternalActionModalOpen}
                fullWidth={500}
                className="max-w-[100vw] w-full sm:max-w-[500px] sm:w-[500px]"
            >
                <SheetHeader className="p-3 pb-1 border-b bg-background sticky top-0 z-50 shrink-0">
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

                <div className="flex-1 overflow-y-auto scrollbar-thin p-3 pt-1">
                    <OrderHubIntegrated 
                        data={hubData}
                        type={type}
                        onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                        openDetails={openDetails}
                        onEdit={onEdit}
                        posSessionId={posSessionId}
                        onModalChange={handleModalChange}
                    />
                </div>

                {/* Shared Modal for viewing Details remains as is since it might need more space */}
                <TransactionViewModal
                    open={detailsModal.open}
                    onOpenChange={(open) => setDetailsModal(prev => ({ ...prev, open }))}
                    type={detailsModal.type}
                    id={Number(detailsModal.id)}
                />
            </CollapsibleSheet>
        </Sheet>
    )
}
