"use client"

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
import { FileText, Loader2, Upload } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { useServerDate } from "@/hooks/useServerDate"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"

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
        } catch (error: any) {
            console.error("Error registering document:", error)
            toast.error(error.response?.data?.error || "Error al registrar el documento")
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
                    <Button onClick={handleSubmit} disabled={submitting}>
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
                    <Input
                        id="issue-date"
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        disabled={isPending}
                    />
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
