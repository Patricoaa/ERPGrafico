"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Truck, Package, Store, Calendar, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface Step3_DeliveryProps {
    deliveryData: any
    setDeliveryData: (data: any) => void
    orderLines: any[]
}

export function Step3_Delivery({ deliveryData, setDeliveryData, orderLines }: Step3_DeliveryProps) {
    // Basic analysis of items
    const hasFabricable = orderLines.some(line => line.product_type === 'MANUFACTURABLE' || line.has_bom);

    // Check for "Advanced Manufacturing" products that don't track inventory (MUST be produced first)
    const itemsRequiringWorkflow = orderLines.filter(line =>
        (line.product_type === 'MANUFACTURABLE' || line.has_bom) &&
        line.requires_advanced_manufacturing &&
        !line.track_inventory
    );
    const hasRestrictedItems = itemsRequiringWorkflow.length > 0;

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
                <div className="p-4 rounded-full bg-emerald-100 text-emerald-600">
                    <Info className="h-10 w-10" />
                </div>
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
            <div className="space-y-4">
                <Label className="text-sm font-semibold">Opciones de Entrega</Label>

                {hasRestrictedItems && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider">Producción Pendiente Requerida</p>
                            <p className="text-xs font-medium">Hay {itemsRequiringWorkflow.length} productos con Fabricación Avanzada. El despacho inmediato está deshabilitado porque deben ser procesados en el módulo de producción.</p>
                        </div>
                    </div>
                )}

                {hasFabricable && !hasRestrictedItems && (
                    <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 animate-pulse">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider">Productos por Fabricar</p>
                            <p className="text-xs">Esta venta incluye productos manufacturables. Se recomienda programar el despacho para permitir el tiempo de producción.</p>
                        </div>
                    </div>
                )}

                <RadioGroup
                    value={deliveryData.type}
                    onValueChange={(val) => {
                        // When switching to partial, pre-fill all eligible items with their full quantities
                        if (val === 'PARTIAL') {
                            const partialQuantities = orderLines
                                .filter(line => !line.requires_advanced_manufacturing)
                                .map(line => ({
                                    productId: line.id,
                                    dispatchedQty: line.qty || line.quantity
                                }));
                            setDeliveryData({ ...deliveryData, type: val, partialQuantities });
                        } else {
                            setDeliveryData({ ...deliveryData, type: val });
                        }
                    }}
                    className="grid gap-3"
                >
                    <Label
                        htmlFor="del-immediate"
                        className={cn(
                            "flex items-center gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
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
                        className={`flex items-center gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all ${deliveryData.type === 'SCHEDULED' ? 'border-primary bg-primary/5' : ''}`}
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
                        className={`flex items-center gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all ${deliveryData.type === 'PARTIAL' ? 'border-primary bg-primary/5' : ''}`}
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
                                        const isEligible = !line.requires_advanced_manufacturing;
                                        const pendingQty = line.qty || line.quantity;
                                        const currentVal = (deliveryData.partialQuantities || []).find((pq: any) => pq.productId === line.id)?.dispatchedQty ?? 0;

                                        return (
                                            <TableRow key={line.id} className={!isEligible ? "bg-muted/30 opacity-70" : ""}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{line.product_name || line.description}</span>
                                                        {!isEligible && (
                                                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter">Requiere Producción</span>
                                                        )}
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
                                                            const pqs = [...(deliveryData.partialQuantities || [])];
                                                            const existingIdx = pqs.findIndex((pq: any) => pq.productId === line.id);
                                                            if (existingIdx >= 0) {
                                                                pqs[existingIdx] = { ...pqs[existingIdx], dispatchedQty: val };
                                                            } else {
                                                                pqs.push({ productId: line.id, dispatchedQty: val });
                                                            }
                                                            setDeliveryData({ ...deliveryData, partialQuantities: pqs });
                                                        }}
                                                        className="h-8"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground font-medium">
                                                    {line.uom_name || line.uom}
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
