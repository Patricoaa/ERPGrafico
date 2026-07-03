"use client"

import {useState, useEffect} from "react"
import { LabeledInput, LabeledSelect, LabeledContainer, PeriodValidationDateInput, RadioCard } from "@/components/shared"
import { purchasingApi } from "../../api/purchasingApi"
import { useServerDate } from "@/hooks/useServerDate"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { type ReceiptData, type CheckoutLine, type PartialReceiptLine } from "../../types"
import { type Warehouse, type UoM } from "@/types/entities"
import { Package, Receipt, FileText, FileCheck } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Step4_ReceiptProps {
    receiptData: ReceiptData
    setReceiptData: (data: ReceiptData | ((prev: ReceiptData) => ReceiptData)) => void
    orderLines?: CheckoutLine[]
}

// New UoMSelector component
const LocalUoMSelector = ({ line, currentUom, onUomChange, uoms }: { line: CheckoutLine, currentUom: number | string | undefined, onUomChange: (uomId: number) => void, uoms: UoM[] }) => {
    const getFilteredUoMs = (line: CheckoutLine) => {
        if (!line || !uoms.length) return []
        const productUomId = line.uom?.toString()
        if (!productUomId) return []

        const baseUom = uoms.find(u => u.id.toString() === productUomId)
        if (!baseUom) return []

        return uoms.filter(u => u.category === baseUom.category)
    }

    return (
        <LabeledSelect
            value={currentUom?.toString()}
            onChange={(val) => onUomChange(parseInt(val))}
            options={getFilteredUoMs(line).map((uom: UoM) => ({
                value: uom.id.toString(),
                label: uom.name
            }))}
            className="w-full"
        />
    )
}

