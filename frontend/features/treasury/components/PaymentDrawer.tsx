"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo, useRef } from "react"
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
import { Landmark, Printer, ArrowRightLeft, Hash, Wallet, ClipboardList, CreditCard } from "lucide-react"
import { Drawer, LabeledInput, LabeledSelect, FormFooter, CancelButton, ActionSlideButton, SkeletonShell, FormSplitLayout, StatusBadge } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useBillingInvoices } from "@/features/finance/hooks"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { formatCurrency } from "@/lib/money"
import { ActivitySidebar } from "@/features/audit/components"
import { usePayment } from "@/features/treasury/hooks/usePayment"
import { PaymentMethodSelector, type PaymentData } from "@/features/treasury"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"

const paymentSchema = z.object({
    payment_type: z.enum(["INBOUND", "OUTBOUND"]),
    customer_id: z.string().optional().or(z.literal("")),
    supplier_id: z.string().optional().or(z.literal("")),
    invoice_id: z.string().optional().or(z.literal("")),
    reference: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

interface PaymentDrawerProps {
    onSuccess?: () => void
    initialData?: PaymentInitialData
    open?: boolean
    onOpenChange?: (open: boolean) => void
    triggerText?: string
    mode?: DrawerMode
    paymentId?: number
}

interface InvoiceOption {
    id: number
    dte_type_display: string
    number: string | null
    total: number
    sale_order?: { customer: number }
    purchase_order?: { supplier: number }
    status: string
}

export function PaymentDrawer({
    onSuccess,
    initialData,
    open: openProp,
    onOpenChange,
    triggerText = "Registrar Pago",
    mode: modeProp,
    paymentId,
    id,
}: PaymentDrawerProps & { id?: number | null }) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const entityId = paymentId ?? id ?? initialData?.id ?? null
    const mode: DrawerMode = modeProp ?? (entityId ? 'view' : initialData ? 'edit' : 'create')
    const isViewMode = mode === 'view'
    const { data: paymentData, isLoading: isViewLoading } = usePayment(isViewMode ? entityId : null)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

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

    useEffect(() => {
        if (isViewMode && paymentData) {
            form.reset({
                payment_type: (paymentData.payment_type ?? paymentData.payment_type_new ?? "INBOUND") as "INBOUND" | "OUTBOUND",
                customer_id: (paymentData.payment_type === "INBOUND" ? (paymentData.contact?.toString() ?? paymentData.customer?.toString() ?? paymentData.customer_id?.toString()) : "") ?? "",
                supplier_id: (paymentData.payment_type === "OUTBOUND" ? (paymentData.contact?.toString() ?? paymentData.supplier?.toString() ?? paymentData.supplier_id?.toString()) : "") ?? "",
                invoice_id: paymentData.invoice?.toString() ?? paymentData.invoice_id?.toString() ?? "",
                reference: paymentData.reference ?? "",
            })
        }
    }, [isViewMode, paymentData, form])

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

    const identity = useDrawerIdentity('finance.payment', mode, paymentData ?? (entityId ? { id: entityId } : undefined), {
        customTitle: isViewMode
            ? `Pago #${entityId}`
            : mode === 'create'
                ? "Registrar Pago"
                : "Editar Pago",
        subtitle: isViewMode
            ? 'Vista de detalle'
            : initialData
                ? "Actualice la información del pago."
                : "Ingrese los datos para el flujo de tesorería.",
    })

    const showPrintable = entityId && (mode === 'view' || mode === 'edit')

    return (
        <>
            {showPrintable && (
                <PrintableLayout
                    ref={printRef}
                    title="Comprobante de Pago"
                    displayId={`#${entityId}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
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
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={formDrawerWidth("medium", !!initialData?.id || !!entityId)}
                icon={identity.icon}
                contentClassName="p-0"
                title={identity.title}
                headerActions={showPrintable && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
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
                <SkeletonShell isLoading={isViewMode && isViewLoading} ariaLabel="Cargando pago" className="flex-1 flex flex-col">
                    <FormSplitLayout sidebar={entityId ? <ActivitySidebar entityType="payment" entityId={entityId} /> : undefined} showSidebar={!!entityId}>
                        {isViewMode && paymentData ? (
                            <div className="p-4 space-y-5">
                                <StatusBadge status={paymentData.status} />

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-xs text-muted-foreground">Monto</span>
                                        <p className="font-bold text-lg">{formatCurrency(Number(paymentData.amount))}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Flujo</span>
                                        <p className="font-medium flex items-center gap-1.5 mt-0.5">
                                            <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                            {paymentData.movement_type_display || paymentData.payment_type}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-xs text-muted-foreground">Método de Pago</span>
                                        <p className="font-medium flex items-center gap-1.5 mt-0.5">
                                            {paymentData.payment_method_new_method_type === 'CASH' ? <Wallet className="h-3.5 w-3.5 text-muted-foreground" /> :
                                                paymentData.payment_method_new_method_type === 'TRANSFER' || paymentData.payment_method_new_method_type === 'BANK' ? <Landmark className="h-3.5 w-3.5 text-muted-foreground" /> :
                                                    paymentData.payment_method_new_method_type === 'CHECK' ? <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" /> :
                                                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
                                            {paymentData.payment_method_new_name || paymentData.payment_method_display || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Referencia</span>
                                        <p className="font-medium flex items-center gap-1.5 mt-0.5">
                                            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                            {paymentData.reference || '-'}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {paymentData.partner_name && (
                                        <div>
                                            <span className="text-xs text-muted-foreground">Contacto</span>
                                            <p className="font-medium mt-0.5">{paymentData.partner_name}</p>
                                        </div>
                                    )}
                                    {paymentData.display_id && (
                                        <div>
                                            <span className="text-xs text-muted-foreground">ID Movimiento</span>
                                            <p className="font-medium mt-0.5">{paymentData.display_id}</p>
                                        </div>
                                    )}
                                </div>

                                {paymentData.notes && (
                                    <div>
                                        <span className="text-xs text-muted-foreground">Notas</span>
                                        <p className="text-sm mt-0.5 text-foreground/80">{paymentData.notes}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
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
                                                amountModalDescription: paymentType === "INBOUND"
                                                    ? "Ingrese el monto recibido."
                                                    : "Ingrese el monto a pagar.",
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
                        )}
                    </FormSplitLayout>
                </SkeletonShell>
            </Drawer>
        </>
    )
}
