
import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { FileText, Trash2, X } from "lucide-react"
import { formatDocumentId } from "@/lib/order-status-utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface BillingPhaseProps {
    isNoteMode: boolean
    noteStatuses: any
    activeDoc: any
    invoices: any[]
    billingIsComplete: boolean
    registry: any
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    actionEngineRef: any
    posSessionId?: number | null
}

export function BillingPhase({
    isNoteMode,
    noteStatuses,
    activeDoc,
    invoices,
    billingIsComplete,
    registry,
    userPermissions,
    onActionSuccess,
    openDetails,
    actionEngineRef,
    posSessionId
}: BillingPhaseProps) {
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

    const handleDeleteDraft = async (id: number, isConfirmed = false) => {
        if (!isConfirmed) {
            setConfirmModal({
                open: true,
                title: "Eliminar Borrador",
                variant: "destructive",
                confirmText: "Eliminar Borrador",
                onConfirm: () => handleDeleteDraft(id, true),
                description: "¿Estás seguro de que deseas eliminar este borrador de factura? Esta acción no se puede deshacer."
            })
            return
        }

        try {
            await api.delete(`/billing/invoices/${id}/`)
            toast.success("Borrador eliminado correctamente")
            setConfirmModal(prev => ({ ...prev, open: false }))
            onActionSuccess?.()
        } catch (error: any) {
            console.error("Error deleting draft:", error)
            toast.error("No se pudo eliminar el borrador")
        }
    }

    const handleAnnulDocument = async (id: number, force: boolean = false) => {
        try {
            await api.post(`/billing/invoices/${id}/annul/`, { force })
            toast.success("Documento anulado correctamente")
            setConfirmModal(prev => ({ ...prev, open: false }))
            onActionSuccess?.()
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || "Error al anular documento"
            if (errorMessage.includes("pagos asociados") && !force) {
                setConfirmModal({
                    open: true,
                    title: "Anular Documento con Pagos",
                    variant: "warning",
                    confirmText: "Anular Todo",
                    onConfirm: () => handleAnnulDocument(id, true),
                    description: "El documento tiene pagos asociados. ¿Deseas anular el documento y todos sus pagos vinculados? Esta acción es irreversible."
                })
            } else {
                toast.error(errorMessage)
            }
        }
    }

    return (
        <>
            <PhaseCard
                title="Facturación"
                icon={FileText}
                variant={isNoteMode ? noteStatuses.billing : (billingIsComplete ? 'success' : (invoices.length > 0 ? 'active' : 'neutral'))}
                documents={invoices.map((inv: any) => ({
                    type: inv.dte_type_display || 'Documento',
                    number: formatDocumentId(inv.dte_type === 'BOLETA' ? 'BOL' : 'FACT', inv.number || '---', inv.display_id),
                    icon: FileText,
                    id: inv.id,
                    docType: 'invoice',
                    status: inv.status,
                    actions: [
                        ...((inv.status === 'DRAFT') ? [{
                            icon: Trash2,
                            title: 'Eliminar Borrador',
                            color: 'text-red-500 hover:bg-red-500/10',
                            onClick: () => handleDeleteDraft(inv.id)
                        }] : []),
                        ...((inv.status !== 'CANCELLED' && inv.status !== 'DRAFT') ? [{
                            icon: X,
                            title: 'Anular Documento',
                            color: 'text-orange-600 hover:bg-orange-600/10',
                            onClick: () => handleAnnulDocument(inv.id)
                        }] : [])
                    ]
                }))}
                onViewDetail={openDetails}
                actions={(isNoteMode ? [] : registry.documents?.actions || []).filter((a: any) => !a.id.includes('view-'))}
                emptyMessage="Sin documentos emitidos"
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                actionEngineRef={actionEngineRef}
                stageId="billing"
                isComplete={billingIsComplete}
                posSessionId={posSessionId}
            />

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
