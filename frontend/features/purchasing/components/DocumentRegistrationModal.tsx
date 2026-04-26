"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FileText, Loader2, Upload, ShieldAlert, Plus } from "lucide-react"
import { FormFooter, LabeledInput, LabeledSelect, FormSection } from "@/components/shared"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { useServerDate } from "@/hooks/useServerDate"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"
import { PeriodValidationDateInput } from "@/components/shared/PeriodValidationDateInput"
import { FolioValidationInput } from "@/components/shared/FolioValidationInput"

interface DocumentRegistrationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    orderNumber: string
    supplierId?: number
    onSuccess?: () => void
}

export function DocumentRegistrationModal({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    supplierId,
    onSuccess
}: DocumentRegistrationModalProps) {
    const { dateString } = useServerDate()
    const [dteType, setDteType] = useState("FACTURA")
    const [reference, setReference] = useState("")
    const [issueDate, setIssueDate] = useState("")
    const [isFolioValid, setIsFolioValid] = useState(true)

    // Sync with server date
    useEffect(() => {
        if (dateString && !issueDate) {
            setIssueDate(dateString)
        }
    }, [dateString])
    const [attachment, setAttachment] = useState<File | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [isPeriodValid, setIsPeriodValid] = useState(true)

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
            if (!isPeriodValid) {
                toast.error("El periodo seleccionado está cerrado. No puede continuar.")
                return
            }

            if (!isFolioValid) {
                toast.error("El número de folio ya ha sido utilizado para este proveedor. Ingrese uno válido para continuar.")
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
                <FormFooter
                    actions={
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleSubmit} 
                                disabled={submitting || (!isPending && (!isPeriodValid || !isFolioValid))}
                            >
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Registrar Documento
                            </Button>
                        </>
                    }
                />
            }
        >
            <div className="space-y-8 py-4">
                <div className="space-y-4">
                    <LabeledSelect
                        label="Tipo de Documento"
                        value={dteType}
                        onChange={setDteType}
                        options={[
                            { value: "FACTURA", label: "Factura Electrónica" },
                            { value: "BOLETA", label: "Boleta Electrónica" },
                        ]}
                    />

                    <div className="flex items-center space-x-2 py-2">
                        <input
                            type="checkbox"
                            id="pending-check"
                            checked={isPending}
                            onChange={(e) => {
                                const pending = e.target.checked;
                                setIsPending(pending);
                                if (pending) {
                                    setReference('');
                                    setAttachment(null);
                                    setIsFolioValid(true);
                                    setIsPeriodValid(true);
                                }
                            }}
                            className="h-4 w-4 rounded border text-primary focus:ring-info"
                        />
                        <Label htmlFor="pending-check" className="text-sm font-medium leading-none cursor-pointer">
                            Aún no recibo el documento físico / digital
                        </Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className={`${isPending ? 'opacity-50' : ''}`}>
                            <Label htmlFor="issue-date" className={cn("mb-2 block", isPending ? 'text-muted-foreground' : '')}>Fecha de Emisión</Label>
                            <PeriodValidationDateInput
                                date={issueDate ? new Date(issueDate + 'T12:00:00') : undefined}
                                onDateChange={(date) => setIssueDate(date ? date.toISOString().split('T')[0] : "")}
                                disabled={isPending}
                                validationType="both"
                                onValidityChange={setIsPeriodValid}
                            />
                        </div>

                        <div className={`${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                            <FolioValidationInput
                                value={reference}
                                onChange={setReference}
                                onValidityChange={setIsFolioValid}
                                contactId={supplierId}
                                isPurchase={true}
                                dteType={dteType}
                                placeholder="Ej: 12345"
                                disabled={isPending}
                            />
                        </div>
                    </div>
                </div>

                {!isPending && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <FormSection title="Soporte Digital" icon={Upload} />
                        <DocumentAttachmentDropzone
                            file={attachment}
                            onFileChange={setAttachment}
                            dteType={dteType}
                            isPending={isPending}
                            disabled={isPending}
                        />
                    </div>
                )}
            </div>
        </BaseModal>
    )
}

