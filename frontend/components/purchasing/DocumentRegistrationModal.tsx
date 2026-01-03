"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
    const [dteType, setDteType] = useState("FACTURA")
    const [reference, setReference] = useState("")
    const [attachment, setAttachment] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!reference) {
            toast.error("El número de referencia es obligatorio")
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('order_id', orderId.toString())
            formData.append('order_type', 'purchase')
            formData.append('dte_type', dteType)
            formData.append('supplier_invoice_number', reference)
            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            await api.post('/billing/invoices/create_from_order/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            toast.success("Documento registrado correctamente")
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Registrar Factura/Boleta - OC-{orderNumber}
                    </DialogTitle>
                    <DialogDescription>
                        Ingrese los datos del documento tributario recibido del proveedor.
                    </DialogDescription>
                </DialogHeader>

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

                    <div className="space-y-2">
                        <Label htmlFor="reference">N° de Folio / Referencia</Label>
                        <Input
                            id="reference"
                            placeholder="Ej: 12345"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Adjuntar Documento (Opcional)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="file"
                                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                className="cursor-pointer"
                            />
                        </div>
                        {attachment && (
                            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                                <CheckCircle2 className="h-3 w-3" /> {attachment.name}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar Documento
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

import { CheckCircle2 } from "lucide-react" // Added missing import
