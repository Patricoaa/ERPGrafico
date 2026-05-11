"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import {
    LayoutDashboard,
    CheckCircle2,
    PlayCircle,
    MinusCircle,
    XCircle,
    ShoppingCart,
    FileText,
    Receipt
} from "lucide-react"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubIntegrated } from "./OrderHubIntegrated"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBadge, HubSkeleton, SheetCloseButton } from "@/components/shared"

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
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const transactionId = searchParams.get('transaction')
    const transactionType = searchParams.get('transactionType')

    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: string, id: number | string }>({ open: false, type: 'sale_order', id: 0 })

    useEffect(() => {
        if (transactionId && transactionType && !detailsModal.open) {
            setDetailsModal({ open: true, type: transactionType, id: transactionId })
        }
    }, [transactionId, transactionType, detailsModal.open])

    const { openWorkOrder } = useGlobalModals()

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            openWorkOrder(Number(docId))
            return
        }
        const params = new URLSearchParams(searchParams.toString())
        params.set('transaction', String(docId))
        params.set('transactionType', docType)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeDetails = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('transaction')
        params.delete('transactionType')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setDetailsModal(prev => ({ ...prev, open: false }))
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
        stages.push((activeDoc.status === 'PAID' || activeDoc.payment_status === 'PAID' || parseFloat(String(activeDoc.pending_amount || '0')) <= 0) && !hubStatuses.hasPendingTransactions)

        if (stages.every(s => s)) return { label: 'Completado', status: 'success', icon: CheckCircle2 }
        if (stages.some(s => s)) return { label: 'En Progreso', status: 'active', icon: PlayCircle }

        return { label: 'Pendiente', status: 'neutral', icon: MinusCircle }
    }, [hubData, isNoteMode, activeInvoice, activeDoc, type])

    if (!activeDoc) {
        return <HubSkeleton />
    }

    const StatusIcon = globalStatus.icon
    const TopLeftIcon = (() => {
        if (activeDoc?.dte_type === 'NOTA_CREDITO' || activeDoc?.dte_type === 'NOTA_DEBITO') return Receipt
        if (activeInvoice || type === 'purchase' || type === 'obligation') return FileText
        if (activeDoc?.is_quote) return LayoutDashboard
        return ShoppingCart
    })()

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex flex-col h-full overflow-hidden">
                {/* ── Panel Header (only in panel context) ──────────────────── */}
                {showHeader && (
                    <div className="flex items-center justify-between gap-3 shrink-0 px-4 pt-1 pb-4 border-b border-white/5 bg-sidebar backdrop-blur-md">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Unified Minimalist Icon Container */}
                            <TopLeftIcon className="h-5 w-5 text-muted-foreground" />

                            <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-heading font-black text-[15px] text-foreground leading-tight truncate">
                                        {activeDoc.display_id || activeDoc.folio || `#${activeDoc.id}`}
                                    </span>
                                    {/* Global status badge */}
                                    <StatusBadge
                                        status={globalStatus.status === 'success' ? 'SUCCESS' : globalStatus.status === 'active' ? 'IN_PROGRESS' : globalStatus.status === 'cancelled' ? 'CANCELLED' : 'NEUTRAL'}
                                        label={globalStatus.label}
                                        icon={StatusIcon}
                                        size="sm"
                                        className="rounded-md"
                                    />
                                </div>
                                {/* Partner name */}
                                {(activeDoc.customer_name || activeDoc.supplier_name) && (
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-none mt-1 truncate max-w-[200px]">
                                        {activeDoc.customer_name || activeDoc.supplier_name}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Close button Area */}
                        {onClose && (
                            <div className="flex items-center gap-1 shrink-0">
                                <SheetCloseButton
                                    onClick={onClose}
                                    showTooltip
                                    tooltipText="Cerrar Hub"
                                />
                            </div>
                        )}


                    </div>
                )}
                {/* ── Scrollable Phase Content ──────────────────────── */}
                <ScrollArea className="flex-1 w-full">
                    <div className="px-4 pt-5 pb-4">
                        <OrderHubIntegrated
                            data={hubData as any}
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
                    onOpenChange={(open) => !open && closeDetails()}
                    type={detailsModal.type as any}
                    id={Number(detailsModal.id)}
                />
            </div>
        </TooltipProvider>
    )
}

