"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Truck, Warehouse, Calendar, FileText, ArrowDownLeft, ArrowUpRight } from "lucide-react"
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
        fetchWarehouses()
    }, [])

    const fetchWarehouses = async () => {
        try {
            setFetchingWarehouses(true)
            const res = await api.get('/inventory/warehouses/')
            const list = res.data.results || res.data
            setWarehouses(Array.isArray(list) ? list : [])

            if (Array.isArray(list) && list.length > 0 && (!data || !data.warehouse_id)) {
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

    const formData = data || {
        warehouse_id: "",
        date: new Date().toISOString().split('T')[0],
        notes: ""
    }

    const moveTypeLabel = isCreditNote ? "Entrada de Stock" : "Salida de Stock"

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" />
                    Gestión Logística
                </h3>
                <p className="text-sm text-muted-foreground">
                    Configure el movimiento de inventario para los productos seleccionados.
                </p>
            </div>

            <Card className="border-2 rounded-3xl shadow-sm border-muted/20 overflow-hidden bg-card">
                <div className={cn(
                    "p-5 px-8 flex items-center justify-between border-b-2",
                    isCreditNote ? "bg-emerald-500/5 text-emerald-700 border-emerald-500/10" : "bg-rose-500/5 text-rose-700 border-rose-500/10"
                )}>
                    <div className="flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] tabular-nums leading-none">
                        {isCreditNote ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        Movimiento: {moveTypeLabel}
                    </div>
                    <Badge variant="outline" className={cn(
                        "font-black uppercase text-[9px] px-3 py-1 tracking-widest tabular-nums border-2",
                        isCreditNote ? "border-emerald-500/30 text-emerald-600 bg-emerald-50" : "border-rose-500/30 text-rose-600 bg-rose-50"
                    )}>
                        {isCreditNote ? "+ INCREMENTO STOCK" : "- DISMINUCIÓN STOCK"}
                    </Badge>
                </div>
                <CardContent className="p-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Warehouse Selection */}
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Warehouse className="h-3 w-3" />
                                Bodega de Destino / Origen
                            </Label>
                            <div className="relative">
                                <select
                                    className="flex h-16 w-full rounded-2xl border-2 bg-background px-4 py-2 font-black text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary/50 disabled:opacity-50 appearance-none"
                                    value={formData.warehouse_id}
                                    onChange={(e) => setData({ ...formData, warehouse_id: e.target.value })}
                                    disabled={fetchingWarehouses}
                                >
                                    <option value="" className="font-bold">Seleccione bodega...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id.toString()} className="font-bold uppercase text-xs">
                                            {w.name}
                                        </option>
                                    ))}
                                </select>
                                {fetchingWarehouses && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Date Selection */}
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Fecha de Registro
                            </Label>
                            <Input
                                type="date"
                                className="h-16 font-black text-lg bg-background border-2 rounded-2xl transition-all focus:ring-primary/20 hover:border-primary/50 tabular-nums uppercase"
                                value={formData.date}
                                onChange={(e) => setData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-4 pt-4 border-t-2 border-dashed">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            Observaciones / Notas Internas
                        </Label>
                        <Input
                            placeholder="Ej: Ingreso por devolución de cliente por falla en impresión..."
                            className="h-16 font-bold bg-background border-2 rounded-2xl transition-all focus:ring-primary/20 hover:border-primary/50 placeholder:italic placeholder:font-medium text-lg px-6"
                            value={formData.notes}
                            onChange={(e) => setData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}


