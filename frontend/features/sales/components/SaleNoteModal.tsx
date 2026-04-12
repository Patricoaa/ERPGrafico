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
import { FileBadge, Loader2, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"
import { EmptyState } from "@/components/shared/EmptyState"
import { PeriodValidationDateInput } from "@/components/shared/PeriodValidationDateInput"

import { SaleOrderLine } from "../types"

interface SaleNoteLine extends SaleOrderLine {
    note_quantity: number
    note_unit_price: number
}

interface SaleNoteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId?: number
    orderNumber?: string
    invoiceId?: number
    onSuccess?: () => void
    initialType?: "NOTA_CREDITO" | "NOTA_DEBITO"
}

export function SaleNoteModal({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    invoiceId,
    onSuccess,
    initialType = "NOTA_CREDITO"
}: SaleNoteModalProps) {
    const [noteType, setNoteType] = useState(initialType)
    const [documentNumber, setDocumentNumber] = useState("")
    const [documentDate, setDocumentDate] = useState<Date | undefined>(new Date())
    const [lines, setLines] = useState<SaleNoteLine[]>([])
    const [attachment, setAttachment] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [loadingOrder, setLoadingOrder] = useState(false)
    const [isPeriodValid, setIsPeriodValid] = useState(true)

    useEffect(() => {
        if (open) {
            setDocumentNumber("")
            setDocumentDate(new Date())
            setAttachment(null)
            fetchDetails()
        }
    }, [open])

    const fetchDetails = async () => {
        setLoadingOrder(true)
        try {
            let fetchedLines: SaleOrderLine[] = []

            if (orderId) {
                const response = await api.get(`/sales/orders/${orderId}/`)
                fetchedLines = response.data.lines || []
            } else if (invoiceId) {
                const response = await api.get(`/billing/invoices/${invoiceId}/`)
                fetchedLines = response.data.lines || []
            }

            // Initializing lines with 0 quantity but original unit price
            const initialLines: SaleNoteLine[] = fetchedLines.map((line: SaleOrderLine) => ({
                ...line,
                note_quantity: 0,
                note_unit_price: Number(line.unit_price)
            }))
            setLines(initialLines)
        } catch (error) {
            console.error("Error fetching details:", error)
            toast.error("No se pudieron cargar los detalles del documento")
        } finally {
            setLoadingOrder(false)
        }
    }

    const handleLineChange = (index: number, field: 'note_quantity' | 'note_unit_price', value: string) => {
        const newLines = [...lines]
        newLines[index] = {
            ...newLines[index],
            [field]: parseFloat(value) || 0
        }
        setLines(newLines)
    }

    const amountNet = lines.reduce((acc, line) => acc + (line.note_quantity * line.note_unit_price), 0)
    const amountTax = PricingUtils.calculateTax(amountNet)
    const total = amountNet + amountTax

    const handleSubmit = async () => {
        if (!documentNumber) {
            toast.error("El número de documento es obligatorio")
            return
        }
        if (!documentDate) {
            toast.error("La fecha del documento es obligatoria")
            return
        }

        // Live validation already handles this, but as a secondary check/guard
        if (!isPeriodValid) {
            toast.error("El periodo seleccionado está cerrado. No puede continuar.")
            return
        }

        if (!attachment) {
            toast.error("El archivo adjunto es obligatorio para este tipo de nota")
            return
        }
        if (amountNet <= 0) {
            toast.error("El monto total de la nota debe ser mayor a 0")
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('note_type', noteType)
            formData.append('document_number', documentNumber)
            if (documentDate) {
                formData.append('document_date', documentDate.toISOString().split('T')[0])
            }
            formData.append('amount_net', amountNet.toString())
            formData.append('amount_tax', amountTax.toString())

            const returnItems = lines
                .filter(l => l.note_quantity > 0)
                .map(l => ({
                    product_id: l.product as number,
                    quantity: l.note_quantity,
                    unit_price: l.note_unit_price
                }))

            formData.append('return_items', JSON.stringify(returnItems))

            if (invoiceId) {
                formData.append('original_invoice_id', invoiceId.toString())
            }

            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            let endpoint = ""
            if (orderId) {
                endpoint = `/sales/orders/${orderId}/register_note/`
            } else if (invoiceId) {
                endpoint = `/billing/invoices/${invoiceId}/register_note/`
            } else {
                throw new Error("No Order ID or Invoice ID provided")
            }

            await api.post(endpoint, formData)

            toast.success("Nota registrada correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error registering note:", error)
            showApiError(error, "Error al registrar la nota")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={
                <span className="flex items-center gap-2">
                    <FileBadge className="h-6 w-6 text-primary" />
                    Registrar Nota Crédito/Débito - {orderNumber ? `NV-${orderNumber}` : `Doc #${invoiceId}`}
                </span>
            }
            footer={
                <div className="w-full flex justify-end gap-2 border-t pt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !documentNumber || amountNet <= 0 || !isPeriodValid}
                        className="font-bold h-11 px-8"
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Registro de Nota
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className={FORM_STYLES.label}>Tipo de Nota</Label>
                        <Select value={noteType} onValueChange={(val: any) => setNoteType(val)}>
                            <SelectTrigger className={FORM_STYLES.input}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NOTA_CREDITO">Nota de Crédito (Devolución/Resciliación)</SelectItem>
                                <SelectItem value="NOTA_DEBITO">Nota de Débito (Cargo Adicional)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className={FORM_STYLES.label}>Número Documento</Label>
                        <Input
                            placeholder="Ej: NC-12345"
                            className={FORM_STYLES.input}
                            value={documentNumber}
                            onChange={(e) => setDocumentNumber(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className={FORM_STYLES.label}>Fecha Emisión</Label>
                        <PeriodValidationDateInput
                            date={documentDate}
                            onDateChange={setDocumentDate}
                            validationType="both"
                            onValidityChange={setIsPeriodValid}
                        />
                    </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="px-3 py-2 text-left font-black text-[10px] uppercase tracking-widest text-muted-foreground">Producto</th>
                                <th className="px-3 py-2 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-20">Unidad</th>
                                <th className="px-3 py-2 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-20">Cant. Orig.</th>
                                <th className="px-3 py-2 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-24">Cant. Nota</th>
                                <th className="px-3 py-2 text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground w-32">Precio Unit.</th>
                                <th className="px-3 py-2 text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground w-32">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loadingOrder ? (
                                <tr>
                                    <td colSpan={5} className="py-4 text-center text-muted-foreground italic">Cargando productos...</td>
                                </tr>
                            ) : lines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8">
                                        <EmptyState
                                            context="search"
                                            variant="compact"
                                            title="No hay productos"
                                            description="No se encontraron líneas disponibles en el documento original."
                                        />
                                    </td>
                                </tr>
                            ) : lines.map((line, idx) => (
                                <tr key={line.id} className={line.note_quantity > 0 ? "bg-primary/10/30" : ""}>
                                    <td className="px-3 py-2 font-medium">{line.product_name || line.description}</td>
                                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">{line.uom_name || '-'}</td>
                                    <td className="px-3 py-2 text-center text-muted-foreground font-bold">{line.quantity}</td>
                                    <td className="px-3 py-2">
                                        <Input
                                            type="number"
                                            className="h-8 text-center font-bold"
                                            value={line.note_quantity}
                                            min={0}
                                            max={noteType === 'NOTA_CREDITO' ? line.quantity : undefined}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                if (noteType === 'NOTA_DEBITO' || val <= line.quantity) {
                                                    handleLineChange(idx, 'note_quantity', e.target.value)
                                                }
                                            }}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px]">$</span>
                                            <Input
                                                type="number"
                                                className={`h-8 pl-5 text-right font-bold ${noteType === 'NOTA_CREDITO' ? 'bg-muted text-muted-foreground' : ''}`}
                                                value={line.note_unit_price}
                                                readOnly={noteType === 'NOTA_CREDITO'}
                                                disabled={noteType === 'NOTA_CREDITO'}
                                                onChange={(e) => handleLineChange(idx, 'note_unit_price', e.target.value)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right font-black">
                                        {formatCurrency(line.note_quantity * line.note_unit_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-start gap-8">
                    <div className="flex-1">
                        <DocumentAttachmentDropzone
                            file={attachment}
                            onFileChange={setAttachment}
                            dteType={noteType}
                        />
                    </div>

                    <div className={FORM_STYLES.card + " w-64 space-y-2"}>
                        <div className="flex justify-between text-xs text-muted-foreground uppercase font-bold">
                            <span>Neto:</span>
                            <span>{formatCurrency(amountNet)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground uppercase font-bold">
                            <span>IVA (19%):</span>
                            <span>{formatCurrency(amountTax)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t font-black">
                            <span className="text-sm">TOTAL:</span>
                            <span className="text-xl text-primary">{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>

                {noteType === 'NOTA_CREDITO' && (
                    <div className="flex gap-2 p-3 bg-info/5 rounded border border-info/20 text-[10px] text-info-foreground">
                        <AlertCircle className="h-4 w-4 shrink-0 text-info" />
                        <p>Si la nota implica devolución de productos, el sistema registrará una entrada de inventario (Stock IN) y reversará el costo de venta proporcionalmente.</p>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}

export default SaleNoteModal
