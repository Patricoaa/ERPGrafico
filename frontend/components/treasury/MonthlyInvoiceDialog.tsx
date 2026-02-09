"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

interface MonthlyInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MonthlyInvoiceDialog({ open, onOpenChange }: MonthlyInvoiceDialogProps) {
    const [loading, setLoading] = useState(false)
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [supplierId, setSupplierId] = useState<string>("")
    const [month, setMonth] = useState<string>(new Date().getMonth() + 1 + "")
    const [year, setYear] = useState<string>(new Date().getFullYear() + "")

    useEffect(() => {
        if (open) {
            // Load suppliers (providers)
            api.get("/contacts/?is_supplier=true").then(res => {
                setSuppliers(res.data)
            }).catch(() => toast.error("Error al cargar proveedores"))
        }
    }, [open])

    const handleSubmit = async () => {
        if (!supplierId) {
            toast.error("Seleccione un proveedor")
            return
        }

        setLoading(true)
        try {
            const res = await api.post('/treasury/terminal-batches/generate_invoice/', {
                supplier_id: supplierId,
                month: parseInt(month),
                year: parseInt(year)
            })

            toast.success("Factura generada exitosamente")
            onOpenChange(false)
            // Ideally we should redirect to the invoice or show a link

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
                        Agrupa todas las liquidaciones del mes seleccionado para un proveedor y genera una Factura de Compra borrador.
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
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generar Factura
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
