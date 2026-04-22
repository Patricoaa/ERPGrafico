import { showApiError } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { ClipboardList, Ban } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { Order, OrderLine, PhaseDocument, WorkOrder } from "../../types"

interface ProductionPhaseProps {
    order: Order | null
    activeDoc: Order
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    showAnimations: boolean
    // Accordion props
    collapsible?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export function ProductionPhase({
    order,
    activeDoc,
    userPermissions,
    onActionSuccess,
    openDetails,
    showAnimations,
    collapsible,
    isOpen,
    onOpenChange,
}: ProductionPhaseProps) {
    const registry = (activeDoc?.document_type === 'PURCHASE_ORDER' || activeDoc?.document_type === 'SERVICE_OBLIGATION') 
        ? purchaseOrderActions 
        : saleOrderActions

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

    const activeOTs = activeDoc.work_orders?.filter((ot: WorkOrder) => ot.status !== 'CANCELLED') || []
    const totalOTs = activeOTs.length
    const totalOTProgress = totalOTs > 0
        ? activeOTs.reduce((sum: number, ot: WorkOrder) => sum + (ot.production_progress || 0), 0) / totalOTs
        : 0

    // Only show if order has manufacturable items or existing work orders
    const showProduction = (order?.work_orders?.length || 0) > 0 || (activeDoc.lines || activeDoc.items || []).some((l: OrderLine) => l.is_manufacturable)

    if (!showProduction) return null

    const invoices = activeDoc.related_documents?.invoices || []

    const handleAnnulWorkOrder = async (id: number) => {
        setConfirmModal({
            open: true,
            title: "Anular Orden de Trabajo",
            variant: "destructive",
            confirmText: "Anular OT",
            onConfirm: async () => {
                try {
                    await api.post(`/production/orders/${id}/annul/`)
                    toast.success("OT anulada correctamente")
                    setConfirmModal(prev => ({ ...prev, open: false }))
                    onActionSuccess?.()
                } catch (error: unknown) {
                    showApiError(error, "Error al anular OT")
                }
            },
            description: "Esta acción reverterá los consumos de materiales y liberará las reservas. ¿Está seguro?"
        })
    }

    return (
        <>
            <PhaseCard
                title="Producción"
                icon={ClipboardList}
                variant={totalOTs === 0 ? 'neutral' : (totalOTProgress === 100 ? 'success' : 'active')}
                documents={activeDoc.work_orders?.map((ot: WorkOrder) => ({
                    type: 'Orden de Trabajo',
                    number: ot.display_id || `OT-${ot.code || ot.id}`,
                    icon: ClipboardList,
                    id: Number(ot.id),
                    docType: 'work_order',
                    status: ot.status,
                    progressValue: ot.production_progress || 0,
                    actions: [
                        // Only show OT annulment if invoice is DRAFT and stage is pre-impresion or earlier
                        ...((ot.status !== 'CANCELLED' &&
                            invoices.some((inv: Order) => inv.status === 'DRAFT') &&
                            ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(ot.current_stage as string)) ? [{
                                icon: Ban,
                                title: 'Anular OT',
                                color: 'text-warning hover:bg-warning/10',
                                onClick: () => handleAnnulWorkOrder(Number(ot.id))
                            }] : [])
                    ]
                })) as PhaseDocument[] || []}
                onViewDetail={openDetails}
                actions={(registry.production?.actions || []).filter((a: { id: string }) => !a.id.includes('view-'))}
                emptyMessage="Sin órdenes de trabajo"
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                showDocProgress={true}
                stageId="production"
                isComplete={totalOTProgress === 100 && totalOTs > 0}
                collapsible={collapsible}
                isOpen={isOpen}
                onOpenChange={onOpenChange}
            >
                {totalOTs > 0 ? (
                    <div className="space-y-1 px-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground/60">
                            <span>PROGRESO</span>
                            <span className="text-primary">{Math.round(showAnimations ? totalOTProgress : 0)}%</span>
                        </div>
                        <Progress value={showAnimations ? totalOTProgress : 0} className="h-1 bg-white/5 transition-all duration-1000" />
                    </div>
                ) : (
                    <div className="py-2 text-center text-[9px] text-muted-foreground/30 italic">Sin inicio</div>
                )}
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
