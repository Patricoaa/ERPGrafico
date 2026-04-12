"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Tag, Package, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step1_ItemsProps {
    originalInvoice: any
    selectedItems: any[]
    setSelectedItems: (items: any[]) => void
    isCreditNote: boolean
}

export function Step1_Items({
    originalInvoice,
    selectedItems,
    setSelectedItems,
    isCreditNote
}: Step1_ItemsProps) {
    const lines = originalInvoice?.lines || []
    const isExempt = originalInvoice?.dte_type === 'FACTURA_EXENTA' || originalInvoice?.dte_type === 'BOLETA_EXENTA';


    const toggleItem = (lineId: number) => {
        const line = lines.find((l: any) => l.id === lineId)
        if (!line) return

        const exists = selectedItems.find(i => i.line_id === lineId)

        if (exists) {
            setSelectedItems(selectedItems.filter(i => i.line_id !== lineId))
        } else {
            setSelectedItems([
                ...selectedItems,
                {
                    line_id: lineId,
                    product_id: line.product,
                    product_name: line.product_name,
                    product_type: line.product_type,
                    track_inventory: line.track_inventory,
                    has_bom: line.has_bom,
                    requires_advanced_manufacturing: line.requires_advanced_manufacturing,
                    mfg_auto_finalize: line.mfg_auto_finalize,
                    creates_stock_move: line.track_inventory && (line.product_type !== 'MANUFACTURABLE' || line.requires_advanced_manufacturing === false),
                    quantity: line.quantity_delivered || line.quantity,
                    uom_name: line.uom_name,
                    uom_id: line.uom,
                    unit_price: line.unit_price || line.unit_cost || 0,
                    unit_price_gross: line.unit_price_gross || line.unit_price || line.unit_cost || 0,
                    tax_rate: line.tax_rate ?? (originalInvoice?.dte_type === 'FACTURA_EXENTA' || originalInvoice?.dte_type === 'BOLETA_EXENTA' ? 0 : 19),
                    tax_amount: (line.unit_price || line.unit_cost || 0) * ((line.tax_rate ?? (originalInvoice?.dte_type === 'FACTURA_EXENTA' || originalInvoice?.dte_type === 'BOLETA_EXENTA' ? 0 : 19)) / 100),
                    reason: ""

                }
            ])
        }
    }

    const updateItem = (lineId: number, field: string, value: any) => {
        setSelectedItems(selectedItems.map(item => {
            if (item.line_id === lineId) {
                const updated = { ...item, [field]: value }
                if (field === 'unit_price') {
                    const rate = parseFloat(updated.tax_rate ?? 0) / 100
                    updated.tax_amount = value * rate
                }
                return updated
            }
            return item
        }))

    }

    // Helper to check if row is selected
    const isSelected = (lineId: number) => selectedItems.some(i => i.line_id === lineId)
    const getItem = (lineId: number) => selectedItems.find(lineItem => lineItem.line_id === lineId)

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <h3 className="font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    Selección de Productos
                </h3>
                <p className="text-sm text-muted-foreground">
                    Seleccione los ítems de la factura original que desea corregir.
                </p>
            </div>

            <div className="rounded-md border flex-1 overflow-auto min-h-[400px]">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-14 text-center">
                                <Tag className="h-4 w-4 mx-auto text-muted-foreground" />
                            </TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Producto/Servicio</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest text-muted-foreground">Original</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest text-muted-foreground">Entregado</TableHead>
                            <TableHead className="w-28 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Cant. Corregir</TableHead>
                            <TableHead className="w-32 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">Precio</TableHead>
                            <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Motivo / Razón</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lines.map((line: any) => {
                            const selected = isSelected(line.id)
                            const itemData = getItem(line.id)

                            const isPurchase = !!originalInvoice?.purchase_order || originalInvoice?.dte_type === 'PURCHASE_INV';

                            const maxQty = isCreditNote
                                ? Math.floor(line.quantity_delivered || line.quantity)
                                : (isPurchase
                                    ? 999999
                                    : (line.product_type === 'STORABLE'
                                        ? Math.floor(line.available_stock || 0)
                                        : (line.product_type === 'MANUFACTURABLE' && line.mfg_auto_finalize ? Math.floor(line.manufacturable_quantity || 0) : 999999)));

                            const showMaxBadge = (isCreditNote ||
                                (line.product_type === 'STORABLE') ||
                                (line.product_type === 'MANUFACTURABLE' && line.mfg_auto_finalize)) && !(isPurchase && !isCreditNote);


                            return (
                                <TableRow key={line.id} className={cn(
                                    "transition-colors h-20",
                                    selected ? "bg-primary/[0.02]" : "hover:bg-muted/5"
                                )}>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={selected}
                                            onCheckedChange={() => toggleItem(line.id)}
                                            className="h-6 w-6 rounded-lg border-2 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-sm tracking-tight text-foreground leading-tight">
                                                {line.product_name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[9px] h-4 font-black uppercase tracking-tighter opacity-70">
                                                    {line.product_code || line.product}
                                                </Badge>
                                                {line.product_type === 'MANUFACTURABLE' && (
                                                    <Badge className="bg-warning/10 text-warning hover:bg-warning/10 border-none text-[8px] py-0 h-4 font-black uppercase tracking-tighter">
                                                        Fab
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-xs tabular-nums text-muted-foreground/60">
                                        <div className="flex flex-col">
                                            <span>{Math.floor(line.quantity)}</span>
                                            <span className="text-[10px] font-medium opacity-70">{line.uom_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-xs tabular-nums text-success px-3">
                                        <div className="flex flex-col">
                                            <span>{Math.floor(line.quantity_delivered || 0)}</span>
                                            <span className="text-[10px] font-bold text-success/60 uppercase">{line.uom_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4">
                                        <div className="relative group max-w-[100px] mx-auto">
                                            <Input
                                                type="number"
                                                step="1"
                                                disabled={!selected}
                                                value={itemData?.quantity ?? ""}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value;
                                                    if (rawValue === "") {
                                                        updateItem(line.id, 'quantity', "");
                                                        return;
                                                    }
                                                    let val = parseInt(rawValue) || 0;
                                                    if (val > maxQty) val = maxQty;
                                                    updateItem(line.id, 'quantity', val);
                                                }}
                                                className={cn(
                                                    "h-10 text-center font-bold transition-all",
                                                    !selected && "opacity-50"
                                                )}
                                                max={maxQty}
                                                min={1}
                                            />
                                            {selected && showMaxBadge && (
                                                <div className="absolute -top-3 -right-3">
                                                    <Badge className={cn(
                                                        "h-5 min-w-5 flex items-center justify-center text-[8px] font-black border-2 border-background shadow-sm",
                                                        isCreditNote ? "bg-primary" : "bg-warning"
                                                    )}>
                                                        MAX {maxQty}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4">
                                        <div className="max-w-[120px] mx-auto flex flex-col items-center gap-1">
                                            <div className="relative w-full">
                                                <Input
                                                    type="number"
                                                    disabled={!selected || isCreditNote}
                                                    value={itemData?.unit_price ?? ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                                                        updateItem(line.id, 'unit_price', val);
                                                    }}
                                                    className={cn(
                                                        "h-10 text-center font-bold transition-all tabular-nums",
                                                        (!selected || isCreditNote) && "opacity-50"
                                                    )}
                                                    min={0}
                                                />
                                            </div>
                                            {isExempt && (
                                                <span className="text-[9px] font-black text-success uppercase tracking-tighter bg-success/10 px-1 py-0.5 rounded border border-success/10">
                                                    Exento
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <Input
                                            placeholder="Indique motivo..."
                                            disabled={!selected}
                                            value={itemData?.reason || ""}
                                            onChange={(e) => updateItem(line.id, 'reason', e.target.value)}
                                            className={cn(
                                                "h-10 text-xs font-medium placeholder:italic transition-all",
                                                !selected && "opacity-50"
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}


