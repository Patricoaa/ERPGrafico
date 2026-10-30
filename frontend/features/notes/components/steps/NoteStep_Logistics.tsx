"use client"

import { useEffect } from "react"
import {LabeledInput, LabeledContainer, PeriodValidationDateInput, QuantityDisplay, ChoiceCard, ChoiceGroup, StepHeader} from "@/components/shared"
import { Truck, Package, Calendar, AlertTriangle, ShoppingBag } from "lucide-react"
import { useAllowedUoMs } from "@/features/inventory"
import { cn } from "@/lib/utils"
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

function UoMSelector({ line: l, currentUom, onUomChange }: { line: Record<string, unknown>, currentUom: number, onUomChange: (uomId: number) => void }) {
    const productId = l.productId ?? l.product_id;
    const uomName = l.uomName ?? l.uom_name;

    const { data: allowedUoms = [] } = useAllowedUoMs(
        (productId as number) || (l.product as number),
        'sale',
    )

    if (allowedUoms.length <= 1) return <span className="text-xs text-muted-foreground">{uomName as string}</span>

    return (
        <Select value={currentUom?.toString()} onValueChange={(val) => onUomChange(parseInt(val))}>
            <SelectTrigger className="h-7 text-3xs w-24">
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

interface NoteStepLogisticsProps {
    isCreditNote: boolean
    data: Record<string, unknown>
    setData: (data: Record<string, unknown>) => void
    selectedItems: Record<string, unknown>[]
}

export function NoteStep_Logistics({
    isCreditNote,
    data,
    setData,
    selectedItems
}: NoteStepLogisticsProps) {
    const { dateString } = useServerDate()

    // Check for "Manufacturable" products (Simple or Advanced) - ONLY block for Debit Notes
    const restrictedItems = selectedItems.filter(item => {
        const pType = item.productType ?? item.product_type;
        const hasBom = item.hasBom ?? item.has_bom;
        const auto = item.mfgAutoFinalize ?? item.mfg_auto_finalize;
        return (pType === 'MANUFACTURABLE' || hasBom) && !auto;
    });
    const hasRestrictedItems = !isCreditNote && restrictedItems.length > 0;

    // Initialize data if null or missing fields
    useEffect(() => {
        if (!data || !data.delivery_type) {
            const initialType = hasRestrictedItems ? 'SCHEDULED' : 'IMMEDIATE';
            setData({
                warehouse_id: data?.warehouse_id || "",
                date: data?.date || dateString || "",
                delivery_type: initialType,
                line_data: [],
                notes: data?.notes || ""
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once per step mount
    }, [])

    const formData = (data || {
        warehouse_id: "",
        date: dateString || "",
        delivery_type: hasRestrictedItems ? 'SCHEDULED' : 'IMMEDIATE',
        line_data: [] as Record<string, unknown>[],
        notes: ""
    }) as unknown as {
        warehouse_id: string
        date: string
        delivery_type: string
        line_data: Record<string, unknown>[]
        notes: string
    }

    // Sync date when server date arrives if not already set
    useEffect(() => {
        if (dateString && !formData.date) {
            requestAnimationFrame(() => setData({ ...formData, date: dateString }))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the server date arrives
    }, [dateString])

    // If restricted items exist and type is IMMEDIATE, switch to SCHEDULED automatically
    if (hasRestrictedItems && formData.delivery_type === 'IMMEDIATE') {
        setTimeout(() => {
            setData({ ...formData, delivery_type: 'SCHEDULED' });
        }, 0);
    }

    return (
        <div className="space-y-6">
            <StepHeader title="Opciones de Logística" description="Configure cómo se procesará el movimiento de inventario." icon={ShoppingBag} />

            {hasRestrictedItems && (
                    <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive mt-2">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider tabular-nums leading-none">Producción Requerida</p>
                            <p className="text-xs font-medium">Hay {restrictedItems.length} productos que requieren fabricación. El despacho inmediato está deshabilitado para estos ítems.</p>
                        </div>
                    </div>
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
                            const initialLineData = selectedItems
                                .filter(item => {
                                    const pType = item.productType ?? item.product_type;
                                    const hasBom = item.hasBom ?? item.has_bom;
                                    const auto = item.mfgAutoFinalize ?? item.mfg_auto_finalize;
                                    const createsStockMove = item.createsStockMove ?? item.creates_stock_move;
                                    const isRestricted = !isCreditNote &&
                                        (pType === 'MANUFACTURABLE' || hasBom) &&
                                        !auto;
                                    return createsStockMove && !isRestricted;
                                })
                                .map(item => ({
                                    line_id: item.lineId ?? item.line_id,
                                    product_id: item.productId ?? item.product_id,
                                    quantity: item.noteQuantity ?? item.quantity,
                                    uom_id: item.uomId ?? item.uom_id
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
                                    {selectedItems.map((i: Record<string, unknown>) => {
                                        const item = i as unknown as { lineId?: number, line_id?: number; productId?: number, product_id?: number; productName?: string, product_name?: string; noteQuantity?: number; quantity?: number; uomId?: number, uom_id?: number; productType?: string, product_type?: string; hasBom?: boolean, has_bom?: boolean; mfgAutoFinalize?: boolean, mfg_auto_finalize?: boolean; createsStockMove?: boolean, creates_stock_move?: boolean };
                                        
                                        const lineId = (item.lineId ?? item.line_id) as number;
                                        const productId = (item.productId ?? item.product_id) as number;
                                        const productName = (item.productName ?? item.product_name) as string;
                                        const uomId = (item.uomId ?? item.uom_id) as number;
                                        const productType = (item.productType ?? item.product_type) as string;
                                        const hasBom = (item.hasBom ?? item.has_bom) as boolean;
                                        const mfgAutoFinalize = (item.mfgAutoFinalize ?? item.mfg_auto_finalize) as boolean;
                                        const createsStockMove = (item.createsStockMove ?? item.creates_stock_move) as boolean;

                                        const itemQty = (item.noteQuantity ?? item.quantity ?? 0) as number;
                                        const isRestricted = !isCreditNote &&
                                            (productType === 'MANUFACTURABLE' || hasBom) &&
                                            !mfgAutoFinalize;

                                        const isEligible = (createsStockMove ||
                                            productType === 'MANUFACTURABLE' ||
                                            hasBom) && !isRestricted;

                                        const currentVal = ((formData.line_data || []) as Record<string, unknown>[])
                                            .find((ld: Record<string, unknown>) => (ld.line_id as number) === lineId)?.quantity as number ?? 0;

                                        return (
                                            <TableRow key={lineId} className={cn(!isEligible && "bg-muted/30 opacity-70")}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 py-1">
                                                        <span className="font-medium text-xs leading-tight">{productName}</span>
                                                        {!isEligible && (
                                                            <span className="text-3xs text-warning font-bold uppercase tracking-tighter">
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
                                                            const lineData = (formData.line_data || []) as Record<string, unknown>[];
                                                            const lines = [...lineData];
                                                            const idx = lines.findIndex((ld: Record<string, unknown>) => (ld.line_id as number) === lineId);
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
                                                        line={i}
                                                        currentUom={((formData.line_data as Record<string, unknown>[]) || []).find((ld: Record<string, unknown>) => (ld.line_id as number) === lineId)?.uom_id as number || uomId}
                                                        onUomChange={(uomIdVal) => {
                                                            const lineData = (formData.line_data || []) as Record<string, unknown>[];
                                                            const lines = [...lineData];
                                                            const idx = lines.findIndex((ld: Record<string, unknown>) => (ld.line_id as number) === lineId);
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
