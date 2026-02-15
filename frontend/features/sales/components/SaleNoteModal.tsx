"use client"

import { useState, useEffect } from "react"
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
import { FileBadge, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"
import { cn } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"

interface SaleNoteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId?: number
    orderNumber?: string
    invoiceId?: number
    onSuccess?: () => void
    initialType?: "NOTA_CREDITO" | "NOTA_DEBITO"
}

export default function SaleNoteModal({
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
    const [lines, setLines] = useState<any[]>([])
    const [attachment, setAttachment] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [loadingOrder, setLoadingOrder] = useState(false)

    useEffect(() => {
        if (open) {
            setDocumentNumber("")
            setAttachment(null)
            fetchDetails()
        }
    }, [open])

    const fetchDetails = async () => {
        setLoadingOrder(true)
        try {
            let data: any = {}
            let fetchedLines: any[] = []

            if (orderId) {
                const response = await api.get(`/sales/orders/${orderId}/`)
                data = response.data
                fetchedLines = data.lines || []
            } else if (invoiceId) {
                const response = await api.get(`/billing/invoices/${invoiceId}/`)
                data = response.data
                fetchedLines = data.lines || []
            }

            // Initializing lines with 0 quantity but original unit price
            const initialLines = fetchedLines.map((line: any) => ({
                ...line,
                note_quantity: 0,
                note_unit_price: parseFloat(line.unit_price)
            }))
            setLines(initialLines)
        } catch (error) {
            console.error("Error fetching details:", error)
            toast.error("No se pudieron cargar los detalles del documento")
        } finally {
            setLoadingOrder(false)
        }
    }

    const handleLineChange = (index: number, field: string, value: string) => {
        const newLines = [...lines]
        newLines[index][field] = parseFloat(value) || 0
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
        if (amountNet <= 0) {
            toast.error("El monto total de la nota debe ser mayor a 0")
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('note_type', noteType)
            formData.append('document_number', documentNumber)
            formData.append('amount_net', amountNet.toString())
            formData.append('amount_tax', amountTax.toString())

            const returnItems = lines
                .filter(l => l.note_quantity > 0)
                .map(l => ({
                    product_id: l.product,
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
        } catch (error: any) {
            console.error("Error registering note:", error)
            toast.error(error.response?.data?.error || "Error al registrar la nota")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="lg">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileBadge className="h-6 w-6 text-purple-600" />
                        Registrar Nota Crédito/Débito - {orderNumber ? `NV-${orderNumber}` : `Doc #${invoiceId}`}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-6">
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
                                        <td colSpan={5} className="py-4 text-center text-muted-foreground italic">No se encontraron productos en la orden</td>
                                    </tr>
                                ) : lines.map((line, idx) => (
                                    <tr key={line.id} className={line.note_quantity > 0 ? "bg-purple-50/30" : ""}>
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
                        <div className="flex-1 space-y-2">
                            <Label className={FORM_STYLES.label}>Adjuntar Documento (Opcional)</Label>
                            <Input
                                type="file"
                                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                                className={cn(FORM_STYLES.input, "cursor-pointer h-10")}
                            />
                            {attachment && (
                                <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> {attachment.name}
                                </div>
                            )}
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
                        <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded border border-blue-100 dark:border-blue-900/30 text-[10px] text-blue-700 dark:text-blue-400">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <p>Si la nota implica devolución de productos, el sistema registrará una entrada de inventario (Stock IN) y reversará el costo de venta proporcionalmente.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !documentNumber || amountNet <= 0}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-11 px-8"
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Registro de Nota
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
