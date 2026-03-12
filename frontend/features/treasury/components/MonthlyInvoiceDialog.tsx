"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BaseModal } from "@/components/shared/BaseModal"
import { Loader2, FileText } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { useServerDate } from "@/hooks/useServerDate"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface MonthlyInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MonthlyInvoiceDialog({ open, onOpenChange }: MonthlyInvoiceDialogProps) {
    const { dateString, year: serverYear, month: serverMonth } = useServerDate()

    const [loading, setLoading] = useState(false)
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [supplierId, setSupplierId] = useState<string>("")
    const [month, setMonth] = useState<string>("")
    const [year, setYear] = useState<string>("")
    const [number, setNumber] = useState("")
    const [date, setDate] = useState("")
    const [attachment, setAttachment] = useState<File | null>(null)

    // Sync with server date
    useEffect(() => {
        if (serverYear && serverMonth && dateString) {
            if (!year) setYear(serverYear.toString())
            if (!month) setMonth(serverMonth.toString())
            if (!date) setDate(dateString)
        }
    }, [serverYear, serverMonth, dateString])

    useEffect(() => {
        if (open) {
            // Load suppliers (providers)
            api.get("/contacts/?is_supplier=true&has_terminal_payment_method=true").then(res => {
                setSuppliers(res.data)
            }).catch(() => toast.error("Error al cargar proveedores"))
        }
    }, [open])

    const handleSubmit = async () => {
        if (!supplierId) {
            toast.error("Seleccione un proveedor")
            return
        }

        if (!number) {
            toast.error("El número de factura es obligatorio")
            return
        }

        if (!attachment) {
            toast.error("Debe adjuntar el documento de la factura")
            return
        }

        setLoading(true)
        try {
            const formData = new FormData()
            formData.append('supplier_id', supplierId)
            formData.append('month', month)
            formData.append('year', year)
            formData.append('number', number)
            formData.append('date', date)
            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            await api.post('/treasury/terminal-batches/generate_invoice/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            toast.success("Factura generada exitosamente")
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.response?.data?.error || "Error al generar factura")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <span>Generar Factura Mensual</span>
                </div>
            }
            description="Ingrese los datos de la factura mensual del proveedor para agrupar las liquidaciones."
            footer={(
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generar y Finalizar
                    </Button>
                </div>
            )}
        >
            <div className="grid gap-4 py-4 px-1">
                <div className="grid gap-2">
                    <Label className={FORM_STYLES.label}>Proveedor (Terminal)</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger className={FORM_STYLES.input}>
                            <SelectValue placeholder="Seleccione proveedor..." />
                        </SelectTrigger>
                        <SelectContent>
                            {suppliers.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label className={FORM_STYLES.label}>Mes</Label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className={FORM_STYLES.input}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <SelectItem key={m} value={m.toString()}>
                                        {new Date(2000, m - 1, 1).toLocaleString('es-ES', { month: 'long' })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label className={FORM_STYLES.label}>Año</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className={FORM_STYLES.input}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026].map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className={FORM_STYLES.label}>N° de Factura <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="Ej: 84729"
                                value={number}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNumber(e.target.value)}
                                className={FORM_STYLES.input}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label className={FORM_STYLES.label}>Fecha de Emisión <span className="text-destructive">*</span></Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                                className={FORM_STYLES.input}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className={FORM_STYLES.label}>Adjuntar Factura (PDF) <span className="text-destructive">*</span></Label>
                        <Input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttachment(e.target.files?.[0] || null)}
                            className={cn("cursor-pointer", FORM_STYLES.input)}
                        />
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}

export default MonthlyInvoiceDialog
