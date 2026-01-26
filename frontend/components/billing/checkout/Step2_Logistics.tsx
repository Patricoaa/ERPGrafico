"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Truck, Package, Calendar, Info, AlertTriangle, ShoppingBag, Warehouse } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

function UoMSelector({ line, currentUom, onUomChange }: { line: any, currentUom: any, onUomChange: (uomId: number) => void }) {
    const [allowedUoms, setAllowedUoms] = useState<any[]>([])

    useEffect(() => {
        const fetchAllowed = async () => {
            try {
                const res = await api.get(`/inventory/uoms/allowed/?product_id=${line.product_id || line.product}&context=sale`)
                setAllowedUoms(res.data)
            } catch (err) {
                console.error("Error fetching allowed UoMs", err)
            }
        }
        fetchAllowed()
    }, [line.id, line.product_id])

    if (allowedUoms.length <= 1) return <span className="text-xs text-muted-foreground">{line.uom_name}</span>

    return (
        <Select value={currentUom?.toString()} onValueChange={(val) => onUomChange(parseInt(val))}>
            <SelectTrigger className="h-7 text-[10px] w-24">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {allowedUoms.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()} className="text-[10px]">
                        {u.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

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

    // Check for "Advanced Manufacturable" products - ONLY block for Debit Notes
    const advancedManufacturableItems = selectedItems.filter(item =>
        item.product_type === 'MANUFACTURABLE' && item.requires_advanced_manufacturing === true
    );
    const hasRestrictedItems = !isCreditNote && advancedManufacturableItems.length > 0;

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
            // toast.error("Error al cargar almacenes")
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

    // If restricted items exist and type is IMMEDIATE, switch to SCHEDULED automatically
    if (hasRestrictedItems && formData.delivery_type === 'IMMEDIATE') {
        setTimeout(() => {
            setData({ ...formData, delivery_type: 'SCHEDULED' });
        }, 0);
    }

    const moveTypeLabel = isCreditNote ? "Entrada de Stock" : "Salida de Stock"

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    Opciones de Logística
                </h3>
                <p className="text-sm text-muted-foreground">
                    Configure cómo se procesará el movimiento de inventario.
                </p>

                {hasRestrictedItems && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 mt-2">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider tabular-nums leading-none">Producción Requerida</p>
                            <p className="text-xs font-medium">Hay {advancedManufacturableItems.length} productos que requieren fabricación avanzada. El despacho inmediato está deshabilitado para estos ítems.</p>
                        </div>
                    </div>
                )}

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
                    className="grid gap-3 mt-4"
                >
                    <Label
                        htmlFor="del-immediate"
                        className={cn(
                            "flex items-center gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                            formData.delivery_type === 'IMMEDIATE' && "border-primary bg-primary/5",
                            hasRestrictedItems && "opacity-50 pointer-events-none grayscale"
                        )}
                    >
                        <RadioGroupItem value="IMMEDIATE" id="del-immediate" className="sr-only" disabled={hasRestrictedItems} />
                        <div className={`p-2 rounded-lg bg-background border ${formData.delivery_type === 'IMMEDIATE' ? 'text-primary' : 'text-muted-foreground'}`}>
                            <Package className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold block">Movimiento Inmediato</span>
                            <span className="text-[10px] text-muted-foreground">Rebajar/Aumentar stock ahora mismo.</span>
                        </div>
                    </Label>

                    <Label
                        htmlFor="del-scheduled"
                        className={cn(
                            "flex items-center gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                            formData.delivery_type === 'SCHEDULED' && "border-primary bg-primary/5"
                        )}
                    >
                        <RadioGroupItem value="SCHEDULED" id="del-scheduled" className="sr-only" />
                        <div className={`p-2 rounded-lg bg-background border ${formData.delivery_type === 'SCHEDULED' ? 'text-primary' : 'text-muted-foreground'}`}>
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold block">Programar Movimiento</span>
                            <span className="text-[10px] text-muted-foreground">Registrar para una fecha futura.</span>
                        </div>
                    </Label>

                    <Label
                        htmlFor="del-partial"
                        className={cn(
                            "flex items-center gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                            formData.delivery_type === 'PARTIAL' && "border-primary bg-primary/5"
                        )}
                    >
                        <RadioGroupItem value="PARTIAL" id="del-partial" className="sr-only" />
                        <div className={`p-2 rounded-lg bg-background border ${formData.delivery_type === 'PARTIAL' ? 'text-primary' : 'text-muted-foreground'}`}>
                            <Truck className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold block">Carga Parcial</span>
                            <span className="text-[10px] text-muted-foreground">Procesar solo algunos ítems ahora.</span>
                        </div>
                    </Label>
                </RadioGroup>
            </div>

            <div className="space-y-4 animate-in fade-in duration-300">
                {formData.delivery_type === 'PARTIAL' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col gap-1">
                            <Label className="text-sm font-semibold">Cantidades para Movimiento Inmediato</Label>
                            <p className="text-xs text-muted-foreground">
                                Especifique las cantidades que procesará ahora.
                            </p>
                        </div>
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[45%] text-[10px] font-bold uppercase tracking-wider">Producto</TableHead>
                                        <TableHead className="w-[15%] text-right text-[10px] font-bold uppercase tracking-wider">Total</TableHead>
                                        <TableHead className="w-[20%] text-[10px] font-bold uppercase tracking-wider">A Procesar</TableHead>
                                        <TableHead className="w-[20%] text-[10px] font-bold uppercase tracking-wider">Unidad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItems.map((item) => {
                                        const isEligible = item.creates_stock_move ||
                                            item.product_type === 'MANUFACTURABLE' ||
                                            item.has_bom;
                                        const currentVal = (formData.line_data || [])
                                            .find((ld: any) => ld.line_id === item.line_id)?.quantity ?? 0;

                                        return (
                                            <TableRow key={item.line_id} className={cn(!isEligible && "bg-muted/30 opacity-70")}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 py-1">
                                                        <span className="font-medium text-xs leading-tight">{item.product_name}</span>
                                                        {!isEligible && (
                                                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter">Sin control de stock</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-xs tabular-nums">
                                                    {item.quantity.toLocaleString('es-CL')}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
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
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground font-medium">
                                                    <UoMSelector
                                                        line={item}
                                                        currentUom={(formData.line_data || []).find((ld: any) => ld.line_id === item.line_id)?.uom_id || item.uom_id}
                                                        onUomChange={(uomId) => {
                                                            const lines = [...(formData.line_data || [])];
                                                            const idx = lines.findIndex((ld: any) => ld.line_id === item.line_id);
                                                            if (idx >= 0) {
                                                                lines[idx] = { ...lines[idx], uom_id: uomId };
                                                            } else {
                                                                lines.push({ line_id: item.line_id, product_id: item.product_id, quantity: 1, uom_id: uomId });
                                                            }
                                                            setData({ ...formData, line_data: lines });
                                                        }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {(formData.delivery_type === 'PARTIAL' || formData.delivery_type === 'SCHEDULED') && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                            <Label htmlFor="del-date" className="text-xs font-bold uppercase flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                {formData.delivery_type === 'PARTIAL' ? 'Fecha para el Resto' : 'Fecha de Operación'}
                            </Label>
                            <Input
                                id="del-date"
                                type="date"
                                className="h-10 text-sm font-medium"
                                value={formData.date || ""}
                                onChange={(e) => setData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="del-notes" className="text-xs font-bold uppercase">Notas / Observaciones</Label>
                    <Textarea
                        id="del-notes"
                        placeholder="Indicaciones especiales para el movimiento de inventario..."
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setData({ ...formData, notes: e.target.value })}
                    />
                </div>


            </div>
        </div>
    )
}
