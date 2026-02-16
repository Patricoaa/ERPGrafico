"use client"

import { useState, useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"

// ... other imports same
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { toast } from "sonner"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { Loader2, CreditCard, Landmark, Wallet, ClipboardList } from "lucide-react"

// schema and types remain the same
const paymentSchema = z.object({
    payment_type: z.enum(["INBOUND", "OUTBOUND"]),
    payment_method: z.enum(["CASH", "DEBIT_CARD", "CREDIT_CARD", "CARD_TERMINAL", "TRANSFER", "CHECK"]),
    treasury_account: z.string().optional().nullable(),
    amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
    customer_id: z.string().optional().or(z.literal("")),
    supplier_id: z.string().optional().or(z.literal("")),
    invoice_id: z.string().optional().or(z.literal("")),
    reference: z.string().optional(),
    payment_method_new: z.string().optional().nullable(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

interface PaymentFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
    triggerText?: string
}

export function PaymentForm({
    onSuccess,
    initialData,
    open: openProp,
    onOpenChange,
    triggerText = "Registrar Pago"
}: PaymentFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [orders, setOrders] = useState<any[]>([])
    const [availableMethods, setAvailableMethods] = useState<any[]>([])

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            payment_type: initialData?.payment_type || "INBOUND",
            payment_method: initialData?.payment_method || "CASH",
            treasury_account: initialData?.treasury_account?.toString() || initialData?.treasury_account_id?.toString() || null,
            amount: initialData?.amount ? parseFloat(initialData.amount) : 0,
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

    const fetchInvoices = async () => {
        if (!customerId && !supplierId) {
            setOrders([])
            return
        }
        try {
            const res = await api.get('/billing/invoices/')
            let results = res.data.results || res.data
            if (paymentType === "INBOUND" && customerId) {
                results = results.filter((i: any) => i.sale_order && i.sale_order.customer === parseInt(customerId) && i.status === 'POSTED')
            } else if (paymentType === "OUTBOUND" && supplierId) {
                results = results.filter((i: any) => i.purchase_order && i.purchase_order.supplier === parseInt(supplierId) && i.status === 'POSTED')
            }
            setOrders(results)
        } catch (error) {
            console.error("Error fetching invoices:", error)
        }
    }

    useEffect(() => {
        fetchInvoices()
    }, [customerId, supplierId, paymentType])

    // Load detailed payment methods when account changes
    useEffect(() => {
        const fetchAccountMethods = async () => {
            if (treasuryAccountId) {
                try {
                    const direction = paymentType === "INBOUND" ? "for_sales=true" : "for_purchases=true"
                    const res = await api.get(`/treasury/payment-methods/?treasury_account=${treasuryAccountId}&${direction}`)
                    const methods = res.data || []
                    setAvailableMethods(methods)

                    if (methods.length > 0) {
                        const currentPM = form.getValues("payment_method_new")
                        const exists = methods.find((m: any) => m.id.toString() === currentPM)
                        if (!exists) {
                            form.setValue("payment_method_new", methods[0].id.toString())
                        }
                    } else {
                        form.setValue("payment_method_new", null)
                    }
                } catch (err) {
                    setAvailableMethods([])
                }
            } else {
                setAvailableMethods([])
                form.setValue("payment_method_new", null)
            }
        }
        fetchAccountMethods()
    }, [treasuryAccountId, paymentType, form])

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
                await api.patch(`/treasury/payments/${initialData.id}/`, payload)
                toast.success("Pago actualizado")
            } else {
                await api.post('/treasury/payments/register_movement/', payload)
                toast.success("Movimiento registrado")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar")
        } finally {
            setLoading(false)
        }
    }

    const Trigger = () => {
        if (openProp !== undefined) return null;
        if (initialData) return null;

        return (
            <Button className="rounded-xl shadow-md" onClick={() => setOpen(true)}>
                {triggerText}
            </Button>
        )
    }

    return (
        <>
            <Trigger />
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="lg"
                title={initialData ? "Editar Pago" : "Registrar Pago"}
                description={initialData ? "Actualice la información del pago." : "Ingrese los datos para el flujo de tesorería."}
                footer={
                    <div className="flex justify-end space-x-2 w-full">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button type="submit" form="payment-form" disabled={loading} className="px-8 shadow-lg">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {initialData ? "Actualizar" : "Registrar Pago"}
                        </Button>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="payment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                            {!initialData && (
                                <FormField
                                    control={form.control}
                                    name="payment_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase tracking-wider opacity-70">Flujo</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="INBOUND">Ingreso (Cobro)</SelectItem>
                                                    <SelectItem value="OUTBOUND">Egreso (Pago)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem className={cn(!initialData ? "" : "col-span-2")}>
                                        <FormLabel className="text-xs font-bold uppercase tracking-wider opacity-70">Monto</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    className="pl-7 font-bold text-lg bg-white"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="treasury_account"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Cuenta de Tesorería</FormLabel>
                                            <FormControl>
                                                <TreasuryAccountSelector
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Seleccione cuenta..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {availableMethods.length > 0 && (
                                    <FormField
                                        control={form.control}
                                        name="payment_method_new"
                                        render={({ field }) => (
                                            <FormItem className="animate-in slide-in-from-top-2 duration-300">
                                                <FormLabel className={FORM_STYLES.label}>Método Detallado</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                                    <FormControl>
                                                        <SelectTrigger className="border-blue-200 bg-blue-50/30">
                                                            <SelectValue placeholder="Canal de pago..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {availableMethods.map((m) => (
                                                            <SelectItem key={m.id} value={m.id.toString()}>
                                                                <div className="flex items-center gap-2">
                                                                    {m.method_type === 'CASH' ? <Wallet className="h-3 w-3" /> :
                                                                        m.method_type === 'TRANSFER' || m.method_type === 'BANK' ? <Landmark className="h-3 w-3" /> :
                                                                            m.method_type === 'CHECK' ? <ClipboardList className="h-3 w-3" /> :
                                                                                <CreditCard className="h-3 w-3" />}
                                                                    {m.name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name={paymentType === "INBOUND" ? "customer_id" : "supplier_id"}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>{paymentType === "INBOUND" ? "Cliente" : "Proveedor"}</FormLabel>
                                            <FormControl>
                                                <AdvancedContactSelector
                                                    value={field.value === "__none__" ? "" : field.value}
                                                    onChange={(val) => field.onChange(val || "")}
                                                    contactType={paymentType === "INBOUND" ? "CUSTOMER" : "SUPPLIER"}
                                                    placeholder="Buscar contacto..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {!initialData && (
                                    <FormField
                                        control={form.control}
                                        name="invoice_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={FORM_STYLES.label}>Vincular Documento (Opcional)</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccione..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Sin vínculo</SelectItem>
                                                        {orders.map((o) => (
                                                            <SelectItem key={o.id} value={o.id.toString()}>
                                                                {o.dte_type_display} #{o.number || 'P'} ({o.total})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>

                            <FormField
                                control={form.control}
                                name="reference"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Referencia / N° Operación</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Transferencia Banco Estado" {...field} className="bg-white" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}
