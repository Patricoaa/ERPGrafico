"use client"

import { useState, useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
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

const paymentSchema = z.object({
    payment_type: z.enum(["INBOUND", "OUTBOUND"]),
    payment_method: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT", "OTHER"]),
    treasury_account: z.string().optional().nullable(),
    amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
    customer_id: z.string().optional().or(z.literal("")),
    supplier_id: z.string().optional().or(z.literal("")),
    invoice_id: z.string().optional().or(z.literal("")),
    reference: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

interface PaymentFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function PaymentForm({ onSuccess, initialData, open: openProp, onOpenChange }: PaymentFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])

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
        },
    })

    const paymentType = useWatch({ control: form.control, name: "payment_type" })
    const paymentMethod = useWatch({ control: form.control, name: "payment_method" })
    const customerId = useWatch({ control: form.control, name: "customer_id" })
    const supplierId = useWatch({ control: form.control, name: "supplier_id" })

    const fetchPartners = async () => {
        try {
            const endpoint = paymentType === "INBOUND" ? '/contacts/?type=customer' : '/contacts/?type=supplier'
            const response = await api.get(endpoint)
            setPartners(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching partners:", error)
        }
    }

    const fetchInvoices = async () => {
        if (!customerId && !supplierId) {
            setOrders([])
            return
        }
        try {
            const res = await api.get('/billing/invoices/')
            let results = res.data.results || res.data
            // Filter by partner and status posted
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
        if (open) {
            fetchPartners()
        }
    }, [open, paymentType])

    useEffect(() => {
        fetchInvoices()
    }, [customerId, supplierId, paymentType])

    async function onSubmit(data: PaymentFormValues) {
        setLoading(true)
        const payload = {
            ...data,
            customer_id: (data.customer_id === "" || data.customer_id === "__none__") ? null : parseInt(data.customer_id as string),
            supplier_id: (data.supplier_id === "" || data.supplier_id === "__none__") ? null : parseInt(data.supplier_id as string),
            invoice_id: (data.invoice_id === "" || data.invoice_id === "__none__") ? null : parseInt(data.invoice_id as string),
            treasury_account_id: data.treasury_account ? parseInt(data.treasury_account) : null,
        }
        try {
            if (initialData?.id) {
                await api.patch(`/treasury/payments/${initialData.id}/`, payload)
                toast.success("Pago actualizado correctamente")
            } else {
                await api.post('/treasury/payments/register/', payload)
                toast.success("Pago registrado correctamente")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving payment:", error)
            toast.error(error.response?.data?.error || "Error al guardar el pago")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Registrar Pago</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Pago" : "Registrar Pago"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los detalles del pago." : "Ingrese los detalles del pago o cobro."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {!initialData && (
                            <FormField
                                control={form.control}
                                name="payment_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Pago</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="INBOUND">Cobro (Cliente)</SelectItem>
                                                <SelectItem value="OUTBOUND">Pago (Proveedor)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="payment_method"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Método</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione método" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="CASH">Efectivo</SelectItem>
                                                <SelectItem value="CARD">Tarjeta</SelectItem>
                                                <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                                <SelectItem value="CREDIT">Crédito</SelectItem>
                                                <SelectItem value="OTHER">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="treasury_account"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cuenta (Opcional)</FormLabel>
                                        <FormControl>
                                            <TreasuryAccountSelector
                                                value={field.value}
                                                onChange={field.onChange}
                                                type={paymentMethod === 'CASH' ? 'CASH' : (paymentMethod === 'TRANSFER' || paymentMethod === 'CARD') ? 'BANK' : undefined}
                                                placeholder="Predeterminada"
                                                disabled={paymentMethod === 'CREDIT'}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name={paymentType === "INBOUND" ? "customer_id" : "supplier_id"}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Proveedor/Cliente</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="__none__">Ninguno</SelectItem>
                                                {partners.filter(p => p.id).map((p) => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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
                                            <FormLabel>Factura (Opcional)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccione..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="__none__">Ninguna</SelectItem>
                                                    {orders.map((o) => (
                                                        <SelectItem key={o.id} value={o.id.toString()}>
                                                            {o.dte_type_display} - {o.number || 'Pendiente'} ({o.total})
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
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Monto</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            {...field}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reference"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Referencia / N° Operación</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Transf #12345" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end space-x-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : (initialData ? "Guardar Cambios" : "Registrar Pago")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
