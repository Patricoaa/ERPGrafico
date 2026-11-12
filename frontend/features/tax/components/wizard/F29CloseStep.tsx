"use client"

import { FileText } from "lucide-react"

import { DocumentAttachmentDropzone } from "@/components/shared"
import type { F29CloseController } from "../../hooks/useF29Close"
import type { TaxDeclaration } from "../../types"

interface F29CloseStepProps {
    declaration: TaxDeclaration
    /** Estado del cierre (`useF29Close`); la acción "Confirmar Cierre" vive en el footer del wizard. */
    close: Pick<F29CloseController, "file" | "setFile" | "hasDocument">
}

/**
 * Paso "Cierre" del wizard F29: adjuntar el comprobante PDF. El botón que cierra el período está en
 * el footer del wizard, igual que el resto de las acciones de avance.
 */
export function F29CloseStep({ declaration, close }: F29CloseStepProps) {
    return (
        <div className="max-w-4xl mx-auto pb-6 space-y-6">
            <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                    Para cerrar el período {declaration.tax_period_display}, adjunta el comprobante o formulario F29 en PDF. (Obligatorio)
                </p>
            </div>
            {close.hasDocument && !close.file && (
                <p className="text-xs text-muted-foreground">
                    Ya hay un comprobante adjunto; puedes reemplazarlo o cerrar con el actual.
                </p>
            )}
            <DocumentAttachmentDropzone file={close.file} onFileChange={close.setFile} accept="application/pdf,.pdf" />
        </div>
    )
}
