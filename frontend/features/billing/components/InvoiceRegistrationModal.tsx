"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileText, List } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
    BaseModal,
    CancelButton,
    CollapsibleSection,
    DteRegistrationPanel,
    FormFooter,
    SubmitButton,
} from "@/components/shared"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { invalidateCrossFeature } from "@/lib/invalidation"
import { generateUuidV4 } from "@/lib/uuid"
import { useServerDate } from "@/hooks/useServerDate"
import { useConfirmInvoice } from "@/features/orders"
import { SALES_KEYS } from "@/features/sales"
import { PURCHASING_KEYS } from "@/features/purchasing"
import { DOCUMENTS_KEYS } from "@/features/documents"
import { fiscalMatchApi } from "@/features/tax"
import { DteClass, FiscalMatchContext, getDteSiiCode } from "@/lib/dte"
import { invoiceRegistrationSchema, type InvoiceRegistrationFormValues, quantityKey } from "../schema"
import { useInvoiceableLines, useCreateInvoiceFromLines } from "../hooks/useInvoiceFromLines"
import { INVOICES_KEYS } from "../hooks/queryKeys"
import type { InvoiceSide, InvoiceableLine, InvoiceableOrder, InvoiceFromLinesPayload } from "../types"

const ALLOWED_DTE: Record<InvoiceSide, DteClass[]> = {
    sale: ["FACTURA", "FACTURA_EXENTA", "BOLETA", "BOLETA_EXENTA"],
    purchase: ["FACTURA", "PURCHASE_INV", "FACTURA_EXENTA", "BOLETA"],
}

export interface InvoiceRegistrationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    side: InvoiceSide
    orderId: number
    partnerId?: number | null
    counterpartyRut?: string | null
    onSuccess?: () => void
    /** Pre-existing DRAFT invoice id — skips createInvoiceFromLines, goes straight to confirm. */
    initialDraftId?: number
    /** DTE type already set on the existing draft — pre-selects and disables the selector. */
    initialDteType?: string
    defaultMode?: "rcv" | "manual"
}

