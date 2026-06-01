"use client"

import { useState } from "react"
import { FormSection, LabeledInput, PeriodValidationDateInput } from "@/components/shared"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {Truck, Package, Calendar, Info, AlertTriangle} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAllowedUoMs } from "@/features/inventory/hooks/useUoMs"
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
import { NumpadModal } from "@/features/pos/components/NumpadModal"
import { useTouchMode } from "@/hooks/useTouchMode"

import { CheckoutDeliveryData, SaleOrderLine } from "../../types"

function UoMSelector({ line, currentUom, onUomChange }: { line: SaleOrderLine, currentUom: string | number | null, onUomChange: (uomId: number) => void }) {
    const prodId = line.product && typeof line.product === 'object' ? line.product.id : line.product
    const { data: allowedUoms = [] } = useAllowedUoMs((prodId ?? line.id) ?? null, 'sale')

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

interface Step3_DeliveryProps {
    deliveryData: CheckoutDeliveryData
    setDeliveryData: (data: CheckoutDeliveryData | ((prev: CheckoutDeliveryData) => CheckoutDeliveryData)) => void
    orderLines: SaleOrderLine[]
}

export function Step3_Delivery({ deliveryData, setDeliveryData, orderLines }: Step3_DeliveryProps) {
    const isOnlyService = orderLines.every(line => line.product_type === 'SERVICE')
    const hasPhysical = orderLines.some(line => line.product_type !== 'SERVICE')

    // Determine mode
    const isServiceMode = isOnlyService
    const isMixedMode = !isOnlyService && hasPhysical && orderLines.some(line => line.product_type === 'SERVICE')
    const isPhysicalMode = !isOnlyService && !orderLines.some(line => line.product_type === 'SERVICE')

    // Physical-only items for the table (exclude services in mixed mode)
    const physicalLines = isMixedMode
        ? orderLines.filter(line => line.product_type !== 'SERVICE')
        : orderLines

    const { isTouchMode } = useTouchMode()
    const [numpadOpen, setNumpadOpen] = useState(false)
    const [numpadTarget, setNumpadTarget] = useState<{ lineId: number, productId: number, uom: string | number, pendingQty: number } | null>(null)
    const [numpadValue, setNumpadValue] = useState("0")

    if (isServiceMode) {
        return (
            <div className="space-y-6">
                <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <Calendar className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider">Cumplimiento de Servicios</p>
                        <p className="text-xs text-muted-foreground">
                            Esta orden contiene solo servicios. Seleccione la fecha compromiso de cumplimiento.
                        </p>
                    </div>
                </div>

                <PeriodValidationDateInput
                    date={deliveryData.date ? new Date(deliveryData.date + 'T12:00:00') : undefined}
                    onDateChange={(d) => {
                        if (!d) {
                            setDeliveryData({ ...deliveryData, date: "" })
                            return
                        }
                        setDeliveryData({ ...deliveryData, date: d.toISOString().split('T')[0] })
                    }}
                    label="Fecha de Cumplimiento"
                    validationType="accounting"
                />
            </div>
        )
    }

    // For mixed/physical modes, compute manufacturing restrictions
    const strictManufacturableItems = orderLines.filter(line => {
        const isManufacturable = line.product_type === 'MANUFACTURABLE' || line.has_bom;
        if (!isManufacturable) return false;
        if (line.mfg_auto_finalize) return false;

        const isSimple = !line.requires_advanced_manufacturing;
        const lineQty = line.qty || line.quantity || 0;
        const totalAvailability = (line.qty_available || 0) + (line.manufacturable_quantity || 0);
        const hasAvailability = totalAvailability >= lineQty;

        if (isSimple && hasAvailability) return false;

        return true;
    });

    const hasRestrictedItems = strictManufacturableItems.length > 0;

    if (hasRestrictedItems && deliveryData.type === 'IMMEDIATE') {
        setTimeout(() => {
            setDeliveryData({ ...deliveryData, type: 'SCHEDULED' });
        }, 0);
    }

    return (
        <div className="space-y-6">
            <RadioGroup
                value={deliveryData.type}
                onValueChange={(val) => setDeliveryData((prev: CheckoutDeliveryData) => ({ ...prev, type: val as any }))}
                className="grid grid-cols-3 gap-3"
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
                    <div className={cn(
                        "p-2 rounded-lg bg-background border transition-colors",
                        deliveryData.type === 'IMMEDIATE' ? 'text-primary border-primary/30' : 'text-muted-foreground'
                    )}>
                        <Package className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm font-bold block">{isMixedMode ? "Despacho y Cumplimiento Inmediato" : "Despacho Inmediato"}</span>
                        <span className="text-[10px] text-muted-foreground">Rebajar stock y entregar ahora mismo.</span>
                    </div>
                </Label>

                <Label
                    htmlFor="del-scheduled"
                    className={cn(
                        "flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                        deliveryData.type === 'SCHEDULED' && "border-primary bg-primary/5"
                    )}
                >
                    <RadioGroupItem value="SCHEDULED" id="del-scheduled" className="sr-only" />
                    <div className={cn(
                        "p-2 rounded-lg bg-background border transition-colors",
                        deliveryData.type === 'SCHEDULED' ? 'text-primary border-primary/30' : 'text-muted-foreground'
                    )}>
                        <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm font-bold block leading-tight">
                            {isMixedMode ? "Programar Entrega y Cumplimiento" : "Programar Entrega"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Reservar para fecha futura.</span>
                    </div>
                </Label>

                <Label
                    htmlFor="del-partial"
                    className={cn(
                        "flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent cursor-pointer transition-all",
                        deliveryData.type === 'PARTIAL' && "border-primary bg-primary/5"
                    )}
                >
                    <RadioGroupItem value="PARTIAL" id="del-partial" className="sr-only" />
                    <div className={cn(
                        "p-2 rounded-lg bg-background border transition-colors",
                        deliveryData.type === 'PARTIAL' ? 'text-primary border-primary/30' : 'text-muted-foreground'
                    )}>
                        <Truck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm font-bold block leading-tight">Despacho Parcial</span>
                        <span className="text-[10px] text-muted-foreground">Entregar disponibles hoy.</span>
                    </div>
                </Label>
            </RadioGroup>

            {deliveryData.type === 'PARTIAL' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold">Cantidades para Despacho Inmediato</p>
                        <p className="text-xs text-muted-foreground">
                            Especifique las cantidades que entregará ahora. El resto quedará programado.
                            {isMixedMode && " Los servicios se cumplen en su totalidad según la fecha."}
                        </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded-md border">
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
                                {physicalLines.map((line, idx) => {
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
                                                    <div className="flex flex-col py-1">
                                                        <span className="font-medium text-xs leading-tight">{line.product_name || line.description}</span>
                                                        {!isEligible && (
                                                            <span className="text-[10px] text-warning font-bold uppercase tracking-tighter mt-0.5">Requiere Producción</span>
                                                        )}
                                                    </div>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {pendingQty.toLocaleString('es-CL')}
                                            </TableCell>
                                            <TableCell>
                                                <LabeledInput
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max={pendingQty}
                                                    value={currentVal}
                                                    disabled={!isEligible}
                                                    readOnly={isTouchMode}
                                                    onClick={() => {
                                                        if (isTouchMode && isEligible) {
                                                            setNumpadTarget({ lineId: Number(line.id), productId: Number(line.product), uom: line.uom!, pendingQty })
                                                            setNumpadValue(currentVal.toString())
                                                            setNumpadOpen(true)
                                                        }
                                                    }}
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
                                                    className="h-8 text-center"
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
                <FormSection title="Fecha" icon={Calendar} />
            )}

            {(deliveryData.type === 'SCHEDULED' || deliveryData.type === 'PARTIAL') && (
                <PeriodValidationDateInput
                    date={deliveryData.date ? new Date(deliveryData.date + 'T12:00:00') : undefined}
                    onDateChange={(d) => {
                        if (!d) {
                            setDeliveryData({ ...deliveryData, date: "" })
                            return
                        }
                        setDeliveryData({ ...deliveryData, date: d.toISOString().split('T')[0] })
                    }}
                    label={deliveryData.type === 'PARTIAL' ? 'Fecha para el Resto' : 'Fecha Estimada'}
                    validationType="accounting"
                />
            )}

            {hasRestrictedItems && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive [&>svg]:text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium">Hay {strictManufacturableItems.length} productos que requieren fabricación. El despacho inmediato está deshabilitado para estos ítems.</p>
                </div>
            )}

            {isMixedMode && (
                <div className="flex items-start gap-3 p-4 bg-info/10 border border-info/30 rounded-lg text-info [&>svg]:text-info">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium">Los servicios se cumplen según la fecha programada. Solo los productos físicos aparecen en el detalle de despacho.</p>
                </div>
            )}

            {isTouchMode && numpadTarget && (
                <NumpadModal
                    open={numpadOpen}
                    onOpenChange={setNumpadOpen}
                    title="Cantidad a Despachar"
                    value={numpadValue}
                    onChange={setNumpadValue}
                    onConfirm={() => {
                        const val = parseFloat(numpadValue) || 0
                        setDeliveryData((prev: CheckoutDeliveryData) => {
                            const pqs = [...(prev.partialQuantities || [])]
                            const existingIdx = pqs.findIndex((pq) =>
                                (numpadTarget.lineId && pq.lineId === numpadTarget.lineId) ||
                                (numpadTarget.productId && pq.productId === numpadTarget.productId)
                            )
                            if (existingIdx >= 0) {
                                pqs[existingIdx] = { ...pqs[existingIdx], dispatchedQty: val }
                            } else {
                                pqs.push({ lineId: numpadTarget.lineId, productId: numpadTarget.productId, dispatchedQty: val, uom: numpadTarget.uom })
                            }
                            return { ...prev, partialQuantities: pqs }
                        })
                        setNumpadOpen(false)
                    }}
                    allowDecimal
                />
            )}
        </div>
    )
}
