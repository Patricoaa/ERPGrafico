"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Truck, Warehouse, Calendar, FileText } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Step2_LogisticsProps {
    isCreditNote: boolean
    data: any
    setData: (data: any) => void
}

export function Step2_Logistics({
    isCreditNote,
    data,
    setData
}: Step2_LogisticsProps) {
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [fetchingWarehouses, setFetchingWarehouses] = useState(true)

    // Initialize data if null
    useEffect(() => {
        if (!data) {
            setData({
                warehouse_id: "",
                date: new Date().toISOString().split('T')[0],
                notes: ""
            })
        }
    }, [])

    useEffect(() => {
        fetchWarehouses()
    }, [])

    const fetchWarehouses = async () => {
        try {
            setFetchingWarehouses(true)
            const res = await api.get('/inventory/warehouses/')
            const list = res.data.results || res.data
            setWarehouses(Array.isArray(list) ? list : [])

            if (Array.isArray(list) && list.length > 0 && (!data || !data.warehouse_id)) {
                // Pre-select first warehouse if none selected
                setData({
                    ...(data || { date: new Date().toISOString().split('T')[0], notes: "" }),
                    warehouse_id: list[0].id.toString()
                })
            }
        } catch (err) {
            console.error("Error fetching warehouses", err)
            toast.error("Error al cargar almacenes")
        } finally {
            setFetchingWarehouses(false)
        }
    }

    // Safe access to data fields
    const formData = data || {
        warehouse_id: "",
        date: new Date().toISOString().split('T')[0],
        notes: ""
    }

    const moveTypeLabel = isCreditNote ? "Entrada de Stock" : "Salida de Stock"

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Truck className="h-7 w-7 text-primary" />
                    Gestión Logística
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                    Configure el movimiento de inventario para los productos seleccionados.
                </p>
            </div>

            <Card className="border-2 rounded-2xl shadow-sm border-muted/20 overflow-hidden bg-card">
                <div className={cn(
                    "p-4 px-6 flex items-center justify-between border-b-2",
                    isCreditNote ? "bg-emerald-500/5 text-emerald-700 border-emerald-500/10" : "bg-rose-500/5 text-rose-700 border-rose-500/10"
                )}>
                    <div className="flex items-center gap-3 font-black text-xs uppercase tracking-widest tabular-nums">
                        <Warehouse className="h-4 w-4" />
                        Movimiento: {moveTypeLabel}
                    </div>
                    <Badge variant="outline" className={cn(
                        "font-black uppercase text-[10px] tabular-nums",
                        isCreditNote ? "border-emerald-500 text-emerald-600" : "border-rose-500 text-rose-600"
                    )}>
                        {isCreditNote ? "+ INCREMENTO STOCK" : "- DISMINUCIÓN STOCK"}
                    </Badge>
                </div>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Warehouse Selection */}
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Warehouse className="h-3 w-3" />
                                Bodega de Destino / Origen
                            </Label>
                            <Select
                                value={formData.warehouse_id}
                                onValueChange={(val) => setData({ ...formData, warehouse_id: val })}
                                disabled={fetchingWarehouses}
                            >
                                <SelectTrigger className="h-14 font-bold bg-background border-2 rounded-xl transition-all focus:ring-primary hover:border-primary/50">
                                    {fetchingWarehouses ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                                    ) : (
                                        <SelectValue placeholder="Seleccione bodega..." />
                                    )}
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-2 shadow-xl">
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id.toString()} className="font-bold uppercase text-xs py-3">
                                            {w.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Selection */}
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Fecha de Registro
                            </Label>
                            <Input
                                type="date"
                                className="h-14 font-bold bg-background border-2 rounded-xl transition-all focus:ring-primary hover:border-primary/50 tabular-nums"
                                value={formData.date}
                                onChange={(e) => setData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-4 pt-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-tighter flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            Observaciones / Notas Internas
                        </Label>
                        <Input
                            placeholder="Ej: Ingreso por devolución de cliente por falla en impresión..."
                            className="h-14 font-semibold bg-background border-2 rounded-xl transition-all focus:ring-primary hover:border-primary/50"
                            value={formData.notes}
                            onChange={(e) => setData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

