"use client"

import {useState, useEffect} from "react"
import { LabeledInput, LabeledContainer, ChoiceCard, ChoiceGroup, StepHeader, Section, fadeInClass } from "@/components/shared"
import { purchasingApi } from "../../api/purchasingApi"
import { useServerDate } from "@/hooks/useServerDate"
import { EditableCollection, editableSchema, toEditableErrors, type EditableRowValue } from "@/components/entity-view"
import { orderedOf, receiptQuantitiesEditable, subscriptionKeyOf, subscriptionStartEditable, type ReceiptCheckoutRow } from "../../entity-view/checkoutReceipt.entity"
import { type ReceiptData, type CheckoutLine } from "../../types"
import { type Warehouse, type UoM } from "@/types/entities"
import {Receipt, FileText, FileCheck} from "lucide-react"
import { cn } from "@/lib/utils"
interface Step4_ReceiptProps {
    receiptData: ReceiptData
    setReceiptData: (data: ReceiptData | ((prev: ReceiptData) => ReceiptData)) => void
    orderLines?: CheckoutLine[]
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
            color: 'text-success-text'
        },
        {
            id: 'DEFERRED',
            label: `${receiptLabel} Diferida`,
            description: `Registrar factura sin confirmar ${itemLabel}`,
            icon: FileText,
            color: 'text-warning-text'
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

    // ── Receipt quantities and subscription dates (EditableCollection, ADR-0087) ──
    const rowOf = (line: CheckoutLine, idx: number): ReceiptCheckoutRow => {
        const base = uoms.find(u => u.id.toString() === line.uom?.toString())
        const sameCategory = base ? uoms.filter(u => u.category === base.category) : []
        return {
            ...line,
            key: line.id !== undefined ? `l${line.id}` : `p${line.product ?? idx}`,
            uomOptions: sameCategory.length > 0
                ? sameCategory.map(u => ({ value: u.id.toString(), label: u.name }))
                : [{ value: String(line.uom), label: line.uom_name }],
        }
    }
    const receiptRows = orderLines.map(rowOf)
    const partialOf = (row: ReceiptCheckoutRow) => (receiptData.partialQuantities || []).find(
        (pq) => (row.id && pq.lineId === row.id) || (row.product && pq.productId === row.product),
    )
    const receiptValue: EditableRowValue[] = receiptRows.map((row) => {
        const pq = partialOf(row)
        return { key: row.key, values: { received: pq?.receivedQty ?? 0 }, textValues: { uom: String(pq?.uom ?? row.uom) } }
    })
    const parsedReceipt = editableSchema(receiptQuantitiesEditable, receiptRows).safeParse(receiptValue)
    const receiptErrors = parsedReceipt.success ? {} : toEditableErrors(parsedReceipt.error, receiptValue)
    const handleReceiptChange = (next: EditableRowValue[]) => {
        const byKey = new Map(receiptRows.map((r) => [r.key, r]))
        setReceiptData((prev: ReceiptData) => ({
            ...prev,
            partialQuantities: next.flatMap((v) => {
                const row = byKey.get(v.key)
                if (!row) return []
                const uom = v.textValues?.uom
                return [{
                    lineId: row.id,
                    productId: row.product,
                    productName: row.name || row.product_name,
                    orderedQty: orderedOf(row),
                    receivedQty: v.values.received ?? 0,
                    uom: uom ? Number(uom) : row.uom,
                }]
            }),
        }))
    }

    const subscriptionRows = orderLines.filter(line => line.product_type === 'SUBSCRIPTION').map(rowOf)
    const subscriptionValue: EditableRowValue[] = subscriptionRows.map((row) => ({
        key: row.key,
        values: {},
        textValues: { start: receiptData.subscriptionDates?.[subscriptionKeyOf(row)] || dateString || "" },
    }))
    const handleSubscriptionChange = (next: EditableRowValue[]) => {
        const byKey = new Map(subscriptionRows.map((r) => [r.key, r]))
        setReceiptData((prev: ReceiptData) => ({
            ...prev,
            subscriptionDates: {
                ...(prev.subscriptionDates || {}),
                ...Object.fromEntries(next.flatMap((v) => {
                    const row = byKey.get(v.key)
                    return row ? [[subscriptionKeyOf(row), v.textValues?.start ?? ""]] : []
                })),
            },
        }))
    }

    return (
        <div className="space-y-6">
            <StepHeader title="Recepción de Mercadería" description="Indique cómo y cuándo se realizará la recepción del inventario." icon={Receipt} />

            <LabeledContainer
                label={`Tipo de ${receiptLabel}`}
                className="border-transparent group-focus-within:border-transparent group-focus-within:ring-0 group-focus-within:shadow-none"
            >
                <ChoiceGroup
                    label={`Tipo de ${receiptLabel}`}
                    columns="grid-cols-1 md:grid-cols-3"
                    activation="select"
                >
                    {receiptTypes.map((type) => (
                        <ChoiceCard
                            variant="light"
                            key={type.id}
                            selected={receiptData.type === type.id}
                            onSelect={() => setReceiptData({ ...receiptData, type: type.id as ReceiptData['type'] })}
                            title={type.label}
                            description={type.description}
                            icon={type.icon}
                            iconClassName={type.color}
                        />
                    ))}
                </ChoiceGroup>
            </LabeledContainer>

            {receiptData.type === 'PARTIAL' && orderLines.length > 0 && (
                <div className={cn("space-y-4", fadeInClass({ from: "top" }))}>
                    <Section.Header title="Cantidades a Recibir" />
                    <EditableCollection
                        definition={receiptQuantitiesEditable}
                        rows={receiptRows}
                        value={receiptValue}
                        onChange={handleReceiptChange}
                        errors={receiptErrors}
                        label="Cantidades a recibir"
                    />
                </div>
            )}

            {hasSubscriptions && (receiptData.type as string) !== 'DEFERRED' && (
                <div className={cn("space-y-4", fadeInClass({ from: "top" }))}>
                    <Section.Header title="Fechas de Inicio de Suscripciones" />
                    <EditableCollection
                        definition={subscriptionStartEditable}
                        rows={subscriptionRows}
                        value={subscriptionValue}
                        onChange={handleSubscriptionChange}
                        label="Fechas de inicio de suscripciones"
                    />
                </div>
            )}

            {(receiptData.type as string) !== 'DEFERRED' && (
                <div className={cn("space-y-6", fadeInClass({ from: "top" }))}>
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
                <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-md text-warning-text">
                    <div className="p-2 rounded-sm bg-background border border-warning/20">
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
