"use client"

import { useState, useEffect, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { FileText, Receipt, FileCheck, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { useServerDate } from "@/hooks/useServerDate"
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
import { ReceiptData, CheckoutLine, PartialReceiptLine } from "../../types"
import { Warehouse, UoM } from "@/types/entities"

interface Step4_ReceiptProps {
    receiptData: ReceiptData
    setReceiptData: (data: ReceiptData | ((prev: ReceiptData) => ReceiptData)) => void
    orderLines?: CheckoutLine[]
}

// New UoMSelector component
const UoMSelector = ({ line, currentUom, onUomChange, uoms }: { line: CheckoutLine, currentUom: number | string | undefined, onUomChange: (uomId: number) => void, uoms: UoM[] }) => {
    const getFilteredUoMs = (line: CheckoutLine) => {
        if (!line || !uoms.length) return []
        const productUomId = line.uom?.toString()
        if (!productUomId) return []

        const baseUom = uoms.find(u => u.id.toString() === productUomId)
        if (!baseUom) return []

        return uoms.filter(u => u.category === baseUom.category)
    }

    return (
        <Select
            value={currentUom?.toString()}
            onValueChange={(val) => onUomChange(parseInt(val))}
        >
            <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Unidad" />
            </SelectTrigger>
            <SelectContent>
                {getFilteredUoMs(line).map((uom: UoM) => (
                    <SelectItem key={uom.id} value={uom.id.toString()}>
                        {uom.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export function Step4_Receipt({ receiptData, setReceiptData, orderLines = [] }: Step4_ReceiptProps) {
    const [uoms, setUoMs] = useState<UoM[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [uomsRes, warehousesRes] = await Promise.all([
                    api.get('/inventory/uoms/'),
                    api.get('/inventory/warehouses/')
                ])
                setUoMs(uomsRes.data.results || uomsRes.data)
                setWarehouses(warehousesRes.data.results || warehousesRes.data)
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
    const hasServices = orderLines.some(line => ['SERVICE', 'SUBSCRIPTION'].includes(line.product_type))
    const allServices = orderLines.every(line => ['SERVICE', 'SUBSCRIPTION'].includes(line.product_type))
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
                    productName: line.name,
                    orderedQty: line.quantity || line.qty,
                    receivedQty: line.quantity || line.qty,
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
                    const productId = line.product || line.id
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
                    lineId, 
                    productId, 
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
                    lineId, 
                    productId, 
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

            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <Label className="text-xs font-bold uppercase text-muted-foreground mb-3 block flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Tipo de {receiptLabel}
                </Label>
                <RadioGroup
                    value={receiptData.type}
                    onValueChange={(val) => setReceiptData({ ...receiptData, type: val })}
                    className="space-y-3"
                >
                    {receiptTypes.map((type) => (
                        <div key={type.id} className="relative">
                            <Label
                                htmlFor={`receipt-${type.id}`}
                                className={`flex items-start gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all ${receiptData.type === type.id ? 'border-primary bg-primary/5' : ''
                                    }`}
                            >
                                <RadioGroupItem value={type.id} id={`receipt-${type.id}`} className="mt-1" />
                                <div className={`p-2 rounded-lg bg-background border ${type.color}`}>
                                    <type.icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <span className="text-sm font-semibold block">{type.label}</span>
                                    <span className="text-xs text-muted-foreground">{type.description}</span>
                                </div>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {receiptData.type === 'PARTIAL' && orderLines.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-sm font-semibold">Cantidades a Recibir</Label>
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
                                    const pendingQty = line.quantity || line.qty;
                                    const currentPartial = (receiptData.partialQuantities || []).find((pq: any) => (line.id && pq.lineId === line.id) || (line.product && pq.productId === line.product));
                                    const currentReceivedQty = currentPartial?.receivedQty ?? 0;
                                    const currentUom = currentPartial?.uom || line.uom;

                                    return (
                                        <TableRow key={line.id || idx}>
                                            <TableCell className="font-medium">{line.product_name || line.name || line.description}</TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {pendingQty.toLocaleString('es-CL')}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max={pendingQty}
                                                    value={currentReceivedQty}
                                                    onChange={(e) => updatePartialQty(line.id, line.product, e.target.value)}
                                                    className="w-full"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <UoMSelector
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

            {hasSubscriptions && receiptData.type !== 'DEFERRED' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-sm font-semibold">Fechas de Inicio de Suscripciones</Label>
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
                                    const productId = line.product || line.id
                                    const currentDate = receiptData.subscriptionDates?.[productId] || dateString || ''

                                    return (
                                        <TableRow key={productId || idx}>
                                            <TableCell className="font-medium">{line.product_name || line.name || line.description}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="date"
                                                    value={currentDate}
                                                    onChange={(e) => updateSubscriptionDate(productId, e.target.value)}
                                                    className="w-full"
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

            {receiptData.type !== 'DEFERRED' && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed animate-in fade-in">
                    <div className="space-y-2">
                        <Label htmlFor="delivery-ref" className="text-xs font-bold uppercase">
                            Referencia de Entrega (Opcional)
                        </Label>
                        <Input
                            id="delivery-ref"
                            type="text"
                            placeholder="Ej: Guía de despacho #123"
                            value={receiptData.deliveryReference || ''}
                            onChange={(e) => setReceiptData({ ...receiptData, deliveryReference: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="receipt-notes" className="text-xs font-bold uppercase">
                            Notas de Recepción (Opcional)
                        </Label>
                        <textarea
                            id="receipt-notes"
                            placeholder="Observaciones sobre la recepción..."
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={receiptData.notes || ''}
                            onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
                        />
                    </div>
                </div>
            )}

            {receiptData.type === 'DEFERRED' && (
                <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg text-warning dark:text-warning/50">
                    <div className="p-2 rounded-lg bg-background border border-warning/20">
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
