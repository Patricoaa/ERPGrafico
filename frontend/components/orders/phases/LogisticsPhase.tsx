
import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { Package, Ban } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDocumentId } from "@/lib/order-status-utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface LogisticsPhaseProps {
    activeDoc: any
    isNoteMode: boolean
    noteStatuses: any
    isSale: boolean
    invoices: any[]
    registry: any
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    actionEngineRef: any
    showAnimations: boolean
    initialOpen?: boolean
}

export function LogisticsPhase({
    activeDoc,
    isNoteMode,
    noteStatuses,
    isSale,
    invoices,
    registry,
    userPermissions,
    onActionSuccess,
    openDetails,
    actionEngineRef,
    showAnimations,
    initialOpen = true
}: LogisticsPhaseProps) {
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean,
        title: string,
        description: React.ReactNode,
        onConfirm: () => Promise<void> | void,
        variant?: 'destructive' | 'warning',
        confirmText?: string
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const handleAnnulLogistics = async (id: number, docType: string) => {
        const label = docType === 'sale_delivery' ? 'Despacho' :
            (docType === 'purchase_receipt' ? 'Recepción' : 'Devolución')

        setConfirmModal({
            open: true,
            title: `Anular ${label}`,
            variant: "destructive",
            confirmText: `Anular ${label}`,
            onConfirm: async () => {
                try {
                    let endpoint = ''
                    if (docType === 'sale_delivery') endpoint = `/sales/deliveries/${id}/annul/`
                    else if (docType === 'purchase_receipt') endpoint = `/purchasing/receipts/${id}/annul/`
                    else if (docType === 'sale_return') endpoint = `/sales/returns/${id}/annul/`
                    else if (docType === 'purchase_return') endpoint = `/purchasing/returns/${id}/annul/`

                    await api.post(endpoint)
                    toast.success(`${label} anulado correctamente`)
                    setConfirmModal(prev => ({ ...prev, open: false }))
                    onActionSuccess?.()
                } catch (error: any) {
                    toast.error(error.response?.data?.error || `Error al anular ${label}`)
                }
            },
            description: `Esta acción reverterá los movimientos de inventario asociados. ¿Está seguro de anular este ${label.toLowerCase()}?`
        })
    }

    // Resolve Logistics Documents
    const logisticsDocs = (() => {
        const docs: any[] = []

        // 1. Returns for Notes/Orders
        if (activeDoc.related_returns?.length > 0) {
            docs.push(...activeDoc.related_returns.map((doc: any) => ({
                type: doc.type,
                number: formatDocumentId('DEV', doc.number || doc.id, doc.display_id),
                icon: Package,
                id: doc.id,
                docType: doc.docType,
                status: doc.status,
                actions: [
                    ...((doc.status !== 'CANCELLED') ? [{
                        icon: Ban,
                        title: 'Anular Devolución',
                        color: 'text-orange-500 hover:bg-orange-500/10',
                        onClick: () => handleAnnulLogistics(doc.id, doc.docType)
                    }] : [])
                ]
            })))
        }

        // 2. High-level Deliveries/Receipts
        const specificDocs = isSale ? activeDoc.related_documents?.deliveries : (activeDoc.related_documents?.receipts || activeDoc.related_documents?.receptions)
        if (specificDocs?.length > 0) {
            docs.push(...specificDocs.map((doc: any) => ({
                type: isSale ? 'Despacho' : 'Recepción',
                number: formatDocumentId(isSale ? 'DES' : 'REC', doc.number || doc.id, doc.display_id),
                icon: Package,
                id: doc.id,
                docType: doc.docType || (isSale ? 'sale_delivery' : 'inventory'),
                status: doc.status,
                actions: [
                    ...((doc.status !== 'CANCELLED' && invoices.some((inv: any) => inv.status === 'DRAFT')) ? [{
                        icon: Ban,
                        title: isSale ? 'Anular Despacho' : 'Anular Recepción',
                        color: 'text-orange-500 hover:bg-orange-500/10',
                        onClick: () => handleAnnulLogistics(doc.id, isSale ? 'sale_delivery' : 'purchase_receipt')
                    }] : [])
                ]
            })))
        }

        // 3. Low-level Stock Moves (only if no high-level docs found to avoid clutter)
        if (docs.length === 0 && activeDoc.related_stock_moves?.length > 0) {
            docs.push(...activeDoc.related_stock_moves.map((m: any) => ({
                type: m.move_type_display || 'Movimiento',
                number: formatDocumentId('MOV', m.id, m.display_id),
                icon: Package,
                id: m.id,
                docType: 'inventory',
                status: m.state || 'Realizado',
                actions: []
            })))
        }

        return docs
    })()

    // Calculate dynamic logistics progressLogic phase for logistics
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

    const showLogistics = (activeDoc.lines || activeDoc.items || []).length > 0 && !(activeDoc.lines || activeDoc.items || []).every((l: any) => l.product_type === 'SUBSCRIPTION')

    if (!showLogistics) return null

    const title = (() => {
        const lines = activeDoc?.lines || activeDoc?.items || []
        const allServices = lines.every((l: any) => ['SERVICE', 'SUBSCRIPTION'].includes(l.product_type))
        const hasServices = lines.some((l: any) => ['SERVICE', 'SUBSCRIPTION'].includes(l.product_type))
        const onlySubscriptions = lines.every((l: any) => l.product_type === 'SUBSCRIPTION')

        if (onlySubscriptions) return 'Suscripciones'
        return allServices ? 'Cumplimiento' : (hasServices ? 'Logística/Cumplimiento' : 'Logística')
    })()

    return (
        <>
            <PhaseCard
                title={title}
                icon={Package}
                variant={isNoteMode ? noteStatuses.logistics : (logisticsProgress === 100 ? 'success' : logisticsProgress > 0 ? 'active' : 'neutral')}
                documents={logisticsDocs}
                onViewDetail={openDetails}
                actions={(isNoteMode ? (registry[isSale ? 'deliveries' : 'receptions']?.actions || registry.returns?.actions || []) : (registry[isSale ? 'deliveries' : 'receptions']?.actions || [])).filter((a: any) => !a.id.includes('view-'))}
                emptyMessage={isNoteMode ? "Sin movimientos asociados" : "Sin movimientos"}
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                actionEngineRef={actionEngineRef}
                showDocProgress={true}
                initialOpen={initialOpen}
                stageId="logistics"
                isComplete={logisticsProgress >= 100}
            >
                <div className="space-y-1.5 py-1">
                    {(activeDoc?.lines || activeDoc?.items || []).map((line: any, idx: number) => {
                        const total = parseFloat(line.quantity) || 1
                        const processedField = isSale
                            ? (line.quantity_delivered !== undefined ? 'quantity_delivered' : 'delivered_quantity')
                            : (line.quantity_received !== undefined ? 'quantity_received' : 'received_quantity')

                        const current = parseFloat(line[processedField] || 0)
                        const pct = Math.min(100, Math.round((current / total) * 100))

                        return (
                            <div key={idx} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[10px] gap-2">
                                    <span className="text-foreground/70 line-clamp-1 flex-1">
                                        {line.product_name || line.description}
                                    </span>
                                    <span className="shrink-0 font-bold text-primary/80">
                                        {Math.round(showAnimations ? current : 0)}/{Math.round(total)}
                                    </span>
                                </div>
                                <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full transition-all duration-1000", pct === 100 ? "bg-green-500/30" : "bg-primary/30")}
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
            />
        </>
    )
}
