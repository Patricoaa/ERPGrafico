"use client"

import { useEffect } from "react"
import {LabeledInput, LabeledContainer, PeriodValidationDateInput, QuantityDisplay, ChoiceCard, ChoiceGroup, StepHeader, Banner} from "@/components/shared"
import { Truck, Package, Calendar, ShoppingBag } from "lucide-react"
import { useAllowedUoMs } from "@/features/inventory"
import { cn } from "@/lib/utils"
import type { NoteLineItem, NoteLogisticsData, NoteLogisticsLineData } from "../../types"
import { useServerDate } from "@/hooks/useServerDate"
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

function UoMSelector({ line, currentUom, onUomChange }: { line: NoteLineItem, currentUom?: number, onUomChange: (uomId: number) => void }) {
    const { data: allowedUoms = [] } = useAllowedUoMs(Number(line.productId), 'sale')

    if (allowedUoms.length <= 1) return <span className="text-xs text-muted-foreground">{line.uomName}</span>

    return (
        <Select value={currentUom?.toString()} onValueChange={(val) => onUomChange(parseInt(val))}>
            <SelectTrigger className="h-control-xs text-3xs w-24">
                <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
                {allowedUoms.map((u: { id: number, name: string }) => (
                    <SelectItem key={u.id} value={u.id.toString()} className="text-3xs">
                        {u.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

/** Línea que requiere fabricación y no se auto-finaliza: no admite despacho inmediato en ND. */
const isRestrictedLine = (item: NoteLineItem, isCreditNote: boolean): boolean =>
    !isCreditNote && (item.productType === 'MANUFACTURABLE' || Boolean(item.hasBom)) && !item.mfgAutoFinalize

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

            <div className="space-y-4 animate-in fade-in duration-300">
                {formData.delivery_type === 'PARTIAL' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <LabeledContainer
                            label="Cantidades para Movimiento Inmediato"
                            tooltip="Especifique las cantidades que procesará ahora. El resto quedará pendiente para despacho futuro."
                        >
                            <div className="w-full overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[45%] text-3xs font-bold uppercase text-muted-foreground">Producto</TableHead>
                                        <TableHead className="w-[15%] text-right text-3xs font-bold uppercase text-muted-foreground">Total</TableHead>
                                        <TableHead className="w-[20%] text-3xs font-bold uppercase text-muted-foreground">A Procesar</TableHead>
                                        <TableHead className="w-[20%] text-3xs font-bold uppercase text-muted-foreground">Unidad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItems.map((item) => {
                                        const lineId = item.lineId
                                        const productId = item.productId
                                        const uomId = item.uomId
                                        const itemQty = item.noteQuantity ?? 0
                                        const isRestricted = isRestrictedLine(item, isCreditNote)
                                        const isEligible = (Boolean(item.createsStockMove) ||
                                            item.productType === 'MANUFACTURABLE' ||
                                            Boolean(item.hasBom)) && !isRestricted
                                        const lineEntry = formData.line_data.find((ld) => ld.line_id === lineId)
                                        const currentVal = lineEntry?.quantity ?? 0

                                        return (
                                            <TableRow key={lineId} className={cn(!isEligible && "bg-muted/30 opacity-70")}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 py-1">
                                                        <span className="font-medium text-xs leading-tight">{item.productName}</span>
                                                        {!isEligible && (
                                                            <span className="text-3xs text-warning-text font-bold uppercase tracking-tighter">
                                                                {isRestricted ? "Requiere Producción" : "Sin control de stock"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-xs tabular-nums">
                                                    <QuantityDisplay value={itemQty} decimals={2} inline />
                                                </TableCell>
                                                <TableCell>
                                                    <LabeledInput
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max={itemQty}
                                                        value={currentVal}
                                                        disabled={!isEligible}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const lines = [...formData.line_data];
                                                            const idx = lines.findIndex((ld) => ld.line_id === lineId);
                                                            if (idx >= 0) {
                                                                lines[idx] = { ...lines[idx], quantity: val };
                                                            } else {
                                                                lines.push({ line_id: lineId, product_id: productId, quantity: val, uom_id: uomId });
                                                            }
                                                            setData({ ...formData, line_data: lines });
                                                        }}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground font-medium">
                                                    <UoMSelector
                                                        line={item}
                                                        currentUom={lineEntry?.uom_id ?? uomId}
                                                        onUomChange={(uomIdVal) => {
                                                            const lines = [...formData.line_data];
                                                            const idx = lines.findIndex((ld) => ld.line_id === lineId);
                                                            if (idx >= 0) {
                                                                lines[idx] = { ...lines[idx], uom_id: uomIdVal };
                                                            } else {
                                                                lines.push({ line_id: lineId, product_id: productId, quantity: 1, uom_id: uomIdVal });
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
