import { showApiError } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { Package, Ban } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatEntity } from '@/features/orders/utils/status'
import { useAnnulLogistics } from "../../hooks/useOrdersMutations"
import { ActionConfirmModal } from '@/components/shared'
import { saleOrderActions } from '@/features/sales/actions'
import { purchaseOrderActions } from '@/features/purchasing/actions'
import { Order, OrderLine, PhaseDocument } from "../../types"

interface LogisticsPhaseProps {
    activeDoc: Order
    isNoteMode: boolean
    noteStatuses: Record<string, string>
    isSale: boolean
    invoices: Order[]
    isTimeline?: boolean
    onModalChange?: (isOpen: boolean) => void
    logisticsProgress: number
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    showAnimations: boolean
    // Accordion props
    collapsible?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export function LogisticsPhase({
    activeDoc,
    isNoteMode,
    noteStatuses,
    isSale,
    invoices,
    onModalChange,
    logisticsProgress,
    userPermissions,
    onActionSuccess,
    openDetails,
    showAnimations,
    isTimeline = false,
    collapsible,
    isOpen,
    onOpenChange,
}: LogisticsPhaseProps) {
    const registry = isSale ? saleOrderActions : purchaseOrderActions

    const annulLogistics = useAnnulLogistics()

    const [confirmModal, setConfirmModal] = useState<{
        open: boolean,
        title: string,
        description: React.ReactNode,
        onConfirm: (reason?: string) => Promise<void> | void,
        variant?: 'destructive' | 'warning',
        confirmText?: string,
        requireReason?: boolean
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const canAnnulLogistics = userPermissions.includes(
        isSale ? 'sales.delete_saledelivery' : 'purchasing.delete_purchasereceipt'
    )

    const handleAnnulLogistics = (id: number, docType: string) => {
        const label = docType === 'sale_delivery' ? 'Despacho' :
            (docType === 'purchase_receipt' ? 'Recepción' : 'Devolución')

        setConfirmModal({
            open: true,
            title: `Anular ${label}`,
            variant: "destructive",
            confirmText: `Anular ${label}`,
            requireReason: true,
            onConfirm: async (reason?: string) => {
                try {
                    await annulLogistics.mutateAsync({ id, docType, reason })
                    setConfirmModal(prev => ({ ...prev, open: false }))
                    onActionSuccess?.()
                } catch (error: unknown) {
                    showApiError(error, `Error al anular ${label}`)
                    throw error
                }
            },
            description: `Esta acción reverterá los movimientos de inventario asociados. ¿Está seguro de anular este ${label.toLowerCase()}?`
        })
    }

    // Resolve Logistics Documents
    const logisticsDocs = (() => {
        const docs: PhaseDocument[] = []

        // 1. Returns for Notes/Orders
        if (Array.isArray(activeDoc.related_returns) && activeDoc.related_returns.length > 0) {
            docs.push(...activeDoc.related_returns.map((doc: any) => ({
                type: doc.type as string,
                number: formatEntity('DEV', doc.number || doc.id, doc.display_id),
                icon: Package,
                id: doc.id,
                docType: doc.docType as string,
                status: doc.status,
                actions: [
                    ...(canAnnulLogistics && doc.status !== 'CANCELLED' ? [{
                        icon: Ban,
                        title: 'Anular Devolución',
                        color: 'text-warning hover:bg-warning/10',
                        onClick: () => handleAnnulLogistics(doc.id, doc.docType as string)
                    }] : [])
                ]
            })))
        }

        // 2. High-level Deliveries/Receipts
        const specificDocs = isSale ? activeDoc.related_documents?.deliveries : (activeDoc.related_documents?.receipts || activeDoc.related_documents?.receptions)
        if (specificDocs && specificDocs.length > 0) {
            docs.push(...specificDocs.map((doc: Record<string, unknown>) => ({
                type: isSale ? 'Despacho' : 'Recepción',
                number: formatEntity(isSale ? 'DES' : 'REC', (doc.number as string) || (doc.id as number), doc.display_id as string),
                icon: Package,
                id: doc.id as number,
                docType: (doc.docType as string) || (isSale ? 'sale_delivery' : 'purchase_receipt'),
                status: doc.status as string,
                actions: [
                    ...(canAnnulLogistics && doc.status !== 'CANCELLED' && invoices.some((inv: Order) => inv.status === 'DRAFT') ? [{
                        icon: Ban,
                        title: isSale ? 'Anular Despacho' : 'Anular Recepción',
                        color: 'text-warning hover:bg-warning/10',
                        onClick: () => handleAnnulLogistics(doc.id as number, isSale ? 'sale_delivery' : 'purchase_receipt')
                    }] : [])
                ]
            })))
        }

        // 3. Low-level Stock Moves (only if no high-level docs found to avoid clutter)
        if (docs.length === 0 && (activeDoc.related_stock_moves?.length || 0) > 0) {
            docs.push(...(activeDoc.related_stock_moves || []).map((m: Record<string, unknown>) => ({
                type: (m.move_type_display as string) || 'Movimiento',
                number: formatEntity('MOV', m.id as number, m.display_id as string),
                icon: Package,
                id: m.id as number,
                docType: 'inventory',
                status: (m.state as string) || 'Realizado',
                actions: []
            })))
        }

        return docs
    })()

    const showLogistics = (activeDoc.lines || activeDoc.items || []).length > 0 && !(activeDoc.lines || activeDoc.items || []).every((l: OrderLine) => l.product_type === 'SUBSCRIPTION')

    if (!showLogistics) return null

    const title = (() => {
        const lines = activeDoc?.lines || activeDoc?.items || []
        const allServices = lines.every((l: OrderLine) => ['SERVICE', 'SUBSCRIPTION'].includes(l.product_type as string))
        const hasServices = lines.some((l: OrderLine) => ['SERVICE', 'SUBSCRIPTION'].includes(l.product_type as string))
        const onlySubscriptions = lines.every((l: OrderLine) => l.product_type === 'SUBSCRIPTION')

        if (onlySubscriptions) return 'Suscripciones'
        return allServices ? 'Cumplimiento' : (hasServices ? 'Logística/Cumplimiento' : 'Logística')
    })()

    return (
        <>
            <PhaseCard
                title={title}
                icon={Package}
                variant={(isNoteMode ? noteStatuses.logistics : (logisticsProgress === 100 ? 'success' : logisticsProgress > 0 ? 'active' : 'neutral')) as any}
                documents={logisticsDocs}
                onViewDetail={openDetails}
                actions={(isNoteMode ? (registry[isSale ? 'deliveries' : 'receptions']?.actions || registry.returns?.actions || []) : (registry[isSale ? 'deliveries' : 'receptions']?.actions || [])).filter((a: { id: string }) => !a.id.includes('view-'))}
                emptyMessage={isNoteMode ? "Sin movimientos asociados" : "Sin movimientos"}
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                showDocProgress={true}
                stageId="logistics"
                isComplete={logisticsProgress >= 100}
                isTimeline={isTimeline}
                onModalChange={onModalChange}
                collapsible={collapsible}
                isOpen={isOpen}
                onOpenChange={onOpenChange}
            >
                <div className="space-y-1 py-0.5">
                    {(activeDoc?.lines || activeDoc?.items || []).slice(0, 3).map((line: OrderLine, idx: number) => {
                        const total = parseFloat(line.quantity as string) || 1
                        const processedField = isSale
                            ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                            : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

                        const current = parseFloat(String(line[processedField as keyof OrderLine] || 0))
                        const pct = Math.min(100, Math.round((current / total) * 100))

                        return (
                            <div key={idx} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[10px] gap-2">
                                    <span className="text-foreground/70 line-clamp-1 flex-1 leading-tight">
                                        {line.product_name || line.description}
                                    </span>
                                    <span className="shrink-0 font-black text-primary text-[11px]">
                                        {Math.round(showAnimations ? current : 0)} / {Math.round(total)}
                                    </span>
                                </div>
                                <div className="h-1 w-full bg-border/20 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full transition-all duration-1000", pct === 100 ? "bg-success" : "bg-primary")}
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
                    {(activeDoc?.lines || activeDoc?.items || []).length > 3 && (
                        <div className="text-[9px] text-muted-foreground/40 italic flex justify-center py-1 border-t border-border mt-1 uppercase tracking-tighter font-bold">
                            + {(activeDoc?.lines || activeDoc?.items || []).length - 3} ítems adicionales en proceso
                        </div>
                    )}
                </div>
            </PhaseCard>

            <ActionConfirmModal
                open={confirmModal.open}
                onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}
                title={confirmModal.title}
                description={confirmModal.description}
                onConfirm={confirmModal.onConfirm}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
                requireReason={confirmModal.requireReason}
                reasonLabel="Motivo de la anulación"
            />
        </>
    )
}
