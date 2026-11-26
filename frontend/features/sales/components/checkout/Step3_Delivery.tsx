"use client"

import { PeriodValidationDateInput, ChoiceCard, ChoiceGroup, Banner, fadeInClass } from "@/components/shared"
import {Truck, Package, Calendar} from "lucide-react"
import { useAllowedUoMsByProduct } from "@/features/inventory"
import { EditableCollection, editableSchema, eligibilityOf, toEditableErrors, type EditableRowValue } from "@/components/entity-view"
import { deliveryCheckoutEditable, productIdOf, type DeliveryCheckoutRow } from "../../entity-view/checkoutDelivery.entity"

import { type CheckoutDeliveryData, type SaleOrderLine } from "../../types"
import { cn } from "@/lib/utils"

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

    // Physical-only items for the table (exclude services in mixed mode)
    const physicalLines = isMixedMode
        ? orderLines.filter(line => line.product_type !== 'SERVICE')
        : orderLines

    if (isServiceMode) {
        return (
            <div className="space-y-6">
                <Banner tone="info" icon={Calendar} title="Cumplimiento de Servicios" live="none">
                    Esta orden contiene solo servicios. Seleccione la fecha compromiso de cumplimiento.
                </Banner>

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
            <ChoiceGroup label="Tipo de entrega" columns="grid-cols-1 sm:grid-cols-3">
                <ChoiceCard
                    selected={deliveryData.type === 'IMMEDIATE'}
                    onSelect={() => setDeliveryData((prev: CheckoutDeliveryData) => ({ ...prev, type: 'IMMEDIATE' }))}
                    icon={Package}
                    title={isMixedMode ? "Despacho y Cumplimiento Inmediato" : "Despacho Inmediato"}
                    description={hasRestrictedItems ? "No disponible: hay productos que requieren fabricación." : "Rebajar stock y entregar ahora mismo."}
                    disabled={hasRestrictedItems}
                />
                <ChoiceCard
                    selected={deliveryData.type === 'SCHEDULED'}
                    onSelect={() => setDeliveryData((prev: CheckoutDeliveryData) => ({ ...prev, type: 'SCHEDULED' }))}
                    icon={Calendar}
                    title={isMixedMode ? "Programar Entrega y Cumplimiento" : "Programar Entrega"}
                    description="Reservar para fecha futura."
                />
                <ChoiceCard
                    selected={deliveryData.type === 'PARTIAL'}
                    onSelect={() => setDeliveryData((prev: CheckoutDeliveryData) => ({ ...prev, type: 'PARTIAL' }))}
                    icon={Truck}
                    title="Despacho Parcial"
                    description="Entregar disponibles hoy."
                />
            </ChoiceGroup>

            {deliveryData.type === 'PARTIAL' && (
                <div className={cn("space-y-4", fadeInClass({ from: "top" }))}>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold">Cantidades para Despacho Inmediato</p>
                        <p className="text-xs text-muted-foreground">
                            Especifique las cantidades que entregará ahora. El resto quedará programado.
                            {isMixedMode && " Los servicios se cumplen en su totalidad según la fecha."}
                        </p>
                    </div>
                    <PartialDeliveryLines lines={physicalLines} deliveryData={deliveryData} setDeliveryData={setDeliveryData} />
                </div>
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
                <Banner tone="destructive">
                    Hay {strictManufacturableItems.length} productos que requieren fabricación. El despacho inmediato está deshabilitado para estos ítems.
                </Banner>
            )}

            {isMixedMode && (
                <Banner tone="info">
                    Los servicios se cumplen según la fecha programada. Solo los productos físicos aparecen en el detalle de despacho.
                </Banner>
            )}

        </div>
    )
}

type PartialQuantity = NonNullable<CheckoutDeliveryData["partialQuantities"]>[number]

/**
 * Partial delivery: quantity and unit per physical line (EditableCollection, ADR-0087), with the
 * numpad in touch mode. The checkout keeps `partialQuantities`; this maps it to and from the value.
 */
function PartialDeliveryLines({ lines, deliveryData, setDeliveryData }: {
    lines: SaleOrderLine[]
    deliveryData: CheckoutDeliveryData
    setDeliveryData: Step3_DeliveryProps["setDeliveryData"]
}) {
    const uoms = useAllowedUoMsByProduct(lines.flatMap((l) => {
        const id = productIdOf(l)
        return id === undefined ? [] : [id]
    }), "sale")
    const rows: DeliveryCheckoutRow[] = lines.map((line, idx) => {
        const productId = productIdOf(line)
        const allowed = productId === undefined ? [] : uoms.get(String(productId)) ?? []
        return {
            ...line,
            key: line.id !== undefined ? `l${line.id}` : `p${productId ?? idx}`,
            uomOptions: allowed.length > 0
                ? allowed.map((u) => ({ value: String(u.id), label: u.name }))
                : [{ value: String(line.uom), label: line.uom_name || String(line.uom) }],
        }
    })
    const partials = deliveryData.partialQuantities || []
    const partialOf = (row: DeliveryCheckoutRow): PartialQuantity | undefined => {
        const productId = productIdOf(row)
        return partials.find((pq) => (row.id && pq.lineId === row.id) || (productId && pq.productId === productId))
    }

    const value: EditableRowValue[] = rows.map((row) => {
        const pq = partialOf(row)
        return { key: row.key, values: { dispatch: pq?.dispatchedQty ?? 0 }, textValues: { uom: String(pq?.uom ?? row.uom) } }
    })
    const parsed = editableSchema(deliveryCheckoutEditable, rows).safeParse(value)
    const errors = parsed.success ? {} : toEditableErrors(parsed.error, value)

    const handleChange = (next: EditableRowValue[]) => {
        const byKey = new Map(rows.map((r) => [r.key, r]))
        setDeliveryData((prev: CheckoutDeliveryData) => ({
            ...prev,
            partialQuantities: next.flatMap((v) => {
                const row = byKey.get(v.key)
                if (!row || !eligibilityOf(deliveryCheckoutEditable, row).ok) return []
                const uom = v.textValues?.uom
                return [{
                    lineId: row.id ?? 0,
                    productId: productIdOf(row) ?? 0,
                    dispatchedQty: v.values.dispatch ?? 0,
                    uom: uom ? Number(uom) : row.uom,
                }]
            }),
        }))
    }

    return (
        <EditableCollection
            definition={deliveryCheckoutEditable}
            rows={rows}
            value={value}
            onChange={handleChange}
            errors={errors}
            label="Cantidades para despacho inmediato"
            numpad
        />
    )
}

