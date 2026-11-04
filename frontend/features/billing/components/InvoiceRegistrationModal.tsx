"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileText, List } from "lucide-react"
import {
    BaseModal,
    CancelButton,
    CollapsibleSection,
    DocumentAttachmentDropzone,
    FolioValidationInput,
    FormFooter,
    LabeledSelect,
    PeriodValidationDateInput,
    SubmitButton,
} from "@/components/shared"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { generateUuidV4 } from "@/lib/uuid"
import { useServerDate } from "@/hooks/useServerDate"
import { useConfirmInvoice } from "@/features/orders"
import { ATTACHMENT_REQUIRED_DTE, invoiceRegistrationSchema, type InvoiceRegistrationFormValues, quantityKey } from "../schema"
import { useInvoiceableLines, useCreateInvoiceFromLines } from "../hooks/useInvoiceFromLines"
import type { InvoiceSide, InvoiceableLine, InvoiceableOrder, InvoiceFromLinesPayload } from "../types"

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

export interface InvoiceRegistrationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    side: InvoiceSide
    orderId: number
    partnerId?: number | null
    onSuccess?: () => void
}

export function InvoiceRegistrationModal({
    open,
    onOpenChange,
    side,
    orderId,
    partnerId,
    onSuccess,
}: InvoiceRegistrationModalProps) {
    const { dateString } = useServerDate()
    const [linesOpen, setLinesOpen] = useState(false)
    const [isFolioValid, setIsFolioValid] = useState(true)
    const [isPeriodValid, setIsPeriodValid] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    const { data: orders } = useInvoiceableLines({ side, orders: [orderId] }, open)

    const form = useForm<InvoiceRegistrationFormValues>({
        resolver: zodResolver(invoiceRegistrationSchema),
        defaultValues: {
            dteType: "FACTURA",
            folio: "",
            issueDate: dateString ?? "",
            attachment: null,
            isPending: false,
            quantities: {},
        },
    })

    const dteType = form.watch("dteType")
    const isPending = form.watch("isPending")
    const attachment = form.watch("attachment")

    // Sync server date
    useEffect(() => {
        if (dateString && !form.getValues("issueDate")) {
            form.setValue("issueDate", dateString)
        }
    }, [dateString, form])

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            form.reset({ dteType: "FACTURA", folio: "", issueDate: dateString ?? "", attachment: null, isPending: false, quantities: {} })
            setLinesOpen(false)
            setIsFolioValid(true)
            setIsPeriodValid(true)
        }
    }, [open, form, dateString])

    // Auto-fill all pending quantities when orders load
    useEffect(() => {
        if (!orders) return
        const next: Record<string, number> = {}
        for (const order of orders) {
            for (const line of order.lines) {
                if (line.deliverable) {
                    for (const f of line.fulfillments) {
                        if (f.pending > 0) next[quantityKey(line.id, f.id)] = f.pending
                    }
                } else {
                    if (line.pending > 0) next[quantityKey(line.id)] = line.pending
                }
            }
        }
        form.setValue("quantities", next)
    }, [orders, form])

    const requiresAttachment = ATTACHMENT_REQUIRED_DTE.has(dteType)
    const attachmentLabel = requiresAttachment && !isPending ? "Adjunto (obligatorio)" : "Adjunto (opcional)"

    const lineCount = orders?.reduce((acc, o) => acc + o.lines.length, 0) ?? 0

    const idempotencyKeyRef = useRef(generateUuidV4())
    const createInvoice = useCreateInvoiceFromLines()
    const { confirmInvoice } = useConfirmInvoice()

    const handleSubmit = async () => {
        const folio = form.getValues("folio")
        const issueDate = form.getValues("issueDate")
        const att = form.getValues("attachment")
        const quantities = form.getValues("quantities")

        if (!isPending) {
            if (!folio) {
                toast.error("El folio es obligatorio")
                return
            }
            if (requiresAttachment && !att) {
                toast.error("El adjunto es obligatorio para este tipo de documento")
                return
            }
            if (!isFolioValid) {
                toast.error("El número de folio ya ha sido utilizado. Ingrese uno válido para continuar.")
                return
            }
            if (!isPeriodValid) {
                toast.error("El periodo seleccionado está cerrado.")
                return
            }
        }

        const items: InvoiceFromLinesPayload["items"] = Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([key, qty]) => {
                const [lineId, fulfillment] = key.split(":")
                return {
                    order_line_id: Number(lineId),
                    quantity: qty,
                    fulfillment_line_id: fulfillment === "none" ? null : Number(fulfillment),
                }
            })

        setSubmitting(true)
        try {
            const invoice = await createInvoice.mutateAsync({
                payload: { side, dte_type: dteType, status: "DRAFT", items },
                idempotencyKey: idempotencyKeyRef.current,
            })
            idempotencyKeyRef.current = generateUuidV4()

            if (!isPending) {
                const fd = new FormData()
                fd.append("number", folio)
                fd.append("date", issueDate)
                if (att) fd.append("document_attachment", att)
                await confirmInvoice({ id: (invoice as { id: number }).id, formData: fd as unknown as Record<string, unknown> })
            }

            toast.success(isPending ? "Documento registrado como pendiente" : "Documento registrado correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            showApiError(error, "Error al registrar el documento")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="md"
            icon={FileText}
            title="Registrar Documento"
            description="Ingrese los datos del documento tributario."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={submitting} />
                            <SubmitButton
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={submitting || (!isPending && (!isFolioValid || !isPeriodValid))}
                            >
                                Registrar Documento
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="space-y-6 py-4">
                {/* DTE type */}
                <LabeledSelect
                    label="Tipo de Documento"
                    value={dteType}
                    onChange={(v) => form.setValue("dteType", v)}
                    options={DTE_OPTIONS[side]}
                />

                {/* Pending toggle */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="pending-check"
                        checked={isPending}
                        onChange={(e) => {
                            const pending = e.target.checked
                            form.setValue("isPending", pending)
                            if (pending) {
                                form.setValue("folio", "")
                                form.setValue("attachment", null)
                                setIsFolioValid(true)
                                setIsPeriodValid(true)
                            }
                        }}
                        className="h-4 w-4 rounded border text-primary"
                        aria-label="Aún no tengo el folio/adjunto"
                    />
                    <Label htmlFor="pending-check" className="text-sm font-medium cursor-pointer">
                        Aún no tengo el folio/adjunto
                    </Label>
                </div>

                {/* Folio + date */}
                {!isPending && (
                    <div className="grid grid-cols-2 gap-4">
                        <FolioValidationInput
                            value={form.watch("folio")}
                            onChange={(v) => form.setValue("folio", v)}
                            onValidityChange={(valid) => setIsFolioValid(valid)}
                            contactId={partnerId ?? undefined}
                            isPurchase={side === "purchase"}
                            dteType={dteType}
                            disabled={isPending}
                        />
                        <PeriodValidationDateInput
                            label="Fecha de Emisión"
                            date={form.watch("issueDate") ? new Date(form.watch("issueDate") + "T12:00:00") : undefined}
                            onDateChange={(d) => form.setValue("issueDate", d ? d.toISOString().split("T")[0] : "")}
                            validationType="both"
                            onValidityChange={setIsPeriodValid}
                            disabled={isPending}
                        />
                    </div>
                )}

                {/* Attachment */}
                {!isPending && (
                    <div className="space-y-2">
                        <Label>{attachmentLabel}</Label>
                        <DocumentAttachmentDropzone
                            file={attachment}
                            onFileChange={(f) => form.setValue("attachment", f)}
                            dteType={dteType}
                            isPending={isPending}
                            disabled={isPending}
                        />
                    </div>
                )}

                {/* Collapsible line quantities */}
                {lineCount > 0 && (
                    <CollapsibleSection
                        title={`Cantidades a facturar (${lineCount} línea${lineCount !== 1 ? "s" : ""})`}
                        icon={List}
                        open={linesOpen}
                        onOpenChange={setLinesOpen}
                    >
                        <div className="p-4">
                            {orders?.map((order) => (
                                <OrderLinesSection
                                    key={order.order_id}
                                    order={order}
                                    quantities={form.watch("quantities")}
                                    onChange={(key, val) =>
                                        form.setValue("quantities", {
                                            ...form.getValues("quantities"),
                                            [key]: Number(val) || 0,
                                        })
                                    }
                                />
                            ))}
                        </div>
                    </CollapsibleSection>
                )}
            </div>
        </BaseModal>
    )
}

function OrderLinesSection({
    order,
    quantities,
    onChange,
}: {
    order: InvoiceableOrder
    quantities: Record<string, number>
    onChange: (key: string, val: string) => void
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

function LineRows({
    line,
    quantities,
    onChange,
}: {
    line: InvoiceableLine
    quantities: Record<string, number>
    onChange: (key: string, val: string) => void
}) {
    if (!line.deliverable) {
        const key = quantityKey(line.id)
        return (
            <li className="px-3 py-2 text-sm space-y-1">
                <span className="font-medium">{line.description}</span>
                <input
                    type="number"
                    min={0}
                    max={line.pending}
                    step="any"
                    value={quantities[key] ?? ""}
                    onChange={(e) => onChange(key, e.target.value)}
                    className="w-24 rounded border px-2 py-1 text-sm"
                    aria-label={`Cantidad a facturar ${line.description}`}
                />
            </li>
        )
    }

    return (
        <li className="px-3 py-2 text-sm space-y-1">
            <span className="font-medium">{line.description}</span>
            {line.fulfillments.map((f) => {
                const key = quantityKey(line.id, f.id)
                return (
                    <div key={f.id} className="grid grid-cols-[1fr_8rem] items-center gap-2">
                        <span className="text-xs text-muted-foreground">{f.document_display}</span>
                        <input
                            type="number"
                            min={0}
                            max={f.pending}
                            step="any"
                            value={quantities[key] ?? ""}
                            onChange={(e) => onChange(key, e.target.value)}
                            className="rounded border px-2 py-1 text-sm"
                            aria-label={`Facturar ${f.document_display}`}
                        />
                    </div>
                )
            })}
        </li>
    )
}
