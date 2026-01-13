"use client"

function UoMSelector({ line, currentUom, onUomChange }: { line: any, currentUom: any, onUomChange: (uomId: number) => void }) {
    const [allowedUoms, setAllowedUoms] = useState<any[]>([])

    useEffect(() => {
        const fetchAllowed = async () => {
            try {
                // Purchasing uses flexible category-based context
                const res = await api.get(`/inventory/uoms/allowed/?product_id=${line.product || line.id}&context=purchase`)
                setAllowedUoms(res.data)
            } catch (err) {
                console.error("Error fetching allowed UoMs", err)
            }
        }
        fetchAllowed()
    }, [line.id, line.product])

    if (allowedUoms.length <= 1) return <span>{line.uom_name || line.uom}</span>

    return (
        <Select value={currentUom?.toString()} onValueChange={(val) => onUomChange(parseInt(val))}>
            <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {allowedUoms.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()} className="text-xs">
                        {u.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { FileText, Receipt, FileCheck, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { useState, useEffect } from "react"
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

interface Step4_ReceiptProps {
    receiptData: any
    setReceiptData: (data: any) => void
    orderLines?: any[]
}

export function Step4_Receipt({ receiptData, setReceiptData, orderLines = [] }: Step4_ReceiptProps) {
    const receiptTypes = [
        {
            id: 'IMMEDIATE',
            label: 'Recepción Inmediata',
            description: 'Recibir toda la mercancía ahora',
            icon: Receipt,
            color: 'text-emerald-600'
        },
        {
            id: 'DEFERRED',
            label: 'Recepción Diferida',
            description: 'Registrar factura sin recibir mercancía',
            icon: FileText,
            color: 'text-amber-600'
        },
        {
            id: 'PARTIAL',
            label: 'Recepción Parcial',
            description: 'Recibir cantidades específicas',
            icon: FileCheck,
            color: 'text-blue-600'
        }
    ]

    // Initialize partial quantities if not set
    if (receiptData.type === 'PARTIAL' && (!receiptData.partialQuantities || receiptData.partialQuantities.length === 0)) {
        setReceiptData({
            ...receiptData,
            partialQuantities: orderLines.map(line => ({
                productId: line.id,
                productName: line.name,
                orderedQty: line.quantity || line.qty,
                receivedQty: line.quantity || line.qty,
                uom: line.uom
            }))
        })
    }

    const updatePartialQty = (index: number, value: string) => {
        const newQuantities = [...(receiptData.partialQuantities || [])]
        newQuantities[index] = {
            ...newQuantities[index],
            receivedQty: parseFloat(value) || 0
        }
        setReceiptData({ ...receiptData, partialQuantities: newQuantities })
    }

    return (
        <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <Label className="text-xs font-bold uppercase text-muted-foreground mb-3 block flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Tipo de Recepción
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
                                className={`flex items-start gap-4 rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all ${receiptData.type === type.id ? 'border-primary bg-primary/5' : ''
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
                                {orderLines.map((line, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{line.name}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {(line.quantity || line.qty).toLocaleString('es-CL')}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max={line.quantity || line.qty}
                                                value={receiptData.partialQuantities?.[idx]?.receivedQty || 0}
                                                onChange={(e) => updatePartialQty(idx, e.target.value)}
                                                className="w-full"
                                            />
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground font-medium">
                                            <UoMSelector
                                                line={line}
                                                currentUom={receiptData.partialQuantities?.[idx]?.uom || line.uom}
                                                onUomChange={(uomId) => {
                                                    const newQuantities = [...(receiptData.partialQuantities || [])]
                                                    newQuantities[idx] = {
                                                        ...newQuantities[idx],
                                                        uom: uomId
                                                    }
                                                    setReceiptData({ ...receiptData, partialQuantities: newQuantities })
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
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
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
                    <div className="p-2 rounded-lg bg-background border border-amber-500/20">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider">Nota de Recepción Diferida</p>
                        <p className="text-sm">
                            La mercancía no será recibida en inventario. Podrá registrar la recepción más tarde desde la lista de órdenes de compra.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
