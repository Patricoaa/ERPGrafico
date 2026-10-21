"use client"

import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { showApiError } from "@/lib/errors"

import { BaseModal, CancelButton, Chip, FormFooter, LabeledInput, LabeledSelect, PeriodValidationDateInput, SkeletonShell, SubmitButton } from '@/components/shared'
import { EditableCollection, editableErrorsFromForm, focusFirstEditableError, initialEditableValues } from "@/components/entity-view"
import { hasPartialLines, matchesLineType, receiptLinesEditable, returnLinesEditable, toReceiptLineData, type LineTypeFilter, type OrderLine } from "@/features/orders"
import type { Warehouse } from "@/features/inventory"
import { purchasingApi } from "../api/purchasingApi"
import { useReceiptData } from "../hooks/useReceiptData"
import { receiptFormSchema, type ReceiptFormValues } from "../schema"
import { toast } from "sonner"
import { Package, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { useServerDate } from "@/hooks/useServerDate"

interface PurchaseOrder {
    id: number
    number: string
    supplier_name: string
    lines: OrderLine[]
    receiving_status: string
    warehouse: number
}

interface ReceiptModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    onSuccess?: () => void
    isRefund?: boolean
    filterType?: LineTypeFilter
}

const FORM_ID = "purchase-receipt-form"

export function ReceiptModal({
    open,
    onOpenChange,
    orderId,
    onSuccess,
    isRefund = false,
    filterType = 'ALL'
}: ReceiptModalProps) {
    const { order: orderData, warehouses, isLoading } = useReceiptData(orderId, open && !!orderId)
    const order = orderData as unknown as PurchaseOrder | null
    const [submitting, setSubmitting] = useState(false)

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            icon={Package}
            title={`${isRefund ? "Devolver Productos" : (filterType === 'SERVICE' ? "Confirmar Entrega de Servicios" : "Recibir Orden")} ${formatEntityDisplay('purchasing.purchaseorder', { number: order?.number || "" })}`}
            description={`Proveedor: ${order?.supplier_name || ""}`}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={submitting} />
                            <SubmitButton type="submit" form={FORM_ID} loading={submitting} disabled={isLoading || !order}>
                                {isRefund ? 'Confirmar Devolución' : (filterType === 'SERVICE' ? 'Confirmar Entrega' : 'Confirmar Recepción')}
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando datos de orden">
                {order && !isLoading && (
                    // Mounted once the order and the warehouses are loaded: the defaults come from both.
                    <ReceiptForm
                        key={order.id}
                        order={order}
                        warehouses={warehouses}
                        isRefund={isRefund}
                        filterType={filterType}
                        onSubmittingChange={setSubmitting}
                        onDone={() => {
                            onOpenChange(false)
                            onSuccess?.()
                        }}
                    />
                )}
            </SkeletonShell>
        </BaseModal>
    )
}

interface ReceiptFormProps {
    order: PurchaseOrder
    warehouses: Warehouse[]
    isRefund: boolean
    filterType: LineTypeFilter
    onSubmittingChange: (submitting: boolean) => void
    onDone: () => void
}

