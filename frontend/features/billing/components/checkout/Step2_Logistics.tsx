"use client"

import { useState, useEffect } from "react"
import { LabeledInput, LabeledContainer, PeriodValidationDateInput, RadioCard } from '@/components/shared'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Truck, Package, Calendar, AlertTriangle, ShoppingBag } from "lucide-react"
import { billingApi } from "../../api/billingApi"
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
    const [allowedUoms, setAllowedUoms] = useState<Record<string, unknown>[]>([])

    const productId = l.productId ?? l.product_id;
    const lineId = l.lineId ?? l.line_id;
    const uomName = l.uomName ?? l.uom_name;

    useEffect(() => {
        const fetchAllowed = async () => {
            try {
                const uoms = await billingApi.getAllowedUoms((productId as number) || (l.product as number), 'sale')
                setAllowedUoms(uoms)
            } catch (err) {
                console.error("Error fetching allowed UoMs", err)
            }
        }
        fetchAllowed()
    }, [lineId, productId])

    if (allowedUoms.length <= 1) return <span className="text-xs text-muted-foreground">{uomName as string}</span>

    return (
        <Select value={currentUom?.toString()} onValueChange={(val) => onUomChange(parseInt(val))}>
            <SelectTrigger className="h-7 text-[10px] w-24">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {allowedUoms.map((u: Record<string, unknown>) => (
                    <SelectItem key={u.id as number} value={(u.id as number).toString()} className="text-[10px]">
                        {u.name as string}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

interface Step2_LogisticsProps {
    isCreditNote: boolean
    data: Record<string, unknown>
    setData: (data: Record<string, unknown>) => void
    selectedItems: Record<string, unknown>[]
}

export function Step2_Logistics({
    isCreditNote,
    data,
    setData,
    selectedItems
}: Step2_LogisticsProps) {
    const { dateString } = useServerDate()
    const [, setWarehouses] = useState<Record<string, unknown>[]>([])
    const [, setFetchingWarehouses] = useState(true)

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
        let cancelled = false
        ;(async () => {
            if (!data || !data.delivery_type) {
                const initialType = hasRestrictedItems ? 'SCHEDULED' : 'IMMEDIATE';
                if (!cancelled) {
                    setData({
                        warehouse_id: data?.warehouse_id || "",
                        date: data?.date || dateString || "",
                        delivery_type: initialType,
                        line_data: [],
                        notes: data?.notes || ""
                    })
                }
            }
            try {
                const warehouses = await billingApi.getWarehouses()
                if (!cancelled) setWarehouses(warehouses)
            } catch (err) {
                if (!cancelled) console.error("Error fetching warehouses", err)
            } finally {
                if (!cancelled) setFetchingWarehouses(false)
            }
        })()
        return () => { cancelled = true }
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
    }, [dateString])

    // If restricted items exist and type is IMMEDIATE, switch to SCHEDULED automatically
    if (hasRestrictedItems && formData.delivery_type === 'IMMEDIATE') {
        setTimeout(() => {
            setData({ ...formData, delivery_type: 'SCHEDULED' });
        }, 0);
    }

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
                    <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive mt-2">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider tabular-nums leading-none">Producción Requerida</p>
                            <p className="text-xs font-medium">Hay {restrictedItems.length} productos que requieren fabricación. El despacho inmediato está deshabilitado para estos ítems.</p>
                        </div>
                    </div>
                )}
            </div>

            <LabeledContainer
                label="Opciones de Procesamiento"
                icon={<Package className="h-3 w-3" />}
            >
                <RadioGroup
                value={formData.delivery_type}
                onValueChange={(val) => {
                    if (val === 'PARTIAL') {
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
                        setData({ ...formData, delivery_type: val, line_data: initialLineData });
                    } else {
                        setData({ ...formData, delivery_type: val });
                    }
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-4"
            >
                <RadioCard
                    id="del-immediate"
                    value="IMMEDIATE"
                    label="Inmediato"
                    description="Procesar ahora"
                    disabled={hasRestrictedItems}
                />

                <RadioCard
                    id="del-scheduled"
                    value="SCHEDULED"
                    label="Programar"
                    description="Fecha futura"
                />

                <RadioCard
                    id="del-partial"
                    value="PARTIAL"
                    label="Parcial"
                    description="Procesar algunos"
                />
                </RadioGroup>
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
                                        <TableHead className="w-[45%] text-[10px] font-bold uppercase tracking-wider">Producto</TableHead>
                                        <TableHead className="w-[15%] text-right text-[10px] font-bold uppercase tracking-wider">Total</TableHead>
                                        <TableHead className="w-[20%] text-[10px] font-bold uppercase tracking-wider">A Procesar</TableHead>
                                        <TableHead className="w-[20%] text-[10px] font-bold uppercase tracking-wider">Unidad</TableHead>
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
                                                            <span className="text-[10px] text-warning font-bold uppercase tracking-tighter">
                                                                {isRestricted ? "Requiere Producción" : "Sin control de stock"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-xs tabular-nums">
                                                    {itemQty.toLocaleString('es-CL')}
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
