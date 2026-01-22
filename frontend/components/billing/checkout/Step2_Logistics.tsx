"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Truck, Warehouse, Calendar, ArrowRight, ArrowLeft } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"

interface Step2_LogisticsProps {
    workflow: any
    onSuccess: (updatedWorkflow: any) => void
    onSkip: () => void
}

export function Step2_Logistics({
    workflow,
    onSuccess,
    onSkip
}: Step2_LogisticsProps) {
    const [loading, setLoading] = useState(false)
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [fetchingWarehouses, setFetchingWarehouses] = useState(true)

    const [formData, setFormData] = useState({
        warehouse_id: "",
        date: new Date().toISOString().split('T')[0],
        notes: ""
    })

    useEffect(() => {
        fetchWarehouses()
    }, [])

    const fetchWarehouses = async () => {
        try {
            setFetchingWarehouses(true)
            const res = await api.get('/inventory/warehouses/')
            const data = res.data.results || res.data
            setWarehouses(Array.isArray(data) ? data : [])

            // Auto-select first warehouse if available
            if (Array.isArray(data) && data.length > 0) {
                setFormData(prev => ({ ...prev, warehouse_id: data[0].id.toString() }))
            }
        } catch (err) {
            console.error("Error fetching warehouses", err)
            toast.error("Error al cargar almacenes")
        } finally {
            setFetchingWarehouses(false)
        }
    }

    const handleSubmit = async () => {
        if (!formData.warehouse_id) {
            toast.error("Debe seleccionar una bodega.")
            return
        }

        try {
            setLoading(true)
            const res = await api.post(`/billing/note-workflows/${workflow.id}/process-logistics/`, {
                warehouse_id: parseInt(formData.warehouse_id),
                date: formData.date,
                notes: formData.notes
            })
            onSuccess(res.data)
        } catch (error: any) {
            console.error("Error processing logistics:", error)
            toast.error(error.response?.data?.error || "Error al procesar logística.")
        } finally {
            setLoading(false)
        }
    }

    const isNC = workflow.invoice.dte_type === 'NOTA_CREDITO'
    const moveTypeLabel = isNC ? "Entrada de Stock" : "Salida de Stock"

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
                <h3 className="text-xl font-black flex items-center gap-2">
                    <Truck className="h-6 w-6 text-primary" />
                    Procesamiento Logístico
                </h3>
                <p className="text-muted-foreground text-sm">
                    Configure el movimiento físico de mercancía para esta nota.
                </p>
            </div>

            <Card className="border-2 border-primary/10 shadow-lg overflow-hidden">
                <div className={cn(
                    "p-4 flex items-center justify-between",
                    isNC ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                )}>
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest">
                        <Truck className="h-4 w-4" />
                        {moveTypeLabel} (Recuperación de Stock)
                    </div>
                </div>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Warehouse Selection */}
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Warehouse className="h-3 w-3" />
                                Bodega de Destino
                            </Label>
                            <Select
                                value={formData.warehouse_id}
                                onValueChange={(val) => setFormData(p => ({ ...p, warehouse_id: val }))}
                                disabled={fetchingWarehouses}
                            >
                                <SelectTrigger className="h-12 font-bold bg-muted/20 border-2">
                                    {fetchingWarehouses ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <SelectValue placeholder="Seleccione bodega..." />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id.toString()} className="font-medium">
                                            {w.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Selection */}
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Fecha del Movimiento
                            </Label>
                            <Input
                                type="date"
                                className="h-12 font-bold bg-muted/20 border-2"
                                value={formData.date}
                                onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-3 pt-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Observaciones Logísticas</Label>
                        <Input
                            placeholder="Ej: Ingreso por devolución de cliente..."
                            className="h-12 font-medium bg-muted/20 border-2"
                            value={formData.notes}
                            onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-between items-center pt-6">
                <Button
                    variant="ghost"
                    onClick={onSkip}
                    disabled={loading}
                    className="text-muted-foreground hover:text-foreground font-bold"
                >
                    Saltar etapa logística (No recomendado)
                </Button>

                <Button
                    onClick={handleSubmit}
                    disabled={loading || !formData.warehouse_id}
                    className="group px-10 py-7 rounded-2xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-primary/20"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            Confirmar Logística
                            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ")
}
