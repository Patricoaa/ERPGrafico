"use client"

import { useRef, useState } from "react"
import { FileText, Lock } from "lucide-react"
import { toast } from "sonner"

import { DocumentAttachmentDropzone, SubmitButton } from "@/components/shared"
import { showApiError } from "@/lib/errors"
import { generateUuidV4 } from "@/lib/uuid"
import { useClosePeriod, useUploadF29Document } from "../../hooks/useTaxMutations"
import type { TaxDeclaration } from "../../types"

interface F29CloseStepProps {
    declaration: TaxDeclaration
    onChanged: () => void
}

/**
 * Paso "Cierre" del wizard F29: exige el comprobante PDF (salvo que ya esté
 * adjunto) y cierra el período tributario. Una clave de idempotencia por
 * operación, regenerada tras cualquier fallo: el endpoint cachea también las
 * respuestas 400 por clave.
 */
export function F29CloseStep({ declaration, onChanged }: F29CloseStepProps) {
    const [file, setFile] = useState<File | null>(null)
    const { uploadF29Document, isUploadingF29Document } = useUploadF29Document(declaration.id)
    const { closePeriod, isClosingPeriod } = useClosePeriod()
    const idempotencyKeyRef = useRef<string | null>(null)

    const hasDocument = Boolean(declaration.document)
    const isBusy = isClosingPeriod || isUploadingF29Document
    const canClose = (file !== null || hasDocument) && declaration.tax_period != null

    const handleClose = async () => {
        if (!canClose || declaration.tax_period == null) return
        if (file) {
            try {
                await uploadF29Document(file)
            } catch {
                // El hook ya mostró el error.
                return
            }
        }
        if (!idempotencyKeyRef.current) idempotencyKeyRef.current = generateUuidV4()
        try {
            await closePeriod({ id: declaration.tax_period, idempotencyKey: idempotencyKeyRef.current })
        } catch (error: unknown) {
            idempotencyKeyRef.current = null
            showApiError(error, "Error al cerrar el período tributario")
            return
        }
        idempotencyKeyRef.current = null
        toast.success("Período tributario cerrado")
        onChanged()
    }

    return (
        <div className="max-w-4xl mx-auto pb-6 space-y-6">
            <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                    Para cerrar el período {declaration.tax_period_display}, adjunta el comprobante o formulario F29 en PDF. (Obligatorio)
                </p>
            </div>
            {hasDocument && !file && (
                <p className="text-xs text-muted-foreground">
                    Ya hay un comprobante adjunto; puedes reemplazarlo o cerrar con el actual.
                </p>
            )}
            <DocumentAttachmentDropzone file={file} onFileChange={setFile} accept="application/pdf,.pdf" />
            <div className="flex justify-end">
                <SubmitButton
                    type="button"
                    onClick={() => { void handleClose() }}
                    disabled={!canClose}
                    loading={isBusy}
                    icon={Lock}
                >
                    {isBusy ? "Cerrando..." : "Confirmar Cierre"}
                </SubmitButton>
            </div>
        </div>
    )
}
