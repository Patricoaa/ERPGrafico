"use client"

import { showApiError } from "@/lib/errors"
import { useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { ActionSlideButton, CancelButton, Drawer, FormFooter, FormSection, LabeledSelect, PeriodValidationDateInput, StatusBadge } from '@/components/shared'
import { EditableCollection, editableErrorsFromForm, focusFirstEditableError, initialEditableValues } from "@/components/entity-view"
import { deliveryLinesEditable, hasPartialLines, matchesLineType, serviceDeliveryLinesEditable, toLineQuantities, type LineTypeFilter } from "@/features/orders"
import type { Warehouse } from "@/features/inventory"
import { useSalesOrders } from "../hooks/useSalesOrders"
import { useDeliveryData, useDeliveryStock, type DeliveryOrder } from "../hooks/useDeliveryData"
import { deliveryFormSchema, type DeliveryFormValues } from "../schema"
import { toast } from "sonner"
import { Loader2, Package, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { useServerDate } from "@/hooks/useServerDate"
import { formDrawerWidth } from "@/lib/form-widths"

export interface DeliveryFormProps {
    orderId: number
    order: DeliveryOrder
    warehouses: Warehouse[]
    onSuccess?: () => void
    id?: string
    onLoadingChange?: (loading: boolean) => void
    filterType?: LineTypeFilter
}

export interface DeliveryDrawerProps extends Omit<DeliveryFormProps, "id" | "onLoadingChange" | "order" | "warehouses"> {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DeliveryDrawer(props: DeliveryDrawerProps) {
    if (!props.open || !props.orderId) return null
    return <DeliveryDrawerInner {...props} />
}

function DeliveryDrawerInner({ open, onOpenChange, orderId, onSuccess, filterType = 'ALL' }: DeliveryDrawerProps) {
    const [loading, setLoading] = useState(false)
    const formId = "modal-delivery-form"
    const { order, warehouses, isLoading } = useDeliveryData(orderId)

    if (isLoading || !order) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange} side="right" defaultSize={formDrawerWidth("master", false)} title="Cargando despacho..." contentClassName="p-0">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </Drawer>
        )
    }

    const isServiceMode = filterType === 'SERVICE'

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("master", false)}
            contentClassName="p-0"
            title={isServiceMode ? "Confirmar Entrega de Servicios" : "Despachar Orden"}
            subtitle={isServiceMode ? "Confirme la entrega de los servicios." : "Ingrese los productos a despachar."}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                            <ActionSlideButton
                                type="submit"
                                form={`${formId}-form`}
                                loading={loading}
                            >
                                {isServiceMode ? 'Confirmar Entrega' : 'Confirmar Despacho'}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <DeliveryForm id={formId} orderId={orderId} order={order} warehouses={warehouses} onSuccess={() => { onOpenChange(false); if (onSuccess) onSuccess(); }} onLoadingChange={setLoading} filterType={filterType} />
        </Drawer>
    )
}

