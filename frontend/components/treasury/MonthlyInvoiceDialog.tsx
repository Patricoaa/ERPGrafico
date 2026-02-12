"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { useServerDate } from "@/hooks/useServerDate"

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Generar Factura Mensual</DialogTitle>
                    <DialogDescription>
                        Ingrese los datos de la factura mensual del proveedor para agrupar las liquidaciones.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Proveedor (Terminal)</Label>
                        <Select value={supplierId} onValueChange={setSupplierId}>
                            <SelectTrigger>
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
                            <Label>Mes</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger>
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
                            <Label>Año</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger>
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
                        <div className="grid gap-2">
                            <Label>N° de Factura <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="Ej: 84729"
                                value={number}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNumber(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Fecha de Emisión <span className="text-destructive">*</span></Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Adjuntar Factura (PDF) <span className="text-destructive">*</span></Label>
                            <Input
                                type="file"
                                accept="application/pdf,image/*"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttachment(e.target.files?.[0] || null)}
                                className="cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generar y Finalizar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
