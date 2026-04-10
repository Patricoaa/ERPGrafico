"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { FileText, Loader2, Upload, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { useServerDate } from "@/hooks/useServerDate"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"
import { usePeriodValidation } from "@/hooks/usePeriodValidation"
import { DatePicker } from "@/components/shared/DatePicker"

interface DocumentRegistrationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    orderNumber: string
    onSuccess?: () => void
}

export function DocumentRegistrationModal({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    onSuccess
}: DocumentRegistrationModalProps) {
    const { dateString } = useServerDate()
    const [dteType, setDteType] = useState("FACTURA")
    const [reference, setReference] = useState("")
    const [issueDate, setIssueDate] = useState("")

    // Sync with server date
    useEffect(() => {
        if (dateString && !issueDate) {
            setIssueDate(dateString)
        }
    }, [dateString])
    const [attachment, setAttachment] = useState<File | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const { validatePeriod, isClosed, message, isValidating: periodValidating, clearPeriodValidation } = usePeriodValidation()

    // Validate period when date changes
    useEffect(() => {
        if (issueDate && !isPending) {
            validatePeriod(issueDate, 'both')
        } else {
            clearPeriodValidation()
        }
    }, [issueDate, isPending, validatePeriod, clearPeriodValidation])

    const handleSubmit = async () => {
        // Validation: Required fields (Skip if isPending)
        if (!isPending) {
            if (!reference) {
                toast.error(`El número de referencia/folio es obligatorio para ${dteType === 'FACTURA' ? 'Facturas' : 'Boletas'}`)
                return
            }

            if (dteType === 'FACTURA' && !attachment) {
                toast.error("El documento adjunto es obligatorio para Facturas")
                return
            }

            // Live validation already handles this
            if (isClosed) {
                toast.error(message || "El periodo seleccionado está cerrado.")
                return
            }
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('order_id', orderId.toString())
            formData.append('order_type', 'purchase')
            formData.append('dte_type', dteType)
            formData.append('supplier_invoice_number', isPending ? '' : reference)
            formData.append('issue_date', issueDate)
            formData.append('status', isPending ? 'DRAFT' : 'POSTED')

            if (attachment && !isPending) {
                formData.append('document_attachment', attachment)
            }

            await api.post('/billing/invoices/create_from_order/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            toast.success(isPending ? "Documento registrado como pendiente" : "Documento registrado correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error registering document:", error)
            showApiError(error, "Error al registrar el documento")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="md"
            title={
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Registrar Factura/Boleta - OCS-{orderNumber}
                </div>
            }
            description="Ingrese los datos del documento tributario recibido del proveedor."
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || (!isPending && (isClosed || periodValidating))}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar Documento
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <Select value={dteType} onValueChange={setDteType}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="FACTURA">Factura Electrónica</SelectItem>
                            <SelectItem value="BOLETA">Boleta Electrónica</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center space-x-2 py-2">
                    <input
                        type="checkbox"
                        id="pending-check"
                        checked={isPending}
                        onChange={(e) => setIsPending(e.target.checked)}
                        className="h-4 w-4 rounded border text-primary focus:ring-indigo-600"
                    />
                    <Label htmlFor="pending-check" className="text-sm font-medium leading-none cursor-pointer">
                        Aún no recibo el documento físico / digital
                    </Label>
                </div>

                <div className={`space-y-2 ${isPending ? 'opacity-50' : ''}`}>
                    <Label htmlFor="issue-date" className={isPending ? 'text-muted-foreground' : ''}>Fecha de Emisión</Label>
                    <DatePicker
                        date={issueDate ? new Date(issueDate + 'T12:00:00') : undefined}
                        onDateChange={(date) => setIssueDate(date ? date.toISOString().split('T')[0] : "")}
                        disabled={isPending}
                        className={cn("w-full", isClosed && !isPending && "border-destructive")}
                    />
                    {isClosed && !isPending && (
                        <div className="flex items-center gap-2 mt-1 text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold leading-tight uppercase">
                                {message}
                            </span>
                        </div>
                    )}
                </div>

                <div className={`space-y-2 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Label htmlFor="reference">
                        N° de Folio / Referencia <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="reference"
                        placeholder="Ej: 12345"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        disabled={isPending}
                    />
                </div>

                <div className={`space-y-2 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                    <DocumentAttachmentDropzone
                        file={attachment}
                        onFileChange={setAttachment}
                        dteType={dteType}
                        isPending={isPending}
                        disabled={isPending}
                    />
                </div>
            </div>
        </BaseModal>
    )
}

import { CheckCircle2 } from "lucide-react"
