"use client"

import { useState, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSelect, FormSection } from "@/components/shared"
import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { Hash, User, FileText } from "lucide-react"
import { useBillingInvoices } from "@/features/finance/hooks"

const paymentFormSchema = z.object({
    payment_type: z.enum(["INBOUND", "OUTBOUND"]),
    customer_id: z.string().optional().or(z.literal("")),
    supplier_id: z.string().optional().or(z.literal("")),
    invoice_id: z.string().optional().or(z.literal("")),
    reference: z.string().optional(),
})

export type PaymentFormValues = z.infer<typeof paymentFormSchema>

export interface PaymentFormProps {
    mode?: 'create' | 'edit'
    initialData?: Partial<PaymentFormValues> & { amount?: number }
    operation: 'sales' | 'purchases'
    onSave: (data: PaymentFormValues & { paymentData: PaymentData }) => Promise<void>
    loading?: boolean
}

export function PaymentForm({
    mode = 'create',
    initialData,
    operation,
    onSave,
    loading = false,
}: PaymentFormProps) {
    const [paymentData, setPaymentData] = useState<PaymentData>({
        method: null,
        amount: initialData?.amount || 0,
        treasuryAccountId: null,
        paymentMethodId: null,
        isPending: false,
    })

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentFormSchema),
        defaultValues: {
            payment_type: (initialData?.payment_type as "INBOUND" | "OUTBOUND") || (operation === 'sales' ? "INBOUND" : "OUTBOUND"),
            customer_id: initialData?.customer_id || "",
            supplier_id: initialData?.supplier_id || "",
            invoice_id: initialData?.invoice_id || "",
            reference: initialData?.reference || "",
        },
    })

    const paymentType = useWatch({ control: form.control, name: "payment_type" })
    const customerId = useWatch({ control: form.control, name: "customer_id" })
    const supplierId = useWatch({ control: form.control, name: "supplier_id" })

    const { data: allInvoicesData, isFetching: isFetchingInvoices } = useBillingInvoices()

    const orders: Array<{ id: number; dte_type_display: string; number: string | null; total: number }> = useMemo(() => {
        if (!allInvoicesData) return []
        const results = allInvoicesData as Array<Record<string, unknown>>
        if (paymentType === "INBOUND" && customerId) {
            return results
                .filter((i) => (i as Record<string, unknown>).sale_order && (i as Record<string, unknown>).sale_order && (i as Record<string, unknown>).status === 'POSTED')
                .map((i) => ({ id: i.id as number, dte_type_display: i.dte_type_display as string, number: i.number as string | null, total: i.total as number }))
        } else if (paymentType === "OUTBOUND" && supplierId) {
            return results
                .filter((i) => (i as Record<string, unknown>).purchase_order && (i as Record<string, unknown>).purchase_order && (i as Record<string, unknown>).status === 'POSTED')
                .map((i) => ({ id: i.id as number, dte_type_display: i.dte_type_display as string, number: i.number as string | null, total: i.total as number }))
        }
        return []
    }, [allInvoicesData, customerId, supplierId, paymentType])

    async function handleSubmit(formValues: PaymentFormValues) {
        await onSave({ ...formValues, paymentData })
    }

    return (
        <Form {...form}>
            <form id="payment-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <fieldset disabled={loading} className="space-y-6 group">
                    {mode === 'create' && (
                        <FormField
                            control={form.control}
                            name="payment_type"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Flujo"
                                    required
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                    options={[
                                        { value: "INBOUND", label: "Ingreso (Cobro)" },
                                        { value: "OUTBOUND", label: "Egreso (Pago)" }
                                    ]}
                                />
                            )}
                        />
                    )}

                    <FormSection title="Método de Pago" icon={paymentType === "INBOUND" ? User : FileText} />

                    <PaymentMethodSelector
                        operation={paymentType === "INBOUND" ? "sales" : "purchases"}
                        total={paymentData.amount}
                        paymentData={paymentData}
                        onPaymentDataChange={setPaymentData}
                        labels={{
                            totalLabel: paymentType === "INBOUND" ? "Total a Cobrar" : "Total a Pagar",
                            amountLabel: paymentType === "INBOUND" ? "Monto Recibido" : "Monto a Pagar",
                            differencePositiveLabel: "Excedente",
                            differenceNegativeLabel: "Deuda Pendiente",
                            amountModalTitle: paymentType === "INBOUND" ? "Monto Recibido" : "Monto a Pagar",
                            amountModalDescription: paymentType === "INBOUND"
                                ? "Ingrese el monto recibido."
                                : "Ingrese el monto a pagar.",
                        }}
                    />

                    <FormSection title="Contacto" icon={paymentType === "INBOUND" ? User : FileText} />

                    {paymentType === "INBOUND" ? (
                        <FormField
                            control={form.control}
                            name="customer_id"
                            render={({ field, fieldState }) => (
                                <AdvancedContactSelector
                                    label="Cliente"
                                    value={field.value === "__none__" ? "" : field.value}
                                    onChange={(val) => field.onChange(val || "")}
                                    contactType="CUSTOMER"
                                    placeholder="Buscar contacto..."
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    ) : (
                        <FormField
                            control={form.control}
                            name="supplier_id"
                            render={({ field, fieldState }) => (
                                <AdvancedContactSelector
                                    label="Proveedor"
                                    value={field.value === "__none__" ? "" : field.value}
                                    onChange={(val) => field.onChange(val || "")}
                                    contactType="SUPPLIER"
                                    placeholder="Buscar contacto..."
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                    )}

                    {mode === 'create' && (
                        <FormField
                            control={form.control}
                            name="invoice_id"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Vincular Documento (opcional)"
                                    value={field.value || "__none__"}
                                    onChange={field.onChange}
                                    disabled={isFetchingInvoices || !orders.length}
                                    error={fieldState.error?.message}
                                    placeholder="Seleccione..."
                                    options={[
                                        { value: "__none__", label: "Sin vínculo" },
                                        ...orders.map((o) => ({
                                            value: o.id.toString(),
                                            label: `${o.dte_type_display} #${o.number || 'P'} (${o.total})`
                                        }))
                                    ]}
                                />
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="reference"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Referencia / N° Operación"
                                placeholder="Ej: Transferencia Banco Estado"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                </fieldset>
            </form>
        </Form>
    )
}
