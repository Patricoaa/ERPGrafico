"use client"

import { useState, useMemo } from "react"
import {TooltipProvider} from "@/components/ui/tooltip"
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
import { LazyDrawer } from "@/features/_shared/transaction-drawer"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubIntegrated } from "./OrderHubIntegrated"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    StatusBadge, PanelHeader, SkeletonShell
} from "@/components/shared"

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
    const { openEntity } = useGlobalModals()

    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: string, id: number | string }>({ open: false, type: 'sale_order', id: 0 })

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            openEntity('production.workorder', Number(docId))
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    const closeDetails = () => {
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
        return (
            <SkeletonShell isLoading={true} ariaLabel="Cargando panel de mando">
                <div className="flex-1 h-full">
                    <div className="flex flex-col items-center justify-center py-12 gap-4 border-b border-border">
                        <div className="h-20 w-20 rounded-full border-2 border-primary/10" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-4 w-32" />
                            <div className="h-2 w-24 opacity-40" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-5 w-40" />
                                <div className="h-5 w-5 rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 w-full opacity-60" />
                                <div className="h-3 w-2/3 opacity-40" />
                            </div>
                            <div className="pt-2 border-t border-border/20 flex justify-end">
                                <div className="h-8 w-24 rounded" />
                            </div>
                        </div>
                        <div className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-5 w-40" />
                                <div className="h-5 w-5 rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 w-full opacity-60" />
                                <div className="h-3 w-2/3 opacity-40" />
                            </div>
                            <div className="pt-2 border-t border-border/20 flex justify-end">
                                <div className="h-8 w-24 rounded" />
                            </div>
                        </div>
                        <div className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-5 w-40" />
                                <div className="h-5 w-5 rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 w-full opacity-60" />
                                <div className="h-3 w-2/3 opacity-40" />
                            </div>
                            <div className="pt-2 border-t border-border/20 flex justify-end">
                                <div className="h-8 w-24 rounded" />
                            </div>
                        </div>
                        <div className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-5 w-40" />
                                <div className="h-5 w-5 rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 w-full opacity-60" />
                                <div className="h-3 w-2/3 opacity-40" />
                            </div>
                            <div className="pt-2 border-t border-border/20 flex justify-end">
                                <div className="h-8 w-24 rounded" />
                            </div>
                        </div>
                    </div>
                </div>
            </SkeletonShell>
        )
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
                    <div className="border-b shrink-0 px-6 pt-6 pb-4">
                        <PanelHeader
                            title={activeDoc.display_id || activeDoc.folio || `#${activeDoc.id}`}
                            description={
                                <>
                                    {(activeDoc.customer_name || activeDoc.supplier_name) && (
                                        <span className="text-xs text-muted-foreground font-medium leading-none truncate max-w-[240px]">
                                            {activeDoc.customer_name || activeDoc.supplier_name}
                                        </span>
                                    )}
                                    <StatusBadge
                                        status={globalStatus.status === 'success' ? 'SUCCESS' : globalStatus.status === 'active' ? 'IN_PROGRESS' : globalStatus.status === 'cancelled' ? 'CANCELLED' : 'NEUTRAL'}
                                        label={globalStatus.label}
                                        icon={StatusIcon}
                                        size="xs"
                                        className="rounded-md shrink-0"
                                    />
                                </>
                            }
                            icon={TopLeftIcon}
                            onClose={onClose}
                            closeTooltip="Cerrar Hub"
                        />
                    </div>
                )}
                {/* ── Scrollable Phase Content ──────────────────────── */}
                <ScrollArea className="flex-1 w-full ">
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
                <LazyDrawer
                    type={detailsModal.type}
                    id={Number(detailsModal.id)}
                    open={detailsModal.open}
                    onOpenChange={(open) => !open && closeDetails()}
                />
            </div>
        </TooltipProvider>
    )
}