function ReceiptForm({ order, warehouses, isRefund, filterType, onSubmittingChange, onDone }: ReceiptFormProps) {
    const { dateString } = useServerDate()
    const definition = isRefund ? returnLinesEditable : receiptLinesEditable
    const rows = useMemo(() => order.lines.filter((line) => matchesLineType(line, filterType)), [order.lines, filterType])
    const schema = useMemo(() => receiptFormSchema(isRefund, rows), [isRefund, rows])

    const form = useForm<ReceiptFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            // `undefined` until chosen: the schema asks for a warehouse.
            warehouseId: order.warehouse || warehouses[0]?.id,
            receiptDate: dateString ?? "",
            deliveryReference: "",
            notes: "",
            lines: initialEditableValues(definition, rows),
        },
    })
    const warehouseId = form.watch("warehouseId")
    const receiptDate = form.watch("receiptDate")
    const lines = form.watch("lines")

    // Sync with server date
    useEffect(() => {
        if (dateString && !form.getValues("receiptDate")) form.setValue("receiptDate", dateString)
    }, [dateString, form])

    const isPartial = !isRefund && hasPartialLines(lines, rows, "quantity")

    const onSubmit = async (values: ReceiptFormValues) => {
        onSubmittingChange(true)
        try {
            // Always the partial endpoints: they take the per-line quantities and costs.
            const payload = {
                warehouse_id: values.warehouseId,
                receipt_date: values.receiptDate,
                delivery_reference: values.deliveryReference,
                notes: values.notes,
                line_data: toReceiptLineData(values.lines, rows),
            }
            if (isRefund) {
                await purchasingApi.partialReturn(order.id, payload)
            } else {
                await purchasingApi.partialReceive(order.id, payload)
            }
            toast.success(isRefund ? "Devolución registrada correctamente" : "Recepción registrada correctamente")
            onDone()
        } catch (error: unknown) {
            showApiError(error, isRefund ? "Error al registrar la devolución" : "Error al registrar la recepción")
        } finally {
            onSubmittingChange(false)
        }
    }

    const errors = form.formState.errors
    const rootError = errors.lines?.root?.message ?? errors.lines?.message

    return (
        <form id={FORM_ID} className="space-y-4" onSubmit={form.handleSubmit(onSubmit, () => focusFirstEditableError())}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledSelect
                    label={`Bodega de ${isRefund ? 'Salida' : 'Recepción'}`}
                    required
                    value={warehouseId?.toString() || ''}
                    onChange={(val) => form.setValue("warehouseId", Number(val), { shouldValidate: form.formState.isSubmitted })}
                    options={warehouses.map(warehouse => ({
                        value: warehouse.id.toString(),
                        label: `${warehouse.name} (${warehouse.code})`
                    }))}
                    error={errors.warehouseId?.message}
                />
                <PeriodValidationDateInput
                    label={`Fecha de ${isRefund ? 'Devolución' : 'Recepción'}`}
                    required
                    date={receiptDate ? new Date(receiptDate + 'T12:00:00') : undefined}
                    onDateChange={(d) => form.setValue("receiptDate", d ? d.toISOString().split('T')[0] : "")}
                    validationType="tax"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledInput
                    label="Referencia (Guía/Comprobante)"
                    placeholder="Ej: GD-12345"
                    {...form.register("deliveryReference")}
                />
                <LabeledInput
                    label="Notas / Observaciones"
                    placeholder="Mercadería recibida en buen estado..."
                    {...form.register("notes")}
                />
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado de {isRefund ? 'Devolución' : 'Recepción'}:</span>
                <Chip intent={
                    order.receiving_status === 'RECEIVED' ? 'success' :
                        order.receiving_status === 'PARTIAL' ? 'info' :
                            'neutral'
                }>
                    {order.receiving_status === 'RECEIVED' ? (isRefund ? 'Devuelto' : 'Recibido') :
                        order.receiving_status === 'PARTIAL' ? 'Parcial' :
                            'Pendiente'}
                </Chip>
            </div>

            <Controller
                control={form.control}
                name="lines"
                render={({ field }) => (
                    <EditableCollection
                        definition={definition}
                        rows={rows}
                        value={field.value}
                        onChange={field.onChange}
                        errors={editableErrorsFromForm(errors.lines, field.value)}
                        label={isRefund ? "Cantidades a devolver" : "Cantidades a recibir"}
                    />
                )}
            />
            {rootError && <p role="alert" className="text-xs text-destructive">{rootError}</p>}

            {isPartial && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        Recepción parcial: La orden permanecerá abierta hasta completar las cantidades.
                    </AlertDescription>
                </Alert>
            )}
        </form>
    )
}
