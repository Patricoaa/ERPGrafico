"use client"

import { useInvalidateDocuments } from "@/features/documents"
import type { NoteType } from "@/features/notes"
import { OrderNoteWizard } from "./OrderNoteWizard"

export interface NoteWizardTabProps {
    invoiceId: number
    noteType: NoteType
    /** `true` solo mientras su pestaña está activa; el wizard sigue montado y conserva lo ingresado. */
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Wizard de NC/ND como pestaña del espacio de trabajo (`openNoteWizard`). Al emitir la nota se
 * refrescan los documentos (la ficha de origen muestra la nueva nota); el cierre de la pestaña lo
 * hace el propio wizard vía `onOpenChange(false)`.
 */
export function NoteWizardTab({ invoiceId, noteType, open, onOpenChange }: NoteWizardTabProps) {
    const invalidateDocuments = useInvalidateDocuments()

    return (
        <OrderNoteWizard
            open={open}
            noteType={noteType}
            invoiceId={invoiceId}
            onOpenChange={onOpenChange}
            onSuccess={() => { void invalidateDocuments() }}
        />
    )
}
