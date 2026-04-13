"use client"

import { useState, useEffect } from "react"
import { useServerDate } from "@/hooks/useServerDate"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileEdit, Loader2, Upload, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { validateTaxPeriod } from "@/lib/actions/tax-actions"
import { validateAccountingPeriod } from "@/lib/actions/accounting-actions"
import { FolioValidationInput } from "./FolioValidationInput"
import { ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface DocumentCompletionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    invoiceId: number
    invoiceType: string
    /** Callback to execute the completion. Receives a FormData with number, date, and optional document_attachment. */
    onComplete: (invoiceId: number, formData: FormData) => Promise<void>
    onSuccess?: () => void
    contactId?: number
    isPurchase?: boolean
}

export function DocumentCompletionModal({
    open,
    onOpenChange,
    invoiceId,
    invoiceType,
    onComplete,
    onSuccess,
    contactId,
    isPurchase
}: DocumentCompletionModalProps) {
    const { dateString } = useServerDate()
    const [reference, setReference] = useState("")
    const [date, setDate] = useState("")
    const [attachment, setAttachment] = useState<File | null>(null)
    const [isFolioValid, setIsFolioValid] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (dateString && !date) {
            setDate(dateString)
        }
    }, [dateString])

    const handleSubmit = async () => {
        if (!reference) {
            toast.error("El número de folio es obligatorio para completar el documento")
            return
        }

        if (invoiceType === 'FACTURA' && !attachment) {
            toast.error("El documento adjunto es obligatorio para Facturas")
            return
        }

        // Tax Period Validation
        const taxCheck = await validateTaxPeriod(date)
        if (taxCheck.is_closed) {
            toast.error(`No se puede registrar este documento. El periodo tributario de ${date} ya se encuentra CERRADO.`)
            return
        }

        // Accounting Period Validation
        const accCheck = await validateAccountingPeriod(date)
        if (accCheck.is_closed) {
            toast.error(`No se puede registrar este documento. El periodo CONTABLE de ${date} ya se encuentra CERRADO.`)
            return
        }

        if (!isFolioValid) {
            toast.error("El número de folio ya ha sido utilizado. Ingrese uno válido para continuar.")
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('number', reference)
            formData.append('date', date)
            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            await onComplete(invoiceId, formData)

            toast.success("Documento finalizado correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error finalizing document:", error)
            const apiError = error as { response?: { data?: { error?: string } } }
            toast.error(apiError.response?.data?.error || "Error al finalizar el documento")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title={
                <div className="flex items-center gap-2">
                    <FileEdit className="h-5 w-5" />
                    Completar Datos del Documento
                </div>
            }
            description="Ingrese el folio, fecha y adjunte el documento legal para finalizar el registro."
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !isFolioValid}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Finalizar Documento
                    </Button>
                </>
            }
        >
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <FolioValidationInput
                        value={reference}
                        onChange={setReference}
                        onValidityChange={setIsFolioValid}
                        contactId={contactId}
                        isPurchase={isPurchase}
                        dteType={invoiceType}
                        placeholder="Ej: 12345"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="comp-date">
                        Fecha de Emisión <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="comp-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>
                        Adjuntar Documento {invoiceType === 'FACTURA' ? <span className="text-destructive">*</span> : "(Opcional)"}
                    </Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="file"
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                            className="cursor-pointer"
                        />
                    </div>
                    {attachment && (
                        <div className="text-xs text-success font-medium flex items-center gap-1 mt-1">
                            <CheckCircle2 className="h-3 w-3" /> {attachment.name}
                        </div>
                    )}
                </div>
            </div>
        </BaseModal>
    )
}

export default DocumentCompletionModal
