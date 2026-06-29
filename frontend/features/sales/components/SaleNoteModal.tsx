"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import {FileBadge, AlertCircle} from "lucide-react"
import { useSaleOrder, useSalesOrders } from "../hooks/useSalesOrders"
import { useInvoice, useInvoices } from "@/features/billing"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/money"
import { useVatRate } from '@/hooks/useVatRate'
import { useServerDate } from '@/hooks/useServerDate'
import { PricingUtils } from '@/lib/pricing-utils'
import { Card } from "@/components/ui/card"
import { formatEntityDisplay } from "@/lib/entity-registry"

import { BaseModal, CancelButton, DocumentAttachmentDropzone, EmptyState, FormFooter, FormSection, LabeledContainer, LabeledInput, LabeledSelect, PeriodValidationDateInput, SkeletonShell, SubmitButton } from '@/components/shared'

import { type SaleOrderLine, type SaleNoteLine } from "../types"

const saleNoteSchema = z.object({
    noteType: z.enum(["NOTA_CREDITO", "NOTA_DEBITO"]),
    documentNumber: z.string().min(1, "El número de documento es obligatorio"),
    documentDate: z.date({ message: "La fecha del documento es obligatoria" }),
})

type SaleNoteFormValues = z.infer<typeof saleNoteSchema>

export interface SaleNoteFormProps {
    orderId?: number
    orderNumber?: string
    invoiceId?: number
    onSuccess?: () => void
    initialType?: "NOTA_CREDITO" | "NOTA_DEBITO"
    id?: string
    onLoadingChange?: (loading: boolean) => void
    onCancel?: () => void
}

export interface SaleNoteModalProps extends Omit<SaleNoteFormProps, "id" | "onLoadingChange" | "onCancel"> {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SaleNoteModal({ open, onOpenChange, ...props }: SaleNoteModalProps) {
    const [loading, setLoading] = useState(false)
    const formId = "modal-sale-note-form"
    // Mocked for modal footer disabled state, properly handled in form but hard to bubble up cleanly without context. 
    // Wait, the modal's SubmitButton needs to be disabled if amountNet <= 0 or !documentNumber.
    // If we use HTML form validation inside the form, we can just rely on standard form submission block.

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={
                <span className="flex items-center gap-2">
                    <FileBadge className="h-6 w-6 text-primary" />
                    Registrar Nota Crédito/Débito - {props.orderNumber ? formatEntityDisplay('sales.saleorder', { number: props.orderNumber }) : `Doc #${props.invoiceId}`}
                </span>
            }
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                            <SubmitButton
                                form={`${formId}-form`}
                                loading={loading}
                                className="h-11 px-8"
                            >
                                Confirmar Registro de Nota
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <SaleNoteForm id={formId} {...props} onSuccess={() => { onOpenChange(false); if(props.onSuccess) props.onSuccess(); }} onLoadingChange={setLoading} onCancel={() => onOpenChange(false)} />
        </BaseModal>
    )
}