export function Step4_Receipt({ receiptData, setReceiptData, orderLines = [] }: Step4_ReceiptProps) {
    const [uoms, setUoMs] = useState<UoM[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [uomsData, warehousesData] = await Promise.all([
                    purchasingApi.getUoms(),
                    purchasingApi.getWarehouses()
                ])
                setUoMs((uomsData ?? []) as unknown as UoM[])
                setWarehouses((warehousesData ?? []) as unknown as Warehouse[])
            } catch (error) {
                console.error("Failed to fetch receipt metadata", error)
            }
        }
        fetchMetadata()
    }, [])

    // Initialize warehouse from products if not set
    useEffect(() => {
        if (!receiptData.warehouseId && orderLines.length > 0) {
            // Find most frequent warehouse or first one from products
            // For now, let's just use the first warehouse from warehouses list if none
            // or if we have it in orderLines (backend needs to return this)
            const firstProductWarehouse = orderLines.find(l => l.receiving_warehouse)?.receiving_warehouse
            if (firstProductWarehouse) {
                setReceiptData({ ...receiptData, warehouseId: firstProductWarehouse.toString() })
            } else if (warehouses.length > 0 && !receiptData.warehouseId) {
                setReceiptData({ ...receiptData, warehouseId: warehouses[0].id.toString() })
            }
        }
    }, [orderLines, warehouses, receiptData.warehouseId, setReceiptData, receiptData])

    // Detect if order contains services
    const hasServices = orderLines.some(line => line.product_type && ['SERVICE', 'SUBSCRIPTION'].includes(line.product_type))
    const allServices = orderLines.length > 0 && orderLines.every(line => line.product_type && ['SERVICE', 'SUBSCRIPTION'].includes(line.product_type))
    const hasSubscriptions = orderLines.some(line => line.product_type === 'SUBSCRIPTION')
    const receiptLabel = allServices ? 'Confirmación' : (hasServices ? 'Recepción/Confirmación' : 'Recepción')
    const itemLabel = allServices ? 'servicios' : (hasServices ? 'productos/servicios' : 'mercancía')

    const receiptTypes = [
        {
            id: 'IMMEDIATE',
            label: `${receiptLabel} Inmediata`,
            description: `Confirmar ${itemLabel} ahora`,
            icon: Receipt,
            color: 'text-success'
        },
        {
            id: 'DEFERRED',
            label: `${receiptLabel} Diferida`,
            description: `Registrar factura sin confirmar ${itemLabel}`,
            icon: FileText,
            color: 'text-warning'
        },
        {
            id: 'PARTIAL',
            label: `${receiptLabel} Parcial`,
            description: 'Confirmar cantidades específicas',
            icon: FileCheck,
            color: 'text-primary'
        }
    ]

    // Initialize partial quantities if not set
    useEffect(() => {
        if (receiptData.type === 'PARTIAL' && (!receiptData.partialQuantities || receiptData.partialQuantities.length === 0)) {
            setReceiptData({
                ...receiptData,
                partialQuantities: orderLines.map(line => ({
                    lineId: line.id,
                    productId: line.product,
                    productName: line.name || line.product_name,
                    orderedQty: line.quantity || line.qty || 0,
                    receivedQty: line.quantity || line.qty || 0,
                    uom: line.uom
                }))
            })
        }
    }, [receiptData.type, receiptData.partialQuantities?.length, orderLines, setReceiptData, receiptData])

    const { dateString } = useServerDate()

    // Initialize subscription dates if not set
    useEffect(() => {
        if (hasSubscriptions && dateString && (!receiptData.subscriptionDates || Object.keys(receiptData.subscriptionDates).length === 0)) {
            const defaultDates: Record<string, string> = {}
            orderLines.forEach(line => {
                if (line.product_type === 'SUBSCRIPTION') {
                    const productId = (line.product || line.id)?.toString()
                    if (productId) {
                        defaultDates[productId] = dateString
                    }
                }
            })
            setReceiptData({ ...receiptData, subscriptionDates: defaultDates })
        }
    }, [hasSubscriptions, orderLines, receiptData, setReceiptData, dateString])

    const updateSubscriptionDate = (productId: string, date: string) => {
        setReceiptData((prev: ReceiptData) => ({
            ...prev,
            subscriptionDates: {
                ...(prev.subscriptionDates || {}),
                [productId]: date
            }
        }))
    }

    const updatePartialQty = (lineId: number | string | undefined, productId: number | string | undefined, value: string) => {
        const qty = parseFloat(value) || 0;
        setReceiptData((prev: ReceiptData) => {
            const pqs = [...(prev.partialQuantities || [])];
            const existingIdx = pqs.findIndex((pq: PartialReceiptLine) => (lineId && pq.lineId === lineId) || (productId && pq.productId === productId));
            if (existingIdx >= 0) {
                pqs[existingIdx] = { ...pqs[existingIdx], receivedQty: qty };
            } else {
                pqs.push({ 
                    lineId: lineId || 0, 
                    productId: productId || 0, 
                    receivedQty: qty, 
                    orderedQty: orderLines.find(l => (lineId && l.id === lineId) || (productId && l.product === productId))?.quantity || 0,
                    uom: orderLines.find(l => (lineId && l.id === lineId) || (productId && l.product === productId))?.uom as number | string
                });
            }
            return { ...prev, partialQuantities: pqs };
        });
    }

    const updatePartialUom = (lineId: number | string | undefined, productId: number | string | undefined, uomId: number) => {
        setReceiptData((prev: ReceiptData) => {
            const pqs = [...(prev.partialQuantities || [])];
            const existingIdx = pqs.findIndex((pq: PartialReceiptLine) => (lineId && pq.lineId === lineId) || (productId && pq.productId === productId));
            if (existingIdx >= 0) {
                pqs[existingIdx] = { ...pqs[existingIdx], uom: uomId };
            } else {
                pqs.push({ 
                    lineId: lineId || 0, 
                    productId: productId || 0, 
                    receivedQty: 1, 
                    orderedQty: orderLines.find(l => (lineId && l.id === lineId) || (productId && l.product === productId))?.quantity || 0,
                    uom: uomId 
                });
            }
            return { ...prev, partialQuantities: pqs };
        });
    }

    return (
        <div className="space-y-6">
            {/* Removed Warehouse Selector as per requirements */}

            <LabeledContainer
                label={`Tipo de ${receiptLabel}`}
            >
                <RadioGroup
                    value={receiptData.type}
                    onValueChange={(val) => setReceiptData({ ...receiptData, type: val as ReceiptData['type'] })}
                    className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full"
                >
                    {receiptTypes.map((type) => (
                        <RadioCard
                            key={type.id}
                            id={`receipt-${type.id}`}
                            value={type.id}
                            label={type.label}
                            description={type.description}
                            icon={<type.icon className="h-4 w-4" />}
                            iconColor={type.color}
                        />
                    ))}
                </RadioGroup>
            </LabeledContainer>

            {receiptData.type === 'PARTIAL' && orderLines.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-xs font-black uppercase tracking-tighter text-primary/70">Cantidades a Recibir</h4>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40%]">Producto</TableHead>
                                    <TableHead className="w-[20%] text-right">Ordenado</TableHead>
                                    <TableHead className="w-[20%]">A Recibir</TableHead>
                                    <TableHead className="w-[20%]">Unidad</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orderLines.map((line, idx) => {
                                    const pendingQty = line.quantity || line.qty || 0;
                                    const currentPartial = (receiptData.partialQuantities || []).find((pq) => (line.id && pq.lineId === line.id) || (line.product && pq.productId === line.product));
                                    const currentReceivedQty = currentPartial?.receivedQty ?? 0;
                                    const currentUom = currentPartial?.uom || line.uom;

                                    return (
                                        <TableRow key={line.id || idx}>
                                            <TableCell className="font-medium">{line.product_name || line.name || line.description}</TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {pendingQty}
                                            </TableCell>
                                            <TableCell>
                                                <LabeledInput
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max={pendingQty}
                                                    value={currentReceivedQty}
                                                    onChange={(e) => updatePartialQty(line.id, line.product, e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <LocalUoMSelector
                                                    line={line}
                                                    currentUom={currentUom}
                                                    onUomChange={(uomId) => updatePartialUom(line.id, line.product, uomId)}
                                                    uoms={uoms}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {hasSubscriptions && (receiptData.type as string) !== 'DEFERRED' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-xs font-black uppercase tracking-tighter text-primary/70">Fechas de Inicio de Suscripciones</h4>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60%]">Suscripción</TableHead>
                                    <TableHead className="w-[40%]">Fecha de Inicio</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orderLines.filter(line => line.product_type === 'SUBSCRIPTION').map((line, idx) => {
                                    const productId = (line.product || line.id)?.toString() || idx.toString()
                                    const currentDate = receiptData.subscriptionDates?.[productId] || dateString || ''

                                    return (
                                        <TableRow key={productId || idx}>
                                            <TableCell className="font-medium">{line.product_name || line.name || line.description}</TableCell>
                                            <TableCell>
                                                <PeriodValidationDateInput
                                                    date={currentDate ? new Date(currentDate + 'T12:00:00') : undefined}
                                                    onDateChange={(d) => {
                                                        if (!d) {
                                                            updateSubscriptionDate(productId, "")
                                                            return
                                                        }
                                                        updateSubscriptionDate(productId, d.toISOString().split('T')[0])
                                                    }}
                                                    validationType="tax"
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

            {(receiptData.type as string) !== 'DEFERRED' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    <LabeledInput
                        label="Referencia de Entrega"
                        placeholder="Ej: Guía de despacho #123"
                        value={receiptData.deliveryReference || ''}
                        onChange={(e) => setReceiptData({ ...receiptData, deliveryReference: e.target.value })}
                        hint="Información opcional del transportista o documento físico"
                    />

                    <LabeledInput
                        label="Notas de Recepción"
                        as="textarea"
                        placeholder="Observaciones sobre la recepción..."
                        value={receiptData.notes || ''}
                        onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
                        hint="Detalles sobre daños, diferencias o estado general"
                    />
                </div>
            )}

            {(receiptData.type as string) === 'DEFERRED' && (
                <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-md text-warning">
                    <div className="p-2 rounded-md bg-background border border-warning/20">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider">Nota de {receiptLabel} Diferida</p>
                        <p className="text-sm">
                            {allServices
                                ? 'Los servicios no serán confirmados. Podrá registrar la confirmación más tarde desde la lista de órdenes de compra.'
                                : 'La mercancía no será recibida en inventario. Podrá registrar la recepción más tarde desde la lista de órdenes de compra.'
                            }
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
