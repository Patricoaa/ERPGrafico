"use client"

function UoMSelector({ line, currentUom, onUomChange }: { line: SaleOrderLine, currentUom: string | number | null, onUomChange: (uomId: number) => void }) {
    const [allowedUoms, setAllowedUoms] = useState<{id: number, name: string}[]>([])

    useEffect(() => {
        const fetchAllowed = async () => {
            try {
                const res = await api.get(`/inventory/uoms/allowed/?product_id=${line.product || line.id}&context=sale`)
                setAllowedUoms(res.data)
            } catch (err) {
                console.error("Error fetching allowed UoMs", err)
            }
        }
        fetchAllowed()
    }, [line.id, line.product])

    if (allowedUoms.length <= 1) return <span>{line.uom_name || line.uom}</span>

    return (
        <Select value={currentUom?.toString()} onValueChange={(val) => onUomChange(parseInt(val))}>
            <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {allowedUoms.map((u: {id: number, name: string}) => (
                    <SelectItem key={u.id} value={u.id.toString()} className="text-xs">
                        {u.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Truck, Package, Calendar, Info, AlertTriangle, ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { useState, useEffect } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { CheckoutDeliveryData, SaleOrderLine } from "../../types"

interface Step3_DeliveryProps {
    deliveryData: CheckoutDeliveryData
    setDeliveryData: (data: CheckoutDeliveryData | ((prev: CheckoutDeliveryData) => CheckoutDeliveryData)) => void
    orderLines: SaleOrderLine[]
}

export function Step3_Delivery({ deliveryData, setDeliveryData, orderLines }: Step3_DeliveryProps) {
    // Basic analysis of items
    const hasFabricable = orderLines.some(line => line.product_type === 'MANUFACTURABLE' || line.has_bom);

    // Check for "Manufacturable" products (Simple or Advanced) - they MUST be produced first
    // We restrict immediate dispatch for ALL manufacturable items as per business logic
    const itemsRequiringWorkflow = orderLines.filter(line =>
        (line.product_type === 'MANUFACTURABLE' || line.has_bom) &&
        !line.track_inventory // If it tracks inventory, maybe we allow selling stock? 
        // Re-reading requirements: "Advanced or Simple ... should be prevented from immediate dispatch"
        // Usually SIMPLE manufacturable might not track inventory? 
        // Let's stick to the plan: Restrict ALL manufacturable.
        // Actually, if track_inventory is true, it might mean we have stock. 
        // But the user said: "frente a una entrega parcial las lineas de productos que sean de fabricaicion avanzada o simple debería impedirse su despacho inmediato, ya que necesitan de su fabricación."
        // This implies even if we track it, we want to force production? Or maybe they don't track stock?
        // Let's assume if it is MANUFACTURABLE, it needs to be made.
    );
    // Actually, let's look at the original code:
    // const itemsRequiringWorkflow = orderLines.filter(line =>
    //    (line.product_type === 'MANUFACTURABLE' || line.has_bom) &&
    //    line.requires_advanced_manufacturing &&
    //    !line.track_inventory
    // );

    // Proposal: Change to catch ALL manufacturable items that are NOT service/consumable/storable-only.
    // Ideally, if it is 'MANUFACTURABLE', it goes to this list.
    const strictManufacturableItems = orderLines.filter(line => {
        const isManufacturable = line.product_type === 'MANUFACTURABLE' || line.has_bom;
        if (!isManufacturable) return false;
        if (line.mfg_auto_finalize) return false;

        // EXCEPTION: Simple manufacturable products with sufficient availability (stock + fab) can be dispatched immediately
        const isSimple = !line.requires_advanced_manufacturing;
        const lineQty = line.qty || line.quantity || 0;
        const totalAvailability = (line.qty_available || 0) + (line.manufacturable_quantity || 0);
        const hasAvailability = totalAvailability >= lineQty;

        if (isSimple && hasAvailability) return false;

        return true;
    });

    const hasRestrictedItems = strictManufacturableItems.length > 0;

    // If restricted items exist and type is IMMEDIATE, switch to SCHEDULED automatically
    if (hasRestrictedItems && deliveryData.type === 'IMMEDIATE') {
        setTimeout(() => {
            setDeliveryData({ ...deliveryData, type: 'SCHEDULED' });
        }, 0);
    }

    const isOnlyService = orderLines.every(line => line.product_type === 'SERVICE');

    if (isOnlyService) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <Info className="h-10 w-10" />
                <div className="space-y-1">
                    <h3 className="text-lg font-bold">Venta de Servicios</h3>
                    <p className="text-sm text-muted-foreground max-w-[300px]">
                        Esta orden solo contiene servicios, por lo que no requiere despacho físico.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className=" font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    Opciones de Entrega
                </h3>
                <p className="text-sm text-muted-foreground">
                    Ingrese la información relacionada al despacho.
                </p>
                <Label className="text-sm font-semibold"></Label>

                {hasRestrictedItems && (
                    <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive-foreground">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider">Producción Requerida</p>
                            <p className="text-xs font-medium">Hay {strictManufacturableItems.length} productos que requieren fabricación. El despacho inmediato está deshabilitado para estos ítems.</p>
                        </div>
                    </div>
                )}

                {/* Note: Removed the secondary orange warning as it is now redundant with the red one above covering all cases */}

                <RadioGroup
                    value={deliveryData.type}
                    onValueChange={(val) => {
                        setDeliveryData((prev: CheckoutDeliveryData) => {
                            const newType = val as "IMMEDIATE" | "SCHEDULED" | "PARTIAL";
                            if (newType === 'PARTIAL') {
                                const partialQuantities = orderLines
                                    .filter(line => {
                                        const isSimpleManufacturableWithAvailability = (line.product_type === 'MANUFACTURABLE' || line.has_bom) &&
                                            !line.requires_advanced_manufacturing &&
                                            ((line.qty_available || 0) + (line.manufacturable_quantity || 0)) >= (line.qty || line.quantity || 0);

                                        return (line.product_type !== 'MANUFACTURABLE' && !line.has_bom) ||
                                            line.mfg_auto_finalize ||
                                            isSimpleManufacturableWithAvailability;
                                    })
                                    .map(line => ({
                                        lineId: line.id!,
                                        productId: Number(line.product)!,
                                        dispatchedQty: line.qty || line.quantity || 0,
                                        uom: line.uom!
                                    }));
                                return { ...prev, type: newType, partialQuantities };
                            }
                            return { ...prev, type: newType };
                        });
                    }}
                    className="grid gap-3"
                >
                    <Label
                        htmlFor="del-immediate"
                        className={cn(
                            "flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                            deliveryData.type === 'IMMEDIATE' && "border-primary bg-primary/5",
                            hasRestrictedItems && "opacity-50 pointer-events-none grayscale"
                        )}
                    >
                        <RadioGroupItem value="IMMEDIATE" id="del-immediate" className="sr-only" disabled={hasRestrictedItems} />
                        <div className={`p-2 rounded-lg bg-background border ${deliveryData.type === 'IMMEDIATE' ? 'text-primary' : 'text-muted-foreground'}`}>
                            <Package className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold block">Despacho Inmediato</span>
                            <span className="text-[10px] text-muted-foreground">Rebajar stock y entregar ahora mismo.</span>
                        </div>
                    </Label>

                    <Label
                        htmlFor="del-scheduled"
                        className={`flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all ${deliveryData.type === 'SCHEDULED' ? 'border-primary bg-primary/5' : ''}`}
                    >
                        <RadioGroupItem value="SCHEDULED" id="del-scheduled" className="sr-only" />
                        <div className={`p-2 rounded-lg bg-background border ${deliveryData.type === 'SCHEDULED' ? 'text-primary' : 'text-muted-foreground'}`}>
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold block">Programar Entrega</span>
                            <span className="text-[10px] text-muted-foreground">Reservar para una fecha futura.</span>
                        </div>
                    </Label>

                    <Label
                        htmlFor="del-partial"
                        className={`flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all ${deliveryData.type === 'PARTIAL' ? 'border-primary bg-primary/5' : ''}`}
                    >
                        <RadioGroupItem value="PARTIAL" id="del-partial" className="sr-only" />
                        <div className={`p-2 rounded-lg bg-background border ${deliveryData.type === 'PARTIAL' ? 'text-primary' : 'text-muted-foreground'}`}>
                            <Truck className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold block">Despacho Parcial</span>
                            <span className="text-[10px] text-muted-foreground">Entregar disponibles ahora, programar el resto.</span>
                        </div>
                    </Label>
                </RadioGroup>
            </div>

            <div className="space-y-4 animate-in fade-in duration-300">
                {deliveryData.type === 'PARTIAL' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col gap-1">
                            <Label className="text-sm font-semibold">Cantidades para Despacho Inmediato</Label>
                            <p className="text-xs text-muted-foreground">
                                Especifique las cantidades que entregará ahora. El resto quedará programado.
                            </p>
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[45%]">Producto</TableHead>
                                        <TableHead className="w-[15%] text-right">Pendiente</TableHead>
                                        <TableHead className="w-[20%]">A Despachar</TableHead>
                                        <TableHead className="w-[20%]">Unidad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orderLines.map((line, idx) => {
                                        const isSimpleManufacturableWithAvailability = (line.product_type === 'MANUFACTURABLE' || line.has_bom) &&
                                            !line.requires_advanced_manufacturing &&
                                            ((line.qty_available || 0) + (line.manufacturable_quantity || 0)) >= (line.qty || line.quantity || 0);

                                        const isEligible = (line.product_type !== 'MANUFACTURABLE' && !line.has_bom) ||
                                            line.mfg_auto_finalize ||
                                            isSimpleManufacturableWithAvailability;

                                        const pendingQty = line.qty || line.quantity;
                                        const currentVal = (deliveryData.partialQuantities || []).find((pq: NonNullable<CheckoutDeliveryData["partialQuantities"]>[number]) => (line.id && pq.lineId === line.id) || (line.product && pq.productId === line.product))?.dispatchedQty ?? 0;

                                        return (
                                            <TableRow key={line.id} className={!isEligible ? "bg-muted/30 opacity-70" : ""}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 py-1">
                                                        <span className="font-medium text-xs leading-tight">{line.product_name || line.description}</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {line.internal_code && (
                                                                <span className="text-[10px] font-mono border px-1 rounded opacity-80 uppercase border-muted-foreground/20 text-muted-foreground">
                                                                    {line.internal_code}
                                                                </span>
                                                            )}
                                                            {line.code && line.code !== line.internal_code && (
                                                                <span className="text-[10px] font-mono bg-muted px-1 rounded opacity-80 uppercase text-muted-foreground">
                                                                    {line.code}
                                                                </span>
                                                            )}
                                                            {!isEligible && (
                                                                <span className="text-[10px] text-warning font-bold uppercase tracking-tighter">Requiere Producción</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {pendingQty.toLocaleString('es-CL')}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max={pendingQty}
                                                        value={currentVal}
                                                        disabled={!isEligible}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setDeliveryData((prev: CheckoutDeliveryData) => {
                                                                const pqs = [...(prev.partialQuantities || [])];
                                                                const existingIdx = pqs.findIndex((pq: NonNullable<CheckoutDeliveryData["partialQuantities"]>[number]) => (line.id && pq.lineId === line.id) || (line.product && pq.productId === line.product));
                                                                if (existingIdx >= 0) {
                                                                    pqs[existingIdx] = { ...pqs[existingIdx], dispatchedQty: val };
                                                                } else {
                                                                    pqs.push({ lineId: line.id!, productId: Number(line.product)!, dispatchedQty: val, uom: line.uom! });
                                                                }
                                                                return { ...prev, partialQuantities: pqs };
                                                            });
                                                        }}
                                                        className="h-8"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground font-medium">
                                                    <UoMSelector
                                                        line={line}
                                                        currentUom={(deliveryData.partialQuantities || []).find((pq: NonNullable<CheckoutDeliveryData["partialQuantities"]>[number]) => pq.productId === line.id)?.uom || line.uom}
                                                        onUomChange={(uomId) => {
                                                            setDeliveryData((prev: CheckoutDeliveryData) => {
                                                                const pqs = [...(prev.partialQuantities || [])];
                                                                const existingIdx = pqs.findIndex((pq: NonNullable<CheckoutDeliveryData["partialQuantities"]>[number]) => (line.id && pq.lineId === line.id) || (line.product && pq.productId === line.product));
                                                                if (existingIdx >= 0) {
                                                                    pqs[existingIdx] = { ...pqs[existingIdx], uom: uomId };
                                                                } else {
                                                                    pqs.push({ lineId: line.id!, productId: Number(line.product)!, dispatchedQty: 1, uom: uomId });
                                                                }
                                                                return { ...prev, partialQuantities: pqs };
                                                            });
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

                {(deliveryData.type === 'SCHEDULED' || deliveryData.type === 'PARTIAL') && (
                    <div className="space-y-2">
                        <Label htmlFor="del-date" className="text-xs font-bold uppercase">
                            {deliveryData.type === 'PARTIAL' ? 'Fecha para el Resto' : 'Fecha Estimada'}
                        </Label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="del-date"
                                type="date"
                                className="pl-9"
                                value={deliveryData.date || ""}
                                onChange={(e) => setDeliveryData({ ...deliveryData, date: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="del-notes" className="text-xs font-bold uppercase">Notas de Despacho / Observaciones</Label>
                    <Textarea
                        id="del-notes"
                        placeholder="Dirección, horario preferido, indicaciones especiales..."
                        rows={3}
                        value={deliveryData.notes}
                        onChange={(e) => setDeliveryData({ ...deliveryData, notes: e.target.value })}
                    />
                </div>
            </div>
        </div>
    )
}
