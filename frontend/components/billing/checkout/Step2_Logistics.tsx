"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Truck, Warehouse, Calendar, FileText, ArrowDownLeft, ArrowUpRight, AlertTriangle, Package, Info } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface Step2_LogisticsProps {
    isCreditNote: boolean
    data: any
    setData: (data: any) => void
    selectedItems: any[]
}

export function Step2_Logistics({
    isCreditNote,
    data,
    setData,
    selectedItems
}: Step2_LogisticsProps) {
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [fetchingWarehouses, setFetchingWarehouses] = useState(true)

    // Check for "Manufacturable" products or those that don't control stock
    const manufacturableItems = selectedItems.filter(item =>
        (item.product_type === 'MANUFACTURABLE' || item.has_bom) && !item.creates_stock_move
    );
    const hasRestrictedItems = manufacturableItems.length > 0;

    // Initialize data if null or missing fields
    useEffect(() => {
        if (!data || !data.delivery_type) {
            const initialType = hasRestrictedItems ? 'SCHEDULED' : 'IMMEDIATE';
            setData({
                warehouse_id: data?.warehouse_id || "",
                date: data?.date || new Date().toISOString().split('T')[0],
                delivery_type: initialType,
                line_data: [],
                notes: data?.notes || ""
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
                    ...(data || { date: new Date().toISOString().split('T')[0], notes: "", delivery_type: hasRestrictedItems ? 'SCHEDULED' : 'IMMEDIATE', line_data: [] }),
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
        delivery_type: hasRestrictedItems ? 'SCHEDULED' : 'IMMEDIATE',
        line_data: [],
        notes: ""
    }

    const moveTypeLabel = isCreditNote ? "Entrada de Stock" : "Salida de Stock"

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" />
                    Gestión Logística
                </h3>
                <p className="text-sm text-muted-foreground">
                    Configure cómo se procesará el movimiento de inventario.
                </p>
            </div>

            {hasRestrictedItems && (
                <div className="flex items-start gap-4 p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 bg-amber-100 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-wider tabular-nums leading-none mb-1">Items de Fabricación</p>
                        <p className="text-xs font-bold opacity-80 leading-relaxed">
                            Hay {manufacturableItems.length} productos que requieren fabricación o no controlan stock directo.
                            El movimiento inmediato está deshabilitado para estos ítems ya que no afectan inventario físicamente ahora.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Options Column */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                    <Card className="border-2 rounded-[2rem] shadow-sm border-muted/20 overflow-hidden bg-card">
                        <div className={cn(
                            "p-4 px-6 flex items-center justify-between border-b-2",
                            isCreditNote ? "bg-emerald-500/5 text-emerald-700 border-emerald-500/10" : "bg-rose-500/5 text-rose-700 border-rose-500/10"
                        )}>
                            <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest leading-none">
                                {isCreditNote ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                {moveTypeLabel}
                            </div>
                        </div>
                        <CardContent className="p-6 space-y-6">
                            <RadioGroup
                                value={formData.delivery_type}
                                onValueChange={(val) => {
                                    if (val === 'PARTIAL') {
                                        const initialLineData = selectedItems
                                            .filter(item => item.creates_stock_move)
                                            .map(item => ({
                                                line_id: item.line_id,
                                                product_id: item.product_id,
                                                quantity: item.quantity,
                                                uom_id: item.uom_id
                                            }));
                                        setData({ ...formData, delivery_type: val, line_data: initialLineData });
                                    } else {
                                        setData({ ...formData, delivery_type: val });
                                    }
                                }}
                                className="grid gap-3"
                            >
                                <Label
                                    htmlFor="log-immediate"
                                    className={cn(
                                        "flex items-center gap-4 rounded-2xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                                        formData.delivery_type === 'IMMEDIATE' && "border-primary bg-primary/[0.03]",
                                        hasRestrictedItems && "opacity-50 pointer-events-none grayscale"
                                    )}
                                >
                                    <RadioGroupItem value="IMMEDIATE" id="log-immediate" className="sr-only" disabled={hasRestrictedItems} />
                                    <div className={cn(
                                        "p-2 rounded-xl border-2 transition-colors",
                                        formData.delivery_type === 'IMMEDIATE' ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-muted"
                                    )}>
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-xs font-black uppercase tracking-widest block">Inmediato</span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Procesar stock ahora mismo</span>
                                    </div>
                                </Label>

                                <Label
                                    htmlFor="log-scheduled"
                                    className={cn(
                                        "flex items-center gap-4 rounded-2xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                                        formData.delivery_type === 'SCHEDULED' && "border-primary bg-primary/[0.03]"
                                    )}
                                >
                                    <RadioGroupItem value="SCHEDULED" id="log-scheduled" className="sr-only" />
                                    <div className={cn(
                                        "p-2 rounded-xl border-2 transition-colors",
                                        formData.delivery_type === 'SCHEDULED' ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-muted"
                                    )}>
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-xs font-black uppercase tracking-widest block">Programado</span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Solo registrar para fecha futura</span>
                                    </div>
                                </Label>

                                <Label
                                    htmlFor="log-partial"
                                    className={cn(
                                        "flex items-center gap-4 rounded-2xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                                        formData.delivery_type === 'PARTIAL' && "border-primary bg-primary/[0.03]"
                                    )}
                                >
                                    <RadioGroupItem value="PARTIAL" id="log-partial" className="sr-only" />
                                    <div className={cn(
                                        "p-2 rounded-xl border-2 transition-colors",
                                        formData.delivery_type === 'PARTIAL' ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-muted"
                                    )}>
                                        <Truck className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-xs font-black uppercase tracking-widest block">Carga Parcial</span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Ingresar/Retirar solo algunos ítems</span>
                                    </div>
                                </Label>
                            </RadioGroup>

                            <div className="space-y-4 pt-4 border-t-2 border-dashed">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                        <Warehouse className="h-3 w-3" />
                                        Bodega
                                    </Label>
                                    <select
                                        className="flex h-12 w-full rounded-xl border-2 bg-background px-4 py-2 font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none disabled:opacity-50"
                                        value={formData.warehouse_id}
                                        onChange={(e) => setData({ ...formData, warehouse_id: e.target.value })}
                                        disabled={fetchingWarehouses}
                                    >
                                        <option value="">Seleccione bodega...</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id.toString()}>
                                                {w.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                        <Calendar className="h-3 w-3" />
                                        Fecha
                                    </Label>
                                    <Input
                                        type="date"
                                        className="h-12 font-bold bg-background border-2 rounded-xl tabular-nums transition-all"
                                        value={formData.date}
                                        onChange={(e) => setData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Grid Column 2: Detail or Table */}
                <div className="lg:col-span-12 xl:col-span-7 space-y-6">
                    {formData.delivery_type === 'PARTIAL' ? (
                        <Card className="border-2 rounded-[2rem] shadow-sm border-muted/20 overflow-hidden bg-card flex flex-col h-full min-h-[400px]">
                            <div className="p-4 px-6 border-b-2 bg-muted/5">
                                <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-primary" />
                                    Detalle de Carga Parcial
                                </span>
                            </div>
                            <CardContent className="p-0 flex-1 overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10 border-b-2">
                                        <TableRow>
                                            <TableHead className="font-black uppercase text-[9px] tracking-widest">Producto</TableHead>
                                            <TableHead className="text-right font-black uppercase text-[9px] tracking-widest">Total</TableHead>
                                            <TableHead className="w-32 text-center font-black uppercase text-[9px] tracking-widest">A Procesar</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedItems.map((item) => {
                                            const isEligible = item.creates_stock_move;
                                            const currentVal = (formData.line_data || [])
                                                .find((ld: any) => ld.line_id === item.line_id)?.quantity ?? 0;

                                            return (
                                                <TableRow key={item.line_id} className={cn(
                                                    "h-16",
                                                    !isEligible && "bg-muted/30 opacity-60"
                                                )}>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-xs leading-tight">{item.product_name}</span>
                                                            {!isEligible && (
                                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">Sin control de stock</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-xs tabular-nums opacity-60">
                                                        {item.quantity} {item.uom_name}
                                                    </TableCell>
                                                    <TableCell className="px-4">
                                                        <Input
                                                            type="number"
                                                            step="1"
                                                            min="0"
                                                            max={item.quantity}
                                                            value={currentVal}
                                                            disabled={!isEligible}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                const lines = [...(formData.line_data || [])];
                                                                const idx = lines.findIndex((ld: any) => ld.line_id === item.line_id);
                                                                if (idx >= 0) {
                                                                    lines[idx] = { ...lines[idx], quantity: val };
                                                                } else {
                                                                    lines.push({ line_id: item.line_id, product_id: item.product_id, quantity: val, uom_id: item.uom_id });
                                                                }
                                                                setData({ ...formData, line_data: lines });
                                                            }}
                                                            className="h-9 text-center font-black text-xs border-2 rounded-xl focus:ring-primary/20"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            <Card className="border-2 rounded-[2rem] shadow-sm border-muted/20 overflow-hidden bg-card">
                                <CardContent className="p-8 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                            <FileText className="h-3 w-3" />
                                            Observaciones Logísticas
                                        </Label>
                                        <Input
                                            placeholder="Indicaciones para el transporte o recepción..."
                                            className="h-14 font-bold bg-background border-2 rounded-2xl transition-all focus:ring-primary/20"
                                            value={formData.notes}
                                            onChange={(e) => setData({ ...formData, notes: e.target.value })}
                                        />
                                    </div>
                                    <div className="p-5 bg-primary/[0.03] border-2 border-dashed border-primary/20 rounded-2xl">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-primary/10 rounded-xl">
                                                <Info className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Resumen de Operación</p>
                                                <p className="text-[11px] font-bold opacity-60 leading-tight">
                                                    {formData.delivery_type === 'IMMEDIATE'
                                                        ? `Se generará un movimiento de ${moveTypeLabel.toLowerCase()} para todos los productos de stock en la bodega seleccionada.`
                                                        : `La nota se emitirá pero el movimiento de stock quedará pendiente para ser procesado manualmente después.`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
