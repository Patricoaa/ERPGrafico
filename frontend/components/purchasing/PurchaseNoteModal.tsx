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

interface PurchaseNoteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    orderNumber: string
    onSuccess?: () => void
}

export function PurchaseNoteModal({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    onSuccess
}: PurchaseNoteModalProps) {
    const [noteType, setNoteType] = useState("NOTA_CREDITO")
    const [documentNumber, setDocumentNumber] = useState("")
    const [amountNet, setAmountNet] = useState("")
    const [amountTax, setAmountTax] = useState("")
    const [attachment, setAttachment] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const total = (parseFloat(amountNet) || 0) + (parseFloat(amountTax) || 0)

    useEffect(() => {
        if (open) {
            setDocumentNumber("")
            setAmountNet("")
            setAmountTax("")
            setAttachment(null)
        }
    }, [open])

    const handleNetChange = (val: string) => {
        setAmountNet(val)
        const net = parseFloat(val) || 0
        setAmountTax(Math.round(net * 0.19).toString()) // Default 19% tax
    }

    const handleSubmit = async () => {
        if (!documentNumber || !amountNet) {
            toast.error("El número de documento y el monto neto son obligatorios")
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('note_type', noteType)
            formData.append('document_number', documentNumber)
            formData.append('amount_net', amountNet)
            formData.append('amount_tax', amountTax)
            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            await api.post(`/purchasing/orders/${orderId}/register_note/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileBadge className="h-6 w-6 text-amber-500" />
                        Registrar Nota Crédito/Débito - OC-{orderNumber}
                    </DialogTitle>
                    <DialogDescription>
                        Esta acción afectará la contabilidad y el saldo pendiente de la orden.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase text-muted-foreground">Tipo de Nota</Label>
                            <Select value={noteType} onValueChange={setNoteType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NOTA_CREDITO">Nota de Crédito (Descuento/Devolución)</SelectItem>
                                    <SelectItem value="NOTA_DEBITO">Nota de Débito (Cargo Adicional)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="doc_num" className="text-[11px] font-bold uppercase text-muted-foreground">N° de Folio / Documento</Label>
                            <Input
                                id="doc_num"
                                placeholder="Ej: 99823"
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase">Monto Neto</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={amountNet}
                                        onChange={(e) => handleNetChange(e.target.value)}
                                        className="pl-7 font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase">IVA (19%)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={amountTax}
                                        onChange={(e) => setAmountTax(e.target.value)}
                                        className="pl-7 font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t font-black">
                            <span className="text-sm">TOTAL AFECTADO:</span>
                            <span className="text-2xl text-primary">${total.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase text-muted-foreground">Adjuntar Documento (Opcional)</Label>
                        <Input
                            type="file"
                            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                            className="cursor-pointer text-xs"
                        />
                        {attachment && (
                            <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {attachment.name}
                            </div>
                        )}
                    </div>

                    {noteType === 'NOTA_CREDITO' && (
                        <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded border border-blue-100 dark:border-blue-900/30 text-[10px] text-blue-700 dark:text-blue-400">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <p>Si la nota implica devolución física de mercadería, el sistema registrará una salida de inventario automática (Stock OUT).</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !documentNumber || !amountNet}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Registro de Nota
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