export function DeliveryForm({ orderId, order, warehouses, onSuccess, id = "delivery-form", onLoadingChange, filterType = 'ALL' }: DeliveryFormProps) {
    const { dateString } = useServerDate()
    const { dispatchOrder, dispatchOrderPartial } = useSalesOrders()
    const isServiceMode = filterType === 'SERVICE'
    const definition = isServiceMode ? serviceDeliveryLinesEditable : deliveryLinesEditable

    const visibleLines = useMemo(() => order.lines.filter((line) => matchesLineType(line, filterType)), [order.lines, filterType])

    // The schema depends on the rows (caps, stock), which depend on the chosen warehouse: the form's
    // resolver delegates to the latest memoized one.
    const resolverRef = useRef<Resolver<DeliveryFormValues> | null>(null)
    const form = useForm<DeliveryFormValues>({
        resolver: (values, context, options) => (resolverRef.current as Resolver<DeliveryFormValues>)(values, context, options),
        defaultValues: {
            warehouseId: warehouses[0]?.id ?? null,
            deliveryDate: "",
            lines: initialEditableValues(definition, visibleLines),
        },
    })
    const warehouseId = form.watch("warehouseId")
    const deliveryDate = form.watch("deliveryDate")
    const lines = form.watch("lines")

    // The rows carry the stock of the chosen warehouse: the stock column and the stock rule read it.
    // Only tracked products read warehouse stock; one request per distinct product.
    const productIds = useMemo(
        () => [...new Set(visibleLines.filter((l) => l.track_inventory).map((l) => Number(l.product)).filter(Boolean))],
        [visibleLines],
    )
    const { stock, isLoading: stockLoading } = useDeliveryStock(isServiceMode ? [] : productIds, warehouseId)
    const rows = useMemo(
        () => visibleLines.map((l) => (l.track_inventory ? { ...l, available_stock: stock.get(Number(l.product)) } : l)),
        [visibleLines, stock],
    )
    resolverRef.current = useMemo(() => zodResolver(deliveryFormSchema(isServiceMode, rows)), [isServiceMode, rows])
    // Once submitted, stock arriving (or a warehouse change) re-validates the lines against it.
    const { isSubmitted } = form.formState
    useEffect(() => {
        if (isSubmitted) void form.trigger("lines")
    }, [rows, isSubmitted, form])

    // Sync delivery date with server date
    useEffect(() => {
        if (dateString && !form.getValues("deliveryDate")) form.setValue("deliveryDate", dateString)
    }, [dateString, form])

    const isPartial = hasPartialLines(lines, rows, "toDeliver")

    const onSubmit = async (values: DeliveryFormValues) => {
        if (stockLoading) {
            toast.info("Consultando el stock de la bodega. Intente nuevamente en un momento.")
            return
        }
        // Services leave from the first warehouse (as before).
        const warehouse_id = (isServiceMode ? warehouses[0]?.id : values.warehouseId) as number
        onLoadingChange?.(true)
        try {
            // A full dispatch ships every line of the order: only when nothing is partial and no line type is filtered out.
            if (isPartial || filterType !== 'ALL') {
                await dispatchOrderPartial({
                    orderId,
                    payload: { warehouse_id, delivery_date: values.deliveryDate, line_quantities: toLineQuantities(values.lines) },
                })
            } else {
                await dispatchOrder({ orderId, payload: { warehouse_id, delivery_date: values.deliveryDate } })
            }
            toast.success(isServiceMode ? "Entrega de servicios registrada correctamente" : "Despacho registrado correctamente")
            onSuccess?.()
        } catch (error: unknown) {
            showApiError(error, isServiceMode ? "Error al registrar la entrega de servicios" : "Error al registrar el despacho")
        } finally {
            onLoadingChange?.(false)
        }
    }

    const rootError = form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message

    return (
        <div id={id} className="space-y-4">
            <form
                id={`${id}-form`}
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                    if (errors.warehouseId) toast.error(errors.warehouseId.message ?? "Seleccione una bodega")
                    focusFirstEditableError()
                })}
                className="space-y-4"
            >
                <FormSection title={isServiceMode ? "Configuración de Entrega de Servicios" : "Configuración de Entrega"} icon={Package} />
                <div className={isServiceMode ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
                    {!isServiceMode && (
                        <LabeledSelect
                            label="Bodega de Despacho"
                            value={warehouseId?.toString() || ''}
                            onChange={(val) => form.setValue("warehouseId", Number(val))}
                            placeholder="Seleccione bodega"
                            error={form.formState.errors.warehouseId?.message}
                            options={warehouses.map((warehouse) => ({
                                value: warehouse.id.toString(),
                                label: `${warehouse.name} (${warehouse.code})`,
                            }))}
                        />
                    )}

                    <PeriodValidationDateInput
                        label={isServiceMode ? "Fecha de Entrega" : "Fecha de Despacho"}
                        date={deliveryDate ? new Date(deliveryDate + 'T12:00:00') : undefined}
                        onDateChange={(d) => form.setValue("deliveryDate", d ? d.toISOString().split('T')[0] : "")}
                        validationType="accounting"
                        required
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Estado de {isServiceMode ? 'Entrega' : 'Despacho'}:</span>
                    <StatusBadge
                        status={
                            order?.delivery_status === 'DELIVERED' ? 'delivered' :
                                order?.delivery_status === 'PARTIAL' ? 'partial' :
                                    'pending'
                        }
                        size="md"
                        variant="badge"
                    />
                </div>

                <FormSection title={isServiceMode ? "Detalle de Servicios" : "Detalle de Productos"} icon={Package} />
                <Controller
                    control={form.control}
                    name="lines"
                    render={({ field }) => (
                        <EditableCollection
                            definition={definition}
                            rows={rows}
                            value={field.value}
                            onChange={field.onChange}
                            errors={editableErrorsFromForm(form.formState.errors.lines, field.value)}
                            label={isServiceMode ? "Cantidades a entregar" : "Cantidades a despachar"}
                        />
                    )}
                />
                {rootError && <p role="alert" className="text-xs text-destructive">{rootError}</p>}

                {isPartial && (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            Se realizará un despacho parcial. Podrás crear despachos adicionales para las cantidades restantes.
                        </AlertDescription>
                    </Alert>
                )}
            </form>
        </div>
    )
}

export default DeliveryDrawer
