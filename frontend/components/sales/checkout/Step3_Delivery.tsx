"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Truck, Package, Store, Calendar, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

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
                        // When switching to partial, pre-select all eligible items
                        if (val === 'PARTIAL') {
                            const eligibleIds = orderLines
                                .filter(line => !line.requires_advanced_manufacturing)
                                .map(line => line.id);
                            setDeliveryData({ ...deliveryData, type: val, immediateLines: eligibleIds });
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
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Package className="h-4 w-4 text-emerald-600" />
                            Items para Despacho Inmediato
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                            Seleccione los productos que entregará ahora. El resto quedará programado.
                        </p>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                            {orderLines.map(line => {
                                const isEligible = !line.requires_advanced_manufacturing;
                                const isSelected = (deliveryData.immediateLines || []).includes(line.id);

                                return (
                                    <div key={line.id} className={cn(
                                        "flex items-center gap-3 p-3 rounded-md border", // Increased padding
                                        isEligible ? "bg-background" : "bg-muted opacity-70",
                                        isSelected && "border-primary/50 bg-primary/5"
                                    )}>
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" // Larger checkbox
                                            checked={isSelected}
                                            disabled={!isEligible}
                                            onChange={(e) => {
                                                const current = deliveryData.immediateLines || [];
                                                if (e.target.checked) {
                                                    setDeliveryData({ ...deliveryData, immediateLines: [...current, line.id] });
                                                } else {
                                                    setDeliveryData({ ...deliveryData, immediateLines: current.filter((id: number) => id !== line.id) });
                                                }
                                            }}
                                        />
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            {/* Stronger visual hierarchy */}
                                            <p className="font-bold text-sm text-foreground truncate">{line.product_name || line.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                                <span className="font-semibold text-foreground">{line.qty || line.quantity}</span> {line.uom_name}
                                            </p>
                                        </div>
                                        {!isEligible && (
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">Producción</span>
                                        )}
                                    </div>
                                )
                            })}
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
