"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    BaseModal, DataCell, EmptyState, LabeledInput, LabeledSelect, LabeledSwitch, SkeletonShell,
} from "@/components/shared"
import { useServerDate } from "@/hooks/useServerDate"
import { showApiError, getErrorMessage } from "@/lib/errors"
import { useCreateInvoiceFromLines, useInvoiceableLines } from "../hooks/useInvoiceFromLines"
import { invoiceFromLinesSchema, quantityKey, type InvoiceFromLinesFormValues } from "../schema"
import type { InvoiceableLine, InvoiceableOrder, InvoiceFromLinesPayload, InvoiceSide } from "../types"

const DTE_OPTIONS: Record<InvoiceSide, { value: string; label: string }[]> = {
    sale: [
        { value: "FACTURA", label: "Factura" },
        { value: "FACTURA_EXENTA", label: "Factura exenta" },
        { value: "BOLETA", label: "Boleta" },
        { value: "BOLETA_EXENTA", label: "Boleta exenta" },
    ],
    purchase: [
        { value: "FACTURA", label: "Factura" },
        { value: "PURCHASE_INV", label: "Factura de compra" },
        { value: "FACTURA_EXENTA", label: "Factura exenta" },
        { value: "BOLETA", label: "Boleta" },
    ],
}

interface InvoiceFromLinesModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    side: InvoiceSide
    /** Orden desde la que se abre (Hub). */
    orderId: number
    /** Cliente / proveedor: permite incluir otras órdenes en la misma factura (D1). */
    partnerId?: number | null
    onSuccess?: () => void
}

/**
 * Factura por entregas / multi-orden por cantidad (ADR-0081, decisiones D1.1–D1.2).
 * Productos entregables se facturan contra sus despachos/recepciones confirmados;
 * servicios por cantidad. El backend valida las reglas; aquí se limitan los máximos.
 */