export function InvoiceRegistrationModal({
    open,
    onOpenChange,
    side,
    orderId,
    partnerId,
    counterpartyRut,
    onSuccess,
    initialDraftId,
    initialDteType,
    defaultMode,
}: InvoiceRegistrationModalProps) {
    const { dateString } = useServerDate()
    const [linesOpen, setLinesOpen] = useState(false)
    const [isFolioValid, setIsFolioValid] = useState(true)
    const [isPeriodValid, setIsPeriodValid] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [pickedFiscalMatchId, setPickedFiscalMatchId] = useState<number | null>(null)

    const isCompletingDraft = initialDraftId !== undefined

    // Only fetch invoiceable lines when creating a new invoice (not completing a draft)
    const { data: orders } = useInvoiceableLines({ side, orders: [orderId] }, open && !isCompletingDraft)

    const form = useForm<InvoiceRegistrationFormValues>({
        resolver: zodResolver(invoiceRegistrationSchema),
        defaultValues: {
            dteType: initialDteType ?? "FACTURA",
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
    const issueDateVal = form.watch("issueDate")
    const folioVal = form.watch("folio")

    // Sync server date
    useEffect(() => {
        if (dateString && !form.getValues("issueDate")) {
            form.setValue("issueDate", dateString)
        }
    }, [dateString, form])

    // Seed draftIdRef when modal opens with a pre-existing draft
    useEffect(() => {
        if (open && initialDraftId !== undefined) {
            draftIdRef.current = initialDraftId
        }
    }, [open, initialDraftId])

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            form.reset({
                dteType: initialDteType ?? "FACTURA",
                folio: "",
                issueDate: dateString ?? "",
                attachment: null,
                isPending: false,
                quantities: {},
            })
            setLinesOpen(false)
            setIsFolioValid(true)
            setIsPeriodValid(true)
            setPickedFiscalMatchId(null)
            draftIdRef.current = null
            idempotencyKeyRef.current = generateUuidV4()
        }
    }, [open, form, dateString, initialDteType])

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

    const lineCount = orders?.reduce((acc, o) => acc + o.lines.length, 0) ?? 0

    const idempotencyKeyRef = useRef(generateUuidV4())
    const draftIdRef = useRef<number | null>(null)
    const queryClient = useQueryClient()
    const createInvoice = useCreateInvoiceFromLines()
    const { confirmInvoice } = useConfirmInvoice()

    const fiscalMatchContext = useMemo<FiscalMatchContext>(() => {
        const code = getDteSiiCode(dteType as DteClass)
        return {
            direction: side === "purchase" ? "purchase" : "sale",
            sii_code: code ?? undefined,
            counterparty_rut: counterpartyRut || undefined,
        }
    }, [dteType, side, counterpartyRut])

    const handleSubmit = async () => {
        const currentFolio = form.getValues("folio")
        const currentIssueDate = form.getValues("issueDate")
        const currentAtt = form.getValues("attachment")
        const quantities = form.getValues("quantities")

        if (!isPending && !pickedFiscalMatchId) {
            if (!currentFolio) {
                toast.error("El folio es obligatorio")
                return
            }
            if (!currentIssueDate) {
                toast.error("La fecha de emisión es requerida")
                return
            }
            const requiresAttachment = dteType === "FACTURA" || dteType === "PURCHASE_INV"
            if (requiresAttachment && !currentAtt) {
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

        if (items.length === 0 && !isCompletingDraft) {
            toast.error("Indique al menos una cantidad a facturar")
            return
        }

        setSubmitting(true)
        try {
            // On retry after a failed confirm, reuse the existing DRAFT (draftIdRef set).
            let invoiceId = draftIdRef.current
            if (invoiceId === null) {
                const invoice = await createInvoice.mutateAsync({
                    payload: { side, dte_type: dteType, status: "DRAFT", items },
                    idempotencyKey: idempotencyKeyRef.current,
                })
                invoiceId = (invoice as { id: number }).id
                draftIdRef.current = invoiceId
            }

            if (pickedFiscalMatchId) {
                await fiscalMatchApi.apply(
                    pickedFiscalMatchId,
                    [{ op: "link", part: "erp", id: invoiceId }],
                    generateUuidV4()
                )
            }

            if (!isPending) {
                const fd = new FormData()
                fd.append("number", currentFolio)
                fd.append("date", currentIssueDate)
                if (currentAtt) fd.append("document_attachment", currentAtt)
                await confirmInvoice({ id: invoiceId, formData: fd })
            } else {
                invalidateCrossFeature(queryClient, [INVOICES_KEYS.all, SALES_KEYS.all, PURCHASING_KEYS.all, DOCUMENTS_KEYS.all])
            }

            draftIdRef.current = null
            idempotencyKeyRef.current = generateUuidV4()
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
            size="lg"
            asDialog
            icon={FileText}
            title="Registrar Documento"
            description="Asigne el documento pendiente desde el SII / RCV o regístrelo manualmente."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={submitting} />
                            <SubmitButton
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={submitting || (!isPending && !pickedFiscalMatchId && (!isFolioValid || !isPeriodValid))}
                            >
                                Registrar Documento
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="space-y-6 py-4">
                <DteRegistrationPanel
                    data={{
                        dteClass: dteType as DteClass,
                        isPending: !!isPending,
                        folio: folioVal || "",
                        issueDate: issueDateVal || "",
                        attachment: attachment || null,
                        pickedFiscalMatchId: pickedFiscalMatchId,
                    }}
                    onChange={(next) => {
                        if (!isCompletingDraft) {
                            form.setValue("dteType", next.dteClass)
                        }
                        form.setValue("isPending", next.isPending)
                        form.setValue("folio", next.folio)
                        form.setValue("issueDate", next.issueDate)
                        form.setValue("attachment", next.attachment)
                        setPickedFiscalMatchId(next.pickedFiscalMatchId ?? null)
                    }}
                    direction={side === "purchase" ? "purchase" : "sale"}
                    fiscalMatchContext={fiscalMatchContext}
                    invoiceId={initialDraftId}
                    allowTypeChange={!isCompletingDraft}
                    typeOptions={ALLOWED_DTE[side]}
                    selectorVariant="select"
                    onFolioValidityChange={setIsFolioValid}
                    onPeriodValidityChange={setIsPeriodValid}
                    contactId={partnerId ?? undefined}
                    defaultMode={defaultMode}
                />

                {/* Collapsible line quantities — only shown when creating a new invoice */}
                {!isCompletingDraft && lineCount > 0 && (
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
