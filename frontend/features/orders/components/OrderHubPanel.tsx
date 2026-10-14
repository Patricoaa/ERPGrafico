"use client"

import { useState, useMemo } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
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
import { LazyDrawer, TYPE_TO_REGISTRY } from "@/features/_shared"
import { DocumentRelationsSection } from "@/features/documents"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubView, type OrderHubData } from "./OrderHubView"
import type { Order, Payment } from "../types"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    PanelHeader,
    SkeletonShell,
} from "@/components/shared"

/** Pagos = TreasuryMovement: se abren por id en su ficha (el adaptador finance.payment exige datos completos). */
const HUB_DOC_LABELS: Record<string, string> = { payment: 'treasury.treasurymovement' }
const HUB_SELF_TYPES = new Set(['sale_order', 'purchase_order', 'service_obligation'])

function relationsTarget(activeDoc: Order | null | undefined, type: OrderHubPanelProps['type']): { label: string, id: number } | null {
    if (!activeDoc?.id) return null
    if (activeDoc.dte_type) return { label: 'billing.invoice', id: Number(activeDoc.id) }
    return { label: type === 'sale' ? 'sales.saleorder' : 'purchasing.purchaseorder', id: Number(activeDoc.id) }
}

export interface OrderHubPanelProps {
    orderId?: number | null
    invoiceId?: number | null
    type?: 'purchase' | 'sale' | 'obligation'
    onClose?: () => void
    onActionSuccess?: () => void
    onEdit?: (orderId: number) => void
    onOpenDetail?: (docType: string, docId: number | string) => void
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
    onOpenDetail,
    posSessionId = null,
    showHeader = false,
}: OrderHubPanelProps) {
    const hubData = useOrderHubData({ orderId, invoiceId, type, enabled: true })
    const { activeDoc, activeInvoice, isNoteMode, fetchOrderDetails } = hubData

    useHubPanel()
    const { openEntity } = useGlobalModals()

    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: string, id: number | string }>({ open: false, type: 'sale_order', id: 0 })

    const openDetails = (docType: string, docId: number | string) => {
        // ADR-0080: los documentos se abren con openEntity (pila con "volver" y fichas comunes).
        // La OV/OC propia del Hub sigue en su drawer local (openEntity la redirigiría al Hub, D4).
        const label = HUB_DOC_LABELS[docType] ?? TYPE_TO_REGISTRY[docType]
        if (label && !HUB_SELF_TYPES.has(docType) && hasEntityDrawer(label)) {
            openEntity(label, Number(docId))
            return
        }
        if (onOpenDetail) {
            onOpenDetail(docType, docId)
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    const relationsDoc = relationsTarget(activeDoc, type)

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

    const TopLeftIcon = (() => {
        if (activeDoc?.dte_type === 'NOTA_CREDITO' || activeDoc?.dte_type === 'NOTA_DEBITO') return Receipt
        if (activeInvoice || type === 'purchase' || type === 'obligation') return FileText
        if (activeDoc?.is_quote) return LayoutDashboard
        return ShoppingCart
    })()

    return (
        <TooltipProvider delayDuration={150}>
            <SkeletonShell isLoading={!activeDoc} ariaLabel="Cargando panel de control">
                <div className="flex flex-col h-full overflow-hidden">
                    {/* ── Panel Header (only in panel context) ──────────────────── */}
                    {showHeader && (
                        <div className="border-b border-border shrink-0 px-4 pt-4 pb-3">
                            <PanelHeader
                                title={activeDoc ? (activeDoc.display_id || activeDoc.folio || `#${activeDoc.id}`) : ''}
                                icon={TopLeftIcon}
                                onClose={onClose}
                                closeTooltip="Cerrar Hub"
                            />
                        </div>
                    )}
                {/* ── Scrollable Phase Content ──────────────────────── */}
                <ScrollArea className="flex-1 w-full ">
                    <div className="px-4 pt-5 pb-4">
                        <OrderHubView
                            data={{
                                order: hubData.order,
                                activeInvoice: hubData.activeInvoice,
                                activeDoc: hubData.activeDoc,
                                userPermissions: hubData.userPermissions,
                                isNoteMode: hubData.isNoteMode,
                                noteStatuses: hubData.noteStatuses,
                                showProduction: hubData.showProduction,
                                showLogistics: hubData.showLogistics,
                                invoices: hubData.invoices as unknown as Order[],
                                billingIsComplete: hubData.billingIsComplete,
                                payments: hubData.payments as unknown as Payment[],
                                logisticsProgress: hubData.logisticsProgress,
                                fetchOrderDetails: hubData.fetchOrderDetails,
                                globalStatus,
                            } as OrderHubData}
                            type={type}
                            onActionSuccess={() => { fetchOrderDetails(); onActionSuccess?.() }}
                            openDetails={openDetails}
                            onEdit={onEdit}
                            posSessionId={posSessionId}
                            compact={true}
                        />
                        {relationsDoc && (
                            <section className="mt-6 space-y-2">
                                <h4 className="text-sm font-medium">Documentos relacionados</h4>
                                <DocumentRelationsSection label={relationsDoc.label} id={relationsDoc.id} />
                            </section>
                        )}
                    </div>
                </ScrollArea>

                {/* Shared Modal for viewing Details */}
                {!onOpenDetail && (
                    <LazyDrawer
                        type={detailsModal.type}
                        id={Number(detailsModal.id)}
                        open={detailsModal.open}
                        onOpenChange={(open) => !open && closeDetails()}
                        saleOrderId={detailsModal.type === 'sale_delivery' ? activeDoc?.id : undefined}
                    />
                )}
                </div>
            </SkeletonShell>
        </TooltipProvider>
    )
}
