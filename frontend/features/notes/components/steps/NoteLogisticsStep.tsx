"use client"

import { useEffect, useMemo } from "react"
import { LabeledInput, LabeledContainer, PeriodValidationDateInput, ChoiceCard, ChoiceGroup, StepHeader, Banner, fadeInClass } from "@/components/shared"
import { Truck, Package, Calendar, ShoppingBag } from "lucide-react"
import { useAllowedUoMsByProduct } from "@/features/inventory"
import { cn } from "@/lib/utils"
import type { NoteLineItem, NoteLogisticsData, NoteLogisticsLineData } from "../../types"
import { useServerDate } from "@/hooks/useServerDate"
import { EditableCollection, editableSchema, eligibilityOf, toEditableErrors, type EditableRowValue } from "@/components/entity-view"
import { isRestrictedLine, noteLogisticsEditable, type NoteLogisticsRow } from "../../entity-view/noteLogistics.entity"

interface NoteLogisticsStepProps {
    isCreditNote: boolean
    data: NoteLogisticsData | null
    setData: (data: NoteLogisticsData) => void
    selectedItems: NoteLineItem[]
}

export function NoteLogisticsStep({
    isCreditNote,
    data,
    setData,
    selectedItems
}: NoteLogisticsStepProps) {
    const { dateString } = useServerDate()

    const restrictedItems = selectedItems.filter(item => isRestrictedLine(item, isCreditNote))
    const hasRestrictedItems = restrictedItems.length > 0

    const defaultData: NoteLogisticsData = {
        warehouse_id: "",
        date: dateString || "",
        delivery_type: hasRestrictedItems ? 'SCHEDULED' : 'IMMEDIATE',
        line_data: [],
        notes: "",
    }
    const formData: NoteLogisticsData = data ?? defaultData

    // Initialize data once per step mount (the wizard validates `data !== null`).
    useEffect(() => {
        if (!data) setData(defaultData)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once per step mount
    }, [])

    // Sync date when server date arrives if not already set
    useEffect(() => {
        if (dateString && !formData.date) {
            requestAnimationFrame(() => setData({ ...formData, date: dateString }))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the server date arrives
    }, [dateString])

    // If restricted items exist and type is IMMEDIATE, switch to SCHEDULED automatically
    const mustSchedule = hasRestrictedItems && formData.delivery_type === 'IMMEDIATE'
    useEffect(() => {
        if (mustSchedule) setData({ ...formData, delivery_type: 'SCHEDULED' })
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the restriction flag
    }, [mustSchedule])

    return (
        <div className="space-y-6">
            <StepHeader title="Opciones de Logística" description="Configure cómo se procesará el movimiento de inventario." icon={ShoppingBag} />

            {hasRestrictedItems && (
                <Banner tone="destructive" title="Producción requerida" className="mt-2">
                    Hay {restrictedItems.length} productos que requieren fabricación. El despacho inmediato está deshabilitado para estos ítems.
                </Banner>
            )}

            <LabeledContainer
                label="Opciones de Procesamiento"
                className="border-transparent group-focus-within:border-transparent group-focus-within:ring-0 group-focus-within:shadow-none"
            >
                <ChoiceGroup
                    label="Opciones de Procesamiento"
                    columns="grid-cols-1 md:grid-cols-3"
                    activation="select"
                >
                    <ChoiceCard
                        variant="light"
                        selected={formData.delivery_type === 'IMMEDIATE'}
                        onSelect={() => {
                            setData({ ...formData, delivery_type: 'IMMEDIATE' });
                        }}
                        title="Inmediato"
                        description="Procesar ahora"
                        icon={Package}
                        disabled={hasRestrictedItems}
                        iconClassName="text-primary"
                    />

                    <ChoiceCard
                        variant="light"
                        selected={formData.delivery_type === 'SCHEDULED'}
                        onSelect={() => {
                            setData({ ...formData, delivery_type: 'SCHEDULED' });
                        }}
                        title="Programar"
                        description="Fecha futura"
                        icon={Calendar}
                        iconClassName="text-primary"
                    />

                    <ChoiceCard
                        variant="light"
                        selected={formData.delivery_type === 'PARTIAL'}
                        onSelect={() => {
                            const initialLineData: NoteLogisticsLineData[] = selectedItems
                                .filter(item => Boolean(item.createsStockMove) && !isRestrictedLine(item, isCreditNote))
                                .map(item => ({
                                    line_id: item.lineId,
                                    product_id: item.productId,
                                    quantity: item.noteQuantity,
                                    uom_id: item.uomId,
                                }));
                            setData({ ...formData, delivery_type: 'PARTIAL', line_data: initialLineData });
                        }}
                        title="Parcial"
                        description="Procesar algunos"
                        icon={Truck}
                        iconClassName="text-primary"
                    />
                </ChoiceGroup>
            </LabeledContainer>

            <div className={cn("space-y-4", fadeInClass({ duration: 300 }))}>
                {formData.delivery_type === 'PARTIAL' && (
                    <div className={cn("space-y-4", fadeInClass({ from: "top" }))}>
                        <LabeledContainer
                            label="Cantidades para Movimiento Inmediato"
                            tooltip="Especifique las cantidades que procesará ahora. El resto quedará pendiente para despacho futuro."
                        >
                            <PartialLines
                                isCreditNote={isCreditNote}
                                items={selectedItems}
                                lineData={formData.line_data}
                                onChange={(line_data) => setData({ ...formData, line_data })}
                            />
                        </LabeledContainer>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {(formData.delivery_type === 'PARTIAL' || formData.delivery_type === 'SCHEDULED') && (
                        <PeriodValidationDateInput
                            label={formData.delivery_type === 'PARTIAL' ? 'Fecha para el Resto' : 'Fecha de Operación'}
                            date={formData.date ? new Date(formData.date + 'T12:00:00') : undefined}
                            onDateChange={(d) => {
                                if (!d) {
                                    setData({ ...formData, date: "" })
                                    return
                                }
                                setData({ ...formData, date: d.toISOString().split('T')[0] })
                            }}
                            validationType="accounting"
                        />
                    )}

                    <LabeledInput
                        label="Notas / Observaciones"
                        as="textarea"
                        placeholder="Indicaciones especiales para el movimiento de inventario..."
                        value={formData.notes}
                        onChange={(e) => setData({ ...formData, notes: e.target.value })}
                    />
                </div>
            </div>
        </div>
    )
}

/**
 * Partial logistics: how much of each line moves now, and in which unit (EditableCollection with a
 * `choice` unit, ADR-0087). The wizard keeps `line_data`; this maps it to and from the collection value.
 */
function PartialLines({ isCreditNote, items, lineData, onChange }: {
    isCreditNote: boolean
    items: NoteLineItem[]
    lineData: NoteLogisticsLineData[]
    onChange: (lineData: NoteLogisticsLineData[]) => void
}) {
    const definition = useMemo(() => noteLogisticsEditable(isCreditNote), [isCreditNote])
    const uoms = useAllowedUoMsByProduct(items.map((i) => i.productId), "sale")
    const rows: NoteLogisticsRow[] = items.map((item) => {
        const allowed = uoms.get(String(item.productId)) ?? []
        // Until the allowed units arrive (or when there is only the line's own), the line's unit is the only option.
        const own = item.uomId === undefined ? [] : [{ value: String(item.uomId), label: item.uomName ?? "UN" }]
        return { ...item, uomOptions: allowed.length > 0 ? allowed.map((u) => ({ value: String(u.id), label: u.name })) : own }
    })
    const byKey = new Map(rows.map((r) => [String(r.lineId), r]))
    const entries = new Map(lineData.map((l) => [String(l.line_id), l]))
    const ownUom = (r: NoteLogisticsRow) => (r.uomId === undefined ? "" : String(r.uomId))

    const value: EditableRowValue[] = rows.map((r) => {
        const entry = entries.get(String(r.lineId))
        return {
            key: String(r.lineId),
            values: { quantity: entry?.quantity ?? 0 },
            textValues: { uom: entry?.uom_id !== undefined ? String(entry.uom_id) : ownUom(r) },
        }
    })
    const parsed = editableSchema(definition, rows).safeParse(value)
    const errors = parsed.success ? {} : toEditableErrors(parsed.error, value)

    const handleChange = (next: EditableRowValue[]) => onChange(next.flatMap((v) => {
        const row = byKey.get(v.key)
        if (!row || !eligibilityOf(definition, row).ok) return []
        const quantity = v.values.quantity ?? 0
        const uom = v.textValues?.uom ?? ""
        // A line enters line_data once touched: a quantity, an earlier entry or a unit other than its own.
        if (quantity <= 0 && !entries.has(v.key) && uom === ownUom(row)) return []
        return [{ line_id: row.lineId, product_id: row.productId, quantity, uom_id: uom ? Number(uom) : row.uomId }]
    }))

    return (
        <EditableCollection
            definition={definition}
            rows={rows}
            value={value}
            onChange={handleChange}
            errors={errors}
            label="Cantidades para movimiento inmediato"
        />
    )
}
