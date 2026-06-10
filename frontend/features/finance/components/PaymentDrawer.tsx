"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { PaymentInitialData } from "@/types/forms"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { financeApi } from "../api/financeApi"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { CreditCard, Landmark, Wallet, ClipboardList, Printer } from "lucide-react"
import { Drawer, Skeleton, LabeledInput, LabeledSelect, FormFooter, CancelButton, ActionSlideButton, SkeletonShell, FormSplitLayout } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useBillingInvoices, usePaymentMethodsByFilter } from "@/features/finance/hooks"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { formatCurrency } from "@/lib/money"
import { ActivitySidebar } from "@/features/audit/components"
import { usePayment } from "@/features/finance/hooks/usePayment"
import type { DrawerMode } from "@/features/_shared/drawer/types"

// schema and types remain the same
const paymentSchema = z.object({
    payment_type: z.enum(["INBOUND", "OUTBOUND"]),
    payment_method: z.enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER", "CHECK"]),
    treasury_account: z.string().optional().nullable(),
    amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
    customer_id: z.string().optional().or(z.literal("")),
    supplier_id: z.string().optional().or(z.literal("")),
    invoice_id: z.string().optional().or(z.literal("")),
    reference: z.string().optional(),
    payment_method_new: z.string().optional().nullable(),
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

interface PaymentMethodOption {
    id: number | string
    name: string
    method_type: string
}

export function PaymentDrawer({
    onSuccess,
    initialData,
    open: openProp,
    onOpenChange,
    triggerText = "Registrar Pago",
    mode: modeProp,
    paymentId,
}: PaymentDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isViewMode = mode === 'view'
    const entityId = paymentId ?? initialData?.id ?? null
    const { data: paymentData, isLoading: isViewLoading } = usePayment(isViewMode ? entityId : null)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [loading, setLoading] = useState(false)

    const { data: allInvoicesData, isFetching: isFetchingInvoices } = useBillingInvoices()

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            payment_type: initialData?.payment_type || "INBOUND",
            payment_method: (initialData?.payment_method as any) || "CASH",
            treasury_account: initialData?.treasury_account?.toString() || initialData?.treasury_account_id?.toString() || null,
            amount: initialData?.amount ? parseFloat(String(initialData.amount)) : 0,
            customer_id: (initialData?.payment_type === "INBOUND" ? (initialData?.contact?.toString() || initialData?.customer?.toString() || initialData?.customer_id?.toString()) : "") || "",
            supplier_id: (initialData?.payment_type === "OUTBOUND" ? (initialData?.contact?.toString() || initialData?.supplier?.toString() || initialData?.supplier_id?.toString()) : "") || "",
            invoice_id: initialData?.invoice?.toString() || initialData?.invoice_id?.toString() || "",
            reference: initialData?.reference || initialData?.transaction_number || "",
            payment_method_new: initialData?.payment_method_new?.toString() || null,
        },
    })

    const paymentType = useWatch({ control: form.control, name: "payment_type" })
    const customerId = useWatch({ control: form.control, name: "customer_id" })
    const supplierId = useWatch({ control: form.control, name: "supplier_id" })
    const treasuryAccountId = useWatch({ control: form.control, name: "treasury_account" })

    const { data: methodsData = [], isFetching: isFetchingMethods } = usePaymentMethodsByFilter(
        treasuryAccountId
            ? {
                treasury_account: treasuryAccountId,
                ...(paymentType === "INBOUND" ? { for_sales: true } : { for_purchases: true }),
            }
            : null
    )

    const orders: InvoiceOption[] = useMemo(() => {
        if (!allInvoicesData) return []
        const results: InvoiceOption[] = (allInvoicesData as any).results || allInvoicesData || []
        if (paymentType === "INBOUND" && customerId) {
            return results.filter((i: InvoiceOption) => i.sale_order && i.sale_order.customer === parseInt(customerId) && i.status === 'POSTED')
        } else if (paymentType === "OUTBOUND" && supplierId) {
            return results.filter((i: InvoiceOption) => i.purchase_order && i.purchase_order.supplier === parseInt(supplierId) && i.status === 'POSTED')
        }
        return results
    }, [allInvoicesData, customerId, supplierId, paymentType])

    const availableMethods = methodsData as PaymentMethodOption[]

    // Auto-select first available payment method when methods load
    useEffect(() => {
        if (availableMethods.length > 0) {
            const currentPM = form.getValues("payment_method_new")
            const exists = availableMethods.find((m: PaymentMethodOption) => m.id.toString() === currentPM)
            if (!exists) {
                form.setValue("payment_method_new", availableMethods[0].id.toString())
            }
        } else if (!treasuryAccountId) {
            form.setValue("payment_method_new", null)
        }
    }, [availableMethods, treasuryAccountId, form])

    // Sync view data into form for read-only mode
    useEffect(() => {
        if (isViewMode && paymentData) {
            form.reset({
                payment_type: (paymentData.payment_type ?? paymentData.payment_type_new ?? "INBOUND") as "INBOUND" | "OUTBOUND",
                payment_method: (paymentData.payment_method ?? "CASH") as any,
                treasury_account: paymentData.treasury_account?.toString() ?? paymentData.treasury_account_id?.toString() ?? null,
                amount: paymentData.amount ? parseFloat(String(paymentData.amount)) : 0,
                customer_id: (paymentData.payment_type === "INBOUND" ? (paymentData.contact?.toString() ?? paymentData.customer?.toString() ?? paymentData.customer_id?.toString()) : "") ?? "",
                supplier_id: (paymentData.payment_type === "OUTBOUND" ? (paymentData.contact?.toString() ?? paymentData.supplier?.toString() ?? paymentData.supplier_id?.toString()) : "") ?? "",
                invoice_id: paymentData.invoice?.toString() ?? paymentData.invoice_id?.toString() ?? "",
                reference: paymentData.reference ?? paymentData.transaction_number ?? "",
                payment_method_new: paymentData.payment_method_new?.toString() ?? null,
            })
        }
    }, [isViewMode, paymentData, form])

    async function onSubmit(data: PaymentFormValues) {
        setLoading(true)
        const payload = {
            ...data,
            customer_id: (data.customer_id === "" || data.customer_id === "__none__") ? null : parseInt(data.customer_id as string),
            supplier_id: (data.supplier_id === "" || data.supplier_id === "__none__") ? null : parseInt(data.supplier_id as string),
            invoice_id: (data.invoice_id === "" || data.invoice_id === "__none__") ? null : parseInt(data.invoice_id as string),
            treasury_account_id: data.treasury_account ? parseInt(data.treasury_account) : null,
            payment_method_new: data.payment_method_new ? parseInt(data.payment_method_new) : null,
        }
        try {
            if (initialData?.id) {
                await financeApi.updatePayment(initialData.id, payload)
                toast.success("Pago actualizado")
            } else {
                await financeApi.registerPayment(payload)
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

    const drawerTitle = isViewMode
        ? `Pago #${entityId}`
        : mode === 'create'
            ? "Registrar Pago"
            : "Editar Pago"

    const drawerSubtitle = isViewMode
        ? 'Vista de detalle'
        : initialData
            ? "Actualice la información del pago."
            : "Ingrese los datos para el flujo de tesorería."

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
                            <span>{formatCurrency(Number(form.watch("amount") ?? 0))}</span>
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
                <Button className="rounded-lg shadow-md" onClick={() => setOpen(true)}>
                    {triggerText}
                </Button>
            )}
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={formDrawerWidth("medium", !!initialData?.id || !!entityId)}
                icon={Landmark}
                contentClassName="p-0"
                title={<><span>{drawerTitle}</span>{showPrintable && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}</>}
                subtitle={drawerSubtitle}
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
                        <Form {...form}>
                            <form id="payment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-4">
                                <fieldset disabled={loading || isViewMode} className="space-y-6 group">
                                    <div className="space-y-4 transition-opacity">
                                        {mode === 'create' && (
                                            <FormField
                                                control={form.control as any}
                                                name="payment_type"
                                                render={({ field, fieldState }) => (
                                                    <LabeledSelect
                                                        label="Flujo"
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
                                        <FormField
                                            control={form.control as any}
                                            name="amount"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Monto"
                                                    icon={<span className="font-bold text-muted-foreground">$</span>}
                                                    type="number"
                                                    step="0.01"
                                                    className="font-bold text-lg"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control as any}
                                            name="treasury_account"
                                            render={({ field, fieldState }) => (
                                                <TreasuryAccountSelector
                                                    label="Cuenta de Tesorería"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Seleccione cuenta..."
                                                    error={fieldState.error?.message}
                                                />
                                            )}
                                        />

                                        {availableMethods.length > 0 && (
                                            <FormField
                                                control={form.control as any}
                                                name="payment_method_new"
                                                render={({ field, fieldState }) => (
                                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                                        {isFetchingMethods ? (
                                                            <div className="h-[42px] flex items-center px-3 border border-border/50 rounded-md bg-muted/20">
                                                                <Skeleton className="h-4 w-24" />
                                                            </div>
                                                        ) : (
                                                            <LabeledSelect
                                                                label="Método Detallado"
                                                                value={field.value || ""}
                                                                onChange={field.onChange}
                                                                error={fieldState.error?.message}
                                                                placeholder="Canal de pago..."
                                                                options={availableMethods.map((m) => ({
                                                                    value: m.id.toString(),
                                                                    label: (
                                                                        <div className="flex items-center gap-2">
                                                                            {m.method_type === 'CASH' ? <Wallet className="h-3 w-3" /> :
                                                                                m.method_type === 'TRANSFER' || m.method_type === 'BANK' ? <Landmark className="h-3 w-3" /> :
                                                                                    m.method_type === 'CHECK' ? <ClipboardList className="h-3 w-3" /> :
                                                                                        <CreditCard className="h-3 w-3" />}
                                                                            {m.name}
                                                                        </div>
                                                                    )
                                                                }))}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            />
                                        )}

                                        {paymentType === "INBOUND" ? (
                                            <FormField
                                                control={form.control as any}
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
                                                control={form.control as any}
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
                                                control={form.control as any}
                                                name="invoice_id"
                                                render={({ field, fieldState }) => (
                                                    <LabeledSelect
                                                        label="Vincular Documento (Opcional)"
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
                                            control={form.control as any}
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
            </Drawer>
        </>
    )
}
