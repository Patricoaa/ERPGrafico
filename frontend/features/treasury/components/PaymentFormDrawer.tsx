"use client"

import { showApiError } from "@/lib/errors"
import { useState, useMemo } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm, useWatch } from "react-hook-form"
import { type PaymentInitialData } from "@/types/forms"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { financeApi } from "@/features/finance/api/financeApi"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { Landmark, ArrowRightLeft, Hash, Wallet, ClipboardList, CreditCard } from "lucide-react"
import { Drawer, LabeledInput, LabeledSelect, FormFooter, CancelButton, ActionSlideButton, SkeletonShell, FormSplitLayout, StatusBadge } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useBillingInvoices } from "@/features/finance"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { formatCurrency } from "@/lib/money"
import { ActivitySidebar } from "@/features/audit"
import { usePayment } from "@/features/treasury/hooks/usePayment"
import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"

const paymentSchema = z.object({
    payment_type: z.enum(["INBOUND", "OUTBOUND"]),
    customer_id: z.string().optional().or(z.literal("")),
    supplier_id: z.string().optional().or(z.literal("")),
    invoice_id: z.string().optional().or(z.literal("")),
    reference: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

interface InvoiceOption {
    id: number
    dte_type_display: string
    number: string | null
    total: number
    sale_order?: { customer: number }
    purchase_order?: { supplier: number }
    status: string
}

interface PaymentFormDrawerProps {
    onSuccess?: () => void
    initialData?: PaymentInitialData
    triggerText?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
    mode?: DrawerMode
    paymentId?: number
}

export function PaymentFormDrawer({
    onSuccess,
    initialData,
    triggerText = "Registrar Pago",
    open: openProp,
    onOpenChange,
    inline = false,
    onLoadingChange,
    mode: modeProp,
    paymentId,
}: PaymentFormDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const entityId = paymentId ?? initialData?.id ?? null
    const mode: DrawerMode = modeProp ?? (entityId ? 'edit' : 'create')
    const isViewMode = mode === 'view'
    const { data: paymentData, isLoading: isViewLoading } = usePayment(isViewMode ? entityId : null)
    const { printRef, handlePrint } = usePrintableDrawer()

    const [loading, setLoading] = useState(false)

    const [paymentDataState, setPaymentDataState] = useState<PaymentData>({
        method: null,
        amount: initialData?.amount ? parseFloat(String(initialData.amount)) : 0,
        treasuryAccountId: initialData?.treasury_account?.toString() || initialData?.treasury_account_id?.toString() || null,
        paymentMethodId: initialData?.payment_method_new ? parseInt(initialData.payment_method_new.toString()) : null,
        isPending: false,
    })

    const { data: allInvoicesData, isFetching: isFetchingInvoices } = useBillingInvoices()

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            payment_type: initialData?.payment_type || "INBOUND",
            customer_id: (initialData?.payment_type === "INBOUND" ? (initialData?.contact?.toString() || initialData?.customer?.toString() || initialData?.customer_id?.toString()) : "") || "",
            supplier_id: (initialData?.payment_type === "OUTBOUND" ? (initialData?.contact?.toString() || initialData?.supplier?.toString() || initialData?.supplier_id?.toString()) : "") || "",
            invoice_id: initialData?.invoice?.toString() || initialData?.invoice_id?.toString() || "",
            reference: initialData?.reference || "",
        },
    })

    const paymentType = useWatch({ control: form.control, name: "payment_type" })
    const customerId = useWatch({ control: form.control, name: "customer_id" })
    const supplierId = useWatch({ control: form.control, name: "supplier_id" })

    const orders: InvoiceOption[] = useMemo(() => {
        if (!allInvoicesData) return []
        const results: InvoiceOption[] = (allInvoicesData as unknown as InvoiceOption[]) ?? []
        if (paymentType === "INBOUND" && customerId) {
            return results.filter((i: InvoiceOption) => i.sale_order && i.sale_order.customer === parseInt(customerId) && i.status === 'POSTED')
        } else if (paymentType === "OUTBOUND" && supplierId) {
            return results.filter((i: InvoiceOption) => i.purchase_order && i.purchase_order.supplier === parseInt(supplierId) && i.status === 'POSTED')
        }
        return results
    }, [allInvoicesData, customerId, supplierId, paymentType])

    useInitializeDrawerForm({
        form,
        open,
        initialData: paymentData ?? initialData,
        defaultValues: () => ({
            payment_type: "INBOUND" as const,
            customer_id: "",
            supplier_id: "",
            invoice_id: "",
            reference: "",
        }),
        mapData: (data) => ({
            payment_type: (data.payment_type ?? (data as { payment_type_new?: string }).payment_type_new ?? "INBOUND") as "INBOUND" | "OUTBOUND",
            customer_id: (data.payment_type === "INBOUND" ? (data.contact?.toString() ?? data.customer?.toString() ?? (data as { customer_id?: number | string }).customer_id?.toString()) : "") ?? "",
            supplier_id: (data.payment_type === "OUTBOUND" ? (data.contact?.toString() ?? data.supplier?.toString() ?? (data as { supplier_id?: number | string }).supplier_id?.toString()) : "") ?? "",
            invoice_id: data.invoice?.toString() ?? (data as { invoice_id?: number | string }).invoice_id?.toString() ?? "",
            reference: data.reference ?? "",
        }),
    })

    async function onSubmit(data: PaymentFormValues) {
        setLoading(true)
        const payload = {
            ...data,
            amount: paymentDataState.amount,
            payment_method: paymentDataState.method || 'CASH',
            treasury_account_id: paymentDataState.amount === 0 ? null : paymentDataState.treasuryAccountId,
            payment_method_new: paymentDataState.amount === 0 ? null : paymentDataState.paymentMethodId?.toString(),
            customer_id: (data.customer_id === "" || data.customer_id === "__none__") ? null : parseInt(data.customer_id as string),
            supplier_id: (data.supplier_id === "" || data.supplier_id === "__none__") ? null : parseInt(data.supplier_id as string),
            invoice_id: (data.invoice_id === "" || data.invoice_id === "__none__") ? null : parseInt(data.invoice_id as string),
        }
        try {
            if (initialData?.id) {
                await financeApi.updatePayment(initialData.id, payload)
                toast.success("Pago actualizado")
            } else {
                const idempotencyKey = crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16) })
                await financeApi.registerPayment(payload, idempotencyKey)
                toast.success("Movimiento registrado")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            showApiError(error, "Error al registrar")
        } finally {
            setLoading(false)
        }
    }

    const identity = useDrawerIdentity('finance.payment', mode, initialData as Record<string, unknown> | undefined, {
        overrideTitle: mode === 'edit'
            ? "Editar Pago"
            : "Registrar Pago",
        overrideSubtitle: initialData
            ? "Actualice la información del pago."
            : "Ingrese los datos para el flujo de tesorería.",
        printable: !!entityId && (mode === 'view' || mode === 'edit'),
        onPrint: handlePrint,
    })

    const showPrintable = entityId && (mode === 'view' || mode === 'edit')

    const formContent = (
        <SkeletonShell isLoading={false} ariaLabel="Cargando pago" className="flex-1 flex flex-col">
            <FormSplitLayout sidebar={undefined} showSidebar={false}>
                <Form {...form}>
                    <form id="payment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-4">
                        <fieldset disabled={loading} className="space-y-6 group">
                            <div className="space-y-4 transition-opacity">
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
                            </div>

                            <PaymentMethodSelector
                                operation={paymentType === "INBOUND" ? "sales" : "purchases"}
                                total={paymentDataState.amount}
                                paymentData={paymentDataState}
                                onPaymentDataChange={setPaymentDataState}
                                labels={{
                                    totalLabel: paymentType === "INBOUND" ? "Total a Cobrar" : "Total a Pagar",
                                    amountLabel: paymentType === "INBOUND" ? "Monto Recibido" : "Monto a Pagar",
                                    differencePositiveLabel: "Excedente",
                                    differenceNegativeLabel: "Deuda Pendiente",
                                    amountModalTitle: paymentType === "INBOUND" ? "Monto Recibido" : "Monto a Pagar",
                                }}
                            />

                            <div className="space-y-4">

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
                                                disabled={isFetchingInvoices}
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
                            </div>
                        </fieldset>
                    </form>
                </Form>
            </FormSplitLayout>
        </SkeletonShell>
    )

    if (inline) {
        return <>{formContent}</>
    }

    return (
        <>
            {showPrintable && (
                <PrintableLayout
                    ref={printRef}
                    title="Comprobante de Pago"
                    displayId={`#${entityId}`}
                >
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Monto:</span>
                            <span>{formatCurrency(Number(paymentDataState.amount ?? 0))}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Método:</span>
                            <span>-</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Referencia:</span>
                            <span>{form.watch("reference") || '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            {!isViewMode && openProp === undefined && !initialData && (
                <Button className="rounded-sm shadow-elevated" onClick={() => setOpen(true)}>
                    {triggerText}
                </Button>
            )}
            <Drawer
                fillContent
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={formDrawerWidth("medium", !!initialData?.id || !!entityId)}
                icon={identity.icon}
                contentClassName="p-0"
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                mode={mode}
                footer={isViewMode ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <ActionSlideButton type="submit" form="payment-form" loading={loading}>
                                    {initialData ? "Actualizar" : "Registrar Pago"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                {formContent}
            </Drawer>
        </>
    )
}