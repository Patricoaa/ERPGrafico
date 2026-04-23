"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BaseModal } from "@/components/shared/BaseModal"
import { SubmitButton, CancelButton } from "@/components/shared"
import { FileText, Calendar, Info, FileSpreadsheet } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { useServerDate } from "@/hooks/useServerDate"
import { FORM_STYLES } from "@/lib/styles"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DocumentAttachmentDropzone } from "@/components/shared/DocumentAttachmentDropzone"

interface MonthlyInvoiceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MonthlyInvoiceModal({ open, onOpenChange }: MonthlyInvoiceModalProps) {
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
            requestAnimationFrame(() => {
                if (!year) setYear(serverYear.toString())
                if (!month) setMonth(serverMonth.toString())
                if (!date) setDate(dateString)
            })
        }
    }, [serverYear, serverMonth, dateString])

    useEffect(() => {
        let isMounted = true
        if (open) {
            // Load suppliers (providers)
            api.get("/contacts/?is_supplier=true&has_terminal_payment_method=true").then(res => {
                if (isMounted) requestAnimationFrame(() => setSuppliers(res.data))
            }).catch(() => {
                if (isMounted) toast.error("Error al cargar proveedores")
            })
        }
        return () => { isMounted = false }
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
        } catch (error: unknown) {
            showApiError(error, "Error al generar factura")
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
                    <FileSpreadsheet className="h-5 w-5" />
                    <span className="font-bold tracking-tight">Generar Facturas de Liquidación</span>
                </div>
            }
            description={
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>Facturación Mensual</span>
                    <span className="opacity-30">|</span>
                    <span>Liquidación de Lotes</span>
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full px-6 py-4 border-t border-border/40">
                    <CancelButton onClick={() => onOpenChange(false)} className="rounded-lg text-xs font-bold border-primary/20 hover:bg-primary/5" />
                    <SubmitButton
                        loading={loading}
                        onClick={handleSubmit}
                        className="rounded-lg text-xs font-bold"
                    >
                        {loading ? "Procesando..." : "Generar y Finalizar"}
                    </SubmitButton>
                </div>
            }
        >
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 py-2">
                <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 lg:col-span-6">
                        <Label className={cn(FORM_STYLES.label, "mb-1.5")}>Proveedor (Terminal)</Label>
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

                    <div className="col-span-6 lg:col-span-3">
                        <Label className={cn(FORM_STYLES.label, "mb-1.5")}>Mes</Label>
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
                    <div className="col-span-6 lg:col-span-3">
                        <Label className={cn(FORM_STYLES.label, "mb-1.5")}>Año</Label>
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
                        <DocumentAttachmentDropzone
                            file={attachment}
                            onFileChange={setAttachment}
                            dteType="FACTURA"
                        />
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}

export default MonthlyInvoiceModal
