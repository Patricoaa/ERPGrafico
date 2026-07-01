"use client"

import { showApiError } from "@/lib/errors"
import { formatEntityDisplay } from "@/lib/entity-registry"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { ClipboardList, Ban } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useAnnulWorkOrder } from "../../hooks/useOrdersMutations"
import { ActionConfirmModal } from '@/components/shared'
import { saleOrderActions } from '@/features/sales'
import { purchaseOrderActions } from '@/features/purchasing'
import { type Order, type OrderLine, type PhaseDocument, type WorkOrder, type InvoiceSummary } from "../../types"

interface ProductionPhaseProps {
    order: Order | null
    activeDoc: Order
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    showAnimations: boolean
    isSale?: boolean
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
    isSale = true,
}: ProductionPhaseProps) {
    const registry = isSale ? saleOrderActions : purchaseOrderActions

    const annulWorkOrder = useAnnulWorkOrder()

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

    const activeOTs = activeDoc.work_orders?.filter((ot: WorkOrder) => ot.status !== 'CANCELLED') || []
    const totalOTs = activeOTs.length
    const totalOTProgress = totalOTs > 0
        ? activeOTs.reduce((sum: number, ot: WorkOrder) => sum + (ot.production_progress || 0), 0) / totalOTs
        : 0

    // Only show if order has manufacturable items or existing work orders
    const showProduction = (order?.work_orders?.length || 0) > 0 || (activeDoc.lines || activeDoc.items || []).some((l: OrderLine) => l.is_manufacturable)

    if (!showProduction) return null

    const invoices = activeDoc.related_documents?.invoices || []

    const canAnnulWorkOrder = userPermissions.includes('production.delete_workorder')

    const handleAnnulWorkOrder = (id: number) => {
        setConfirmModal({
            open: true,
            title: "Anular Orden de Trabajo",
            variant: "destructive",
            confirmText: "Anular OT",
            requireReason: true,
            onConfirm: async (reason?: string) => {
                try {
                    await annulWorkOrder.mutateAsync({ id, reason })
                    setConfirmModal(prev => ({ ...prev, open: false }))
                    onActionSuccess?.()
                } catch (error: unknown) {
                    showApiError(error, "Error al anular OT")
                    throw error
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
                progress={totalOTProgress}
                documents={activeDoc.work_orders?.map((ot: WorkOrder) => ({
                    type: 'Orden de Trabajo',
                    number: formatEntityDisplay('production.workorder', ot),
                    icon: ClipboardList,
                    id: Number(ot.id),
                    docType: 'work_order',
                    status: ot.status,
                    progressValue: ot.production_progress || 0,
                    actions: [
                        // Only show OT annulment if invoice is DRAFT and stage is pre-impresion or earlier
                        ...((canAnnulWorkOrder &&
                            ot.status !== 'CANCELLED' &&
                            invoices.some((inv: InvoiceSummary) => inv.status === 'DRAFT') &&
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
                        <Progress value={showAnimations ? totalOTProgress : 0} className="h-1 bg-muted transition-all duration-1000" />
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
                requireReason={confirmModal.requireReason}
                reasonLabel="Motivo de la anulación"
            />
        </>
    )
}
