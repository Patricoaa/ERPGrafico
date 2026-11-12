"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { showApiError } from "@/lib/errors"
import { generateUuidV4 } from "@/lib/uuid"
import type { TaxDeclaration } from "../types"
import { useClosePeriod, useUploadF29Document } from "./useTaxMutations"

/**
 * Estado y acción del paso "Cierre" del wizard F29. Vive fuera del paso para que el botón
 * "Confirmar Cierre" pueda estar en el footer del wizard. Exige el comprobante PDF (salvo que ya esté
 * adjunto) y cierra el período tributario. Una clave de idempotencia por operación, regenerada tras
 * cualquier fallo: el endpoint cachea también las respuestas 400 por clave.
 */
export function useF29Close(declaration: TaxDeclaration | null, onClosed: () => void) {
    const [file, setFile] = useState<File | null>(null)
    const { uploadF29Document, isUploadingF29Document } = useUploadF29Document(declaration?.id ?? 0)
    const { closePeriod, isClosingPeriod } = useClosePeriod()
    const idempotencyKeyRef = useRef<string | null>(null)
    const closingRef = useRef(false)

    const hasDocument = Boolean(declaration?.document)
    const isBusy = isClosingPeriod || isUploadingF29Document
    const canClose = declaration != null && declaration.tax_period != null && (file !== null || hasDocument)

    const close = async () => {
        if (!canClose || declaration == null || declaration.tax_period == null || closingRef.current) return
        closingRef.current = true
        try {
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
            onClosed()
        } finally {
            closingRef.current = false
        }
    }

    return { file, setFile, hasDocument, canClose, isBusy, close }
}

export type F29CloseController = ReturnType<typeof useF29Close>
