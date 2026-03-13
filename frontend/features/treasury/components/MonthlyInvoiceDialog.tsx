"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BaseModal } from "@/components/shared/BaseModal"
import { FileText, Calendar, Loader2, Info, FileSpreadsheet } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { useServerDate } from "@/hooks/useServerDate"
import { FORM_STYLES } from "@/lib/styles"
import { Badge } from "@/components/ui/badge"
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
            variant="wizard"
            title={
                <div className="flex items-center gap-4">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-bold tracking-tight">Generar Facturas de Liquidación</h2>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-5 text-[10px] font-bold uppercase tracking-wider bg-muted/50 border-purple-500/20 text-purple-600/80">
                                Facturación Mensual
                            </Badge>
                            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-widest opacity-70">
                                • Liquidación de Lotes
                            </span>
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-between items-center w-full">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs font-bold border-primary/20 hover:bg-primary/5">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={cn(
                            "rounded-xl px-8 h-11 shadow-lg transition-all font-black uppercase tracking-widest text-[10px] group",
                            "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                        )}
                    >
                        {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        {loading ? "Procesando..." : "Generar y Finalizar"}
                    </Button>
                </div>
            }
        >
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 py-2">
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-6">
                        <Label className={cn(FORM_STYLES.label, "mb-2")}>Proveedor (Terminal)</Label>
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

                    <div className="col-span-6 md:col-span-3">
                        <Label className={cn(FORM_STYLES.label, "mb-2")}>Mes</Label>
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
                    <div className="col-span-6 md:col-span-3">
                        <Label className={cn(FORM_STYLES.label, "mb-2")}>Año</Label>
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

                {/* Standardized Separator */}
                <div className="flex items-center gap-2 pt-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Datos del Documento</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-6">
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
                        <div className="relative group/file">
                            <Input
                                type="file"
                                accept="application/pdf,image/*"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttachment(e.target.files?.[0] || null)}
                                className={cn(
                                    FORM_STYLES.input, 
                                    "cursor-pointer h-20 border-dashed border-2 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-center pt-8 file:hidden"
                                )}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-muted-foreground group-hover/file:text-purple-600 transition-colors">
                                <FileText className="h-5 w-5 mb-1 opacity-50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                    {attachment ? attachment.name : "Seleccionar Archivo PDF"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}

export default MonthlyInvoiceDialog