export function SaleNoteForm({
    orderId,
    invoiceId,
    onSuccess,
    initialType = "NOTA_CREDITO",
    id = "sale-note-form",
    onLoadingChange,
}: SaleNoteFormProps) {
    const { rate } = useVatRate()
    const { serverDate } = useServerDate()
    const [lines, setLines] = useState<SaleNoteLine[]>([])
    const [attachment, setAttachment] = useState<File | null>(null)
    const [, setSubmitting] = useState(false)
    const [isPeriodValid, setIsPeriodValid] = useState(true)

    const form = useForm<SaleNoteFormValues>({
        resolver: zodResolver(saleNoteSchema),
        defaultValues: {
            noteType: initialType,
            documentNumber: "",
            documentDate: serverDate ?? new Date(),
        }
    })

    const noteType = form.watch("noteType")
    const documentNumber = form.watch("documentNumber")

    // Reads reactivos: solo uno de orderId/invoiceId está seteado a la vez.
    // El hook que recibe null queda disabled → no fetch.
    const { data: order, isLoading: loadingOrderFetch } = useSaleOrder(orderId ?? null)
    const { data: invoice, isLoading: loadingInvoiceFetch } = useInvoice(invoiceId ?? null)
    const loadingOrder = loadingOrderFetch || loadingInvoiceFetch

    const { registerNoteOnOrder } = useSalesOrders()
    const { registerNoteOnInvoice } = useInvoices()

    useEffect(() => {
        requestAnimationFrame(() => {
            form.setValue("documentNumber", "")
            form.setValue("documentDate", serverDate ?? new Date())
            setAttachment(null)
            // Cuando llega order o invoice de los hooks, recomponemos las líneas
            // con quantity=0 y precio unitario original.
            const fetchedLines: SaleOrderLine[] =
                (order as { lines?: SaleOrderLine[] } | null | undefined)?.lines
                ?? (invoice as { lines?: SaleOrderLine[] } | null | undefined)?.lines
                ?? []
            const initialLines: SaleNoteLine[] = fetchedLines.map((line: SaleOrderLine) => ({
                ...line,
                note_quantity: 0,
                note_unit_price: Number(line.unit_price)
            }))
            setLines(initialLines)
        })
    }, [order, invoice, form])

    const handleLineChange = (index: number, field: 'note_quantity' | 'note_unit_price', value: string) => {
        const newLines = [...lines]
        newLines[index] = {
            ...newLines[index],
            [field]: parseFloat(value) || 0
        }
        setLines(newLines)
    }

    const amountNet = lines.reduce((acc, line) => acc + (line.note_quantity * line.note_unit_price), 0)
    const amountTax = PricingUtils.calculateTax(amountNet)
    const total = amountNet + amountTax

    const onSubmit = async (values: SaleNoteFormValues) => {
        if (!isPeriodValid) {
            toast.error("El periodo seleccionado está cerrado. No puede continuar.")
            return
        }
        if (!attachment) {
            toast.error("El archivo adjunto es obligatorio para este tipo de nota")
            return
        }
        if (amountNet <= 0) {
            toast.error("El monto total de la nota debe ser mayor a 0")
            return
        }

        setSubmitting(true)
        if (onLoadingChange) onLoadingChange(true)
        try {
            const formData = new FormData()
            formData.append('note_type', values.noteType)
            formData.append('document_number', values.documentNumber)
            if (values.documentDate) {
                formData.append('document_date', values.documentDate.toISOString().split('T')[0])
            }
            formData.append('amount_net', amountNet.toString())
            formData.append('amount_tax', amountTax.toString())

            const returnItems: Array<{
                product_id: number
                quantity: number
                unit_price: number
            }> = lines
                .filter(l => l.note_quantity > 0)
                .map(l => ({
                    product_id: l.product as number,
                    quantity: l.note_quantity,
                    unit_price: l.note_unit_price
                }))

            formData.append('return_items', JSON.stringify(returnItems))

            if (invoiceId) {
                formData.append('original_invoice_id', invoiceId.toString())
            }

            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            if (orderId) {
                await registerNoteOnOrder({ orderId, payload: formData })
            } else if (invoiceId) {
                await registerNoteOnInvoice({ invoiceId, payload: formData })
            } else {
                throw new Error("No Order ID or Invoice ID provided")
            }

            toast.success("Nota registrada correctamente")
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error registering note:", error)
            showApiError(error, "Error al registrar la nota")
        } finally {
            setSubmitting(false)
            if (onLoadingChange) onLoadingChange(false)
        }
    }

    const canSubmit = documentNumber && amountNet > 0 && isPeriodValid;

    return (
        <div id={id} className="space-y-6 py-2" data-can-submit={canSubmit ? "true" : "false"}>
            <form id={`${id}-form`} onSubmit={form.handleSubmit(onSubmit)} className="hidden">
                <input type="hidden" {...form.register("noteType")} />
                <input type="hidden" {...form.register("documentNumber")} />
            </form>
            <div className="space-y-6">
                <FormSection title="Datos del Documento" icon={FileBadge} />
                <div className="grid grid-cols-2 gap-4">
                    <LabeledSelect
                        label="Tipo de Nota"
                        value={noteType}
                        onChange={(val) => form.setValue("noteType", val as "NOTA_CREDITO" | "NOTA_DEBITO")}
                        options={[
                            { value: "NOTA_CREDITO", label: "Nota de Crédito (Devolución/Resciliación)" },
                            { value: "NOTA_DEBITO", label: "Nota de Débito (Cargo Adicional)" },
                        ]}
                    />

                    <LabeledInput
                        label="Número Documento"
                        placeholder="Ej: NC-12345"
                        value={documentNumber}
                        onChange={(e) => form.setValue("documentNumber", e.target.value)}
                    />

                    <LabeledContainer label="Fecha Emisión">
                        <PeriodValidationDateInput
                            date={form.watch("documentDate")}
                            onDateChange={(d) => form.setValue("documentDate", d as Date)}
                            validationType="both"
                            onValidityChange={setIsPeriodValid}
                        />
                    </LabeledContainer>
                </div>

                <FormSection title="Detalle de Productos" icon={FileBadge} />
                <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="px-3 py-2 text-left font-black text-[10px] uppercase tracking-widest text-muted-foreground">Producto</th>
                                <th className="px-3 py-2 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-20">Unidad</th>
                                <th className="px-3 py-2 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-20">Cantidad Orig.</th>
                                <th className="px-3 py-2 text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground w-24">Cantidad Nota</th>
                                <th className="px-3 py-2 text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground w-32">Precio Unit.</th>
                                <th className="px-3 py-2 text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground w-32">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loadingOrder ? (
                                <tr>
                                    <td colSpan={6} className="p-4">
                                        <SkeletonShell isLoading ariaLabel="Cargando..." />
                                    </td>
                                </tr>
                            ) : lines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8">
                                        <EmptyState
                                            context="search"
                                            variant="compact"
                                            title="No hay productos"
                                            description="No se encontraron líneas disponibles en el documento original."
                                        />
                                    </td>
                                </tr>
                            ) : lines.map((line, idx) => (
                                <tr key={line.id} className={line.note_quantity > 0 ? "bg-primary/10/30" : ""}>
                                    <td className="px-3 py-2 font-medium">{line.product_name || line.description}</td>
                                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">{line.uom_name || '-'}</td>
                                    <td className="px-3 py-2 text-center text-muted-foreground font-bold">{line.quantity}</td>
                                    <td className="px-3 py-2">
                                        <LabeledInput
                                            type="number"
                                            className="h-8 text-center font-bold"
                                            value={line.note_quantity}
                                            min={0}
                                            max={noteType === 'NOTA_CREDITO' ? line.quantity : undefined}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                if (noteType === 'NOTA_DEBITO' || val <= line.quantity) {
                                                    handleLineChange(idx, 'note_quantity', e.target.value)
                                                }
                                            }}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px]">$</span>
                                            <LabeledInput
                                                type="number"
                                                className={`h-8 pl-5 text-right font-bold ${noteType === 'NOTA_CREDITO' ? 'bg-muted text-muted-foreground' : ''}`}
                                                value={line.note_unit_price}
                                                readOnly={noteType === 'NOTA_CREDITO'}
                                                disabled={noteType === 'NOTA_CREDITO'}
                                                onChange={(e) => handleLineChange(idx, 'note_unit_price', e.target.value)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right font-black">
                                        {formatCurrency(line.note_quantity * line.note_unit_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <FormSection title="Resumen y Respaldo" icon={FileBadge} />
                <div className="flex justify-between items-start gap-8">
                    <div className="flex-1">
                        <DocumentAttachmentDropzone
                            file={attachment}
                            onFileChange={setAttachment}
                            dteType={noteType}
                        />
                    </div>

                    <Card variant="dashed" className="w-64 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground uppercase font-bold">
                            <span>Neto:</span>
                            <span>{formatCurrency(amountNet)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground uppercase font-bold">
                            <span>IVA ({rate}%):</span>
                            <span>{formatCurrency(amountTax)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t font-black">
                            <span className="text-sm">TOTAL:</span>
                            <span className="text-xl text-primary">{formatCurrency(total)}</span>
                        </div>
                    </Card>
                </div>

                {noteType === 'NOTA_CREDITO' && (
                    <div className="flex gap-2 p-3 bg-info/5 rounded border border-info/20 text-[10px] text-info-foreground">
                        <AlertCircle className="h-4 w-4 shrink-0 text-info" />
                        <p>Si la nota implica devolución de productos, el sistema registrará una entrada de inventario (Stock IN) y reversará el costo de venta proporcionalmente.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SaleNoteModal