export function InvoiceFromLinesModal({ open, onOpenChange, side, orderId, partnerId, onSuccess }: InvoiceFromLinesModalProps) {
    const { dateString } = useServerDate()
    const [includeOthers, setIncludeOthers] = useState(false)
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
    const params = includeOthers && partnerId ? { side, partner: partnerId } : { side, orders: [orderId] }
    const { data: orders, isLoading, error } = useInvoiceableLines(params, open)
    const createInvoice = useCreateInvoiceFromLines()

    const form = useForm<InvoiceFromLinesFormValues>({
        resolver: zodResolver(invoiceFromLinesSchema),
        defaultValues: { dteType: "FACTURA", post: false, number: "", date: dateString ?? "", quantities: {} },
    })
    const quantities = form.watch("quantities")
    const post = form.watch("post")

    const fillPending = () => {
        const next: Record<string, number> = {}
        for (const order of orders ?? []) {
            for (const line of order.lines) {
                if (line.deliverable) {
                    for (const f of line.fulfillments) if (f.pending > 0) next[quantityKey(line.id, f.id)] = f.pending
                } else {
                    next[quantityKey(line.id)] = line.pending
                }
            }
        }
        form.setValue("quantities", next, { shouldValidate: true })
    }

    const setQty = (key: string, value: string) => {
        form.setValue("quantities", { ...form.getValues("quantities"), [key]: Number(value) || 0 }, { shouldValidate: true })
    }

    // Error del refine a nivel de `quantities` (no por clave)
    const rawQuantitiesError: unknown = form.formState.errors.quantities
    const quantitiesError = rawQuantitiesError && typeof rawQuantitiesError === "object" && "message" in rawQuantitiesError
        && typeof rawQuantitiesError.message === "string" ? rawQuantitiesError.message : undefined

    const selectedCount = useMemo(() => Object.values(quantities).filter((q) => q > 0).length, [quantities])

    const onSubmit = async (values: InvoiceFromLinesFormValues) => {
        const items: InvoiceFromLinesPayload["items"] = Object.entries(values.quantities)
            .filter(([, qty]) => qty > 0)
            .map(([key, qty]) => {
                const [lineId, fulfillment] = key.split(":")
                return {
                    order_line_id: Number(lineId),
                    quantity: qty,
                    fulfillment_line_id: fulfillment === "none" ? null : Number(fulfillment),
                }
            })
        try {
            await createInvoice.mutateAsync({
                payload: {
                    side, dte_type: values.dteType, status: values.post ? "POSTED" : "DRAFT",
                    number: values.number || undefined, date: values.date || undefined, items,
                },
                idempotencyKey,
            })
            setIdempotencyKey(crypto.randomUUID())
            onOpenChange(false)
            onSuccess?.()
        } catch (err: unknown) {
            showApiError(err, "No se pudo crear la factura")
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={<span className="flex items-center gap-2"><FileText className="h-5 w-5" />Facturar por entregas</span>}
            description="Seleccione las cantidades a facturar. Los productos se facturan contra sus entregas confirmadas."
            size="xl"
            footer={
                <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{selectedCount} línea(s) seleccionada(s)</span>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" form="invoice-from-lines-form" disabled={createInvoice.isPending || selectedCount === 0}>
                            {createInvoice.isPending ? "Creando..." : post ? "Crear y publicar" : "Crear borrador"}
                        </Button>
                    </div>
                </div>
            }
        >
            <form id="invoice-from-lines-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <LabeledSelect
                        label="Documento"
                        options={DTE_OPTIONS[side]}
                        value={form.watch("dteType")}
                        onChange={(v) => form.setValue("dteType", v)}
                        required
                    />
                    <LabeledInput label="Fecha" type="date" {...form.register("date")} required />
                    <LabeledInput label="Folio (opcional)" {...form.register("number")} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <LabeledSwitch
                        label="Publicar al crear"
                        description="Si no, queda en borrador para registrar el folio después."
                        checked={post}
                        onCheckedChange={(checked) => form.setValue("post", checked)}
                    />
                    {partnerId ? (
                        <LabeledSwitch
                            label={side === "sale" ? "Incluir otras órdenes del cliente" : "Incluir otras órdenes del proveedor"}
                            description="Una sola factura para varias órdenes."
                            checked={includeOthers}
                            onCheckedChange={(checked) => { setIncludeOthers(checked); form.setValue("quantities", {}) }}
                        />
                    ) : null}
                </div>

                {isLoading ? (
                    <SkeletonShell isLoading ariaLabel="Cargando líneas facturables" />
                ) : error ? (
                    <p className="text-sm text-destructive">No se pudieron cargar las líneas: {getErrorMessage(error)}</p>
                ) : !orders || orders.length === 0 ? (
                    <EmptyState variant="minimal" title="No hay cantidades pendientes de facturar" />
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={fillPending}>
                                Facturar todo lo pendiente
                            </Button>
                        </div>
                        {orders.map((order) => (
                            <OrderSection key={order.order_id} order={order} quantities={quantities} onChange={setQty} />
                        ))}
                        {quantitiesError && <p className="text-xs text-destructive">{quantitiesError}</p>}
                    </div>
                )}
            </form>
        </BaseModal>
    )
}

function OrderSection({ order, quantities, onChange }: {
    order: InvoiceableOrder
    quantities: Record<string, number>
    onChange: (key: string, value: string) => void
}) {
    return (
        <section className="space-y-2">
            <h4 className="text-sm font-medium">{order.display_id}</h4>
            <ul className="divide-y divide-border rounded-md border">
                {order.lines.map((line) => (
                    <LineRows key={line.id} line={line} quantities={quantities} onChange={onChange} />
                ))}
            </ul>
        </section>
    )
}

function LineRows({ line, quantities, onChange }: {
    line: InvoiceableLine
    quantities: Record<string, number>
    onChange: (key: string, value: string) => void
}) {
    const header = (
        <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{line.description}</span>
            <span className="text-xs text-muted-foreground">
                Pedido <DataCell.Number value={line.quantity} decimals={2} size="xs" /> · Pendiente de facturar{" "}
                <DataCell.Number value={line.pending} decimals={2} size="xs" />
            </span>
        </div>
    )

    if (!line.deliverable) {
        const key = quantityKey(line.id)
        return (
            <li className="space-y-2 px-3 py-2 text-sm">
                {header}
                <QuantityInput label="Cantidad a facturar" max={line.pending} value={quantities[key]} onChange={(v) => onChange(key, v)} />
            </li>
        )
    }

    return (
        <li className="space-y-2 px-3 py-2 text-sm">
            {header}
            {line.fulfillments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin entregas confirmadas: no se puede facturar en parte (D1.2).</p>
            ) : (
                line.fulfillments.map((f) => {
                    const key = quantityKey(line.id, f.id)
                    return (
                        <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                                {f.document_display}{f.date ? <> · <DataCell.Date value={f.date} size="xs" /></> : null} · entregado{" "}
                                <DataCell.Number value={f.delivered} decimals={2} size="xs" /> · por facturar{" "}
                                <DataCell.Number value={f.pending} decimals={2} size="xs" />
                            </span>
                            <QuantityInput label="Facturar" max={f.pending} value={quantities[key]} onChange={(v) => onChange(key, v)} />
                        </div>
                    )
                })
            )}
        </li>
    )
}

function QuantityInput({ label, max, value, onChange }: {
    label: string
    max: number
    value: number | undefined
    onChange: (value: string) => void
}) {
    return (
        <LabeledInput
            label={label}
            type="number"
            min={0}
            max={max}
            step="any"
            disabled={max <= 0}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
        />
    )
}
