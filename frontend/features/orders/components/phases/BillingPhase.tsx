import { getErrorMessage } from "@/lib/errors"

import { useState } from "react"
import { PhaseCard } from "./PhaseCard"
import { FileText, Trash2, X } from "lucide-react"
import { formatDocumentId } from '@/features/orders/utils/status'
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { saleOrderActions } from '@/features/sales/actions'
import { purchaseOrderActions } from '@/features/purchasing/actions'
import { Order, PhaseDocument } from "../../types"
import { LucideIcon } from "lucide-react"

interface BillingPhaseProps {
    isNoteMode: boolean
    noteStatuses: Record<string, string | boolean | number>
    activeDoc: Order
    invoices: Order[]
    billingIsComplete: boolean
    userPermissions: string[]
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    posSessionId?: number | null
    // Accordion props
    collapsible?: boolean
    isOpen?: boolean
    isWarning?: boolean
    disabled?: boolean
    icon?: LucideIcon
    onOpenChange?: (open: boolean) => void
}

export function BillingPhase({
    isNoteMode,
    noteStatuses,
    activeDoc,
    invoices,
    billingIsComplete,
    userPermissions,
    onActionSuccess,
    openDetails,
    posSessionId = null,
    collapsible,
    isOpen,
    onOpenChange,
}: BillingPhaseProps) {
    const registry = (activeDoc?.document_type as string === 'PURCHASE_ORDER' || activeDoc?.document_type as string === 'SERVICE_OBLIGATION') 
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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error) || "Error al anular documento"
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
                variant={(isNoteMode ? noteStatuses.billing : (billingIsComplete ? 'success' : (invoices.length > 0 ? 'active' : 'neutral'))) as any}
                documents={[
                    ...(isNoteMode ? [{
                        type: activeDoc.dte_type_display || 'Nota',
                        number: activeDoc.display_id || formatDocumentId(
                            activeDoc.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND',
                            activeDoc.number || '---',
                            activeDoc.display_id
                        ),
                        icon: FileText,
                        color: 'text-warning',
                        id: activeDoc.id,
                        docType: 'invoice',
                        status: activeDoc.status,
                        isWarning: true,
                        actions: []
                    }] : []),
                    ...invoices
                        .filter((inv: Order) => !isNoteMode || inv.id !== activeDoc.id)
                        .map((inv: Order) => ({
                            type: inv.dte_type_display || 'Documento',
                            number: inv.display_id || formatDocumentId(
                                inv.dte_type === 'BOLETA' ? 'BOL' :
                                    inv.dte_type === 'FACTURA_EXENTA' ? 'FE' :
                                        inv.dte_type === 'BOLETA_EXENTA' ? 'BE' : 'FACT',
                                inv.number || '---',
                                inv.display_id
                            ),
                            icon: FileText,
                            color: (inv.dte_type === 'FACTURA_EXENTA' || inv.dte_type === 'BOLETA_EXENTA') ? 'text-warning' : 'text-primary',
                            id: Number(inv.id),
                            docType: 'invoice',
                            status: inv.status,
                            actions: [
                                ...((inv.status === 'DRAFT') ? [{
                                    icon: Trash2,
                                    title: 'Eliminar Borrador',
                                    color: 'text-destructive hover:bg-destructive/10',
                                    onClick: () => handleDeleteDraft(Number(inv.id))
                                }] : []),
                                ...((inv.status !== 'CANCELLED' && inv.status !== 'DRAFT') ? [{
                                    icon: X,
                                    title: 'Anular Documento',
                                    color: 'text-warning hover:bg-warning/10',
                                    onClick: () => handleAnnulDocument(Number(inv.id))
                                }] : [])
                            ]
                        })),
                    ...(!isNoteMode ? (activeDoc.related_documents?.notes || []).map((note: Record<string, unknown>) => ({
                        type: (note.type_display as string) || (note.dte_type === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'),
                        number: (note.display_id as string) || (note.number as string),
                        icon: FileText,
                        color: 'text-primary',
                        id: note.id as number | string,
                        docType: 'invoice',
                        status: note.status as string,
                        isWarning: true, // Highlights as requested
                        actions: [] // Removed redundant GitBranch icon
                    })) as PhaseDocument[] : [])
                ].filter((doc: PhaseDocument) => {
                    // If in Note mode, we ONLY want to show the note itself in this stage list
                    // as the "original" invoices are already shown in the Origin stage.
                    if (isNoteMode) return doc.id === activeDoc.id;
                    return true;
                })}
                onViewDetail={openDetails}
                actions={[
                    ...(registry.documents?.actions || []),
                    ...(isNoteMode ? [] : (registry.notes?.actions || []))
                ].filter((a: { id: string }) => !a.id.includes('view-'))}
                emptyMessage="Sin documentos emitidos"
                order={activeDoc}
                userPermissions={userPermissions}
                onActionSuccess={onActionSuccess}
                stageId="billing"
                isComplete={billingIsComplete}
                posSessionId={posSessionId}
                collapsible={collapsible}
                isOpen={isOpen}
                onOpenChange={onOpenChange}
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
