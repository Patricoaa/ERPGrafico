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
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import { toast } from "sonner"

const paymentSchema = z.object({
    payment_type: z.enum(["INBOUND", "OUTBOUND"]),
    journal_id: z.string().min(1, "El diario es requerido"),
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
    const [journals, setJournals] = useState<any[]>([])
    const [partners, setPartners] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            payment_type: "INBOUND",
            journal_id: "",
            amount: 0,
            customer_id: "",
            supplier_id: "",
            invoice_id: "",
            reference: "",
        },
    })

    const paymentType = useWatch({ control: form.control, name: "payment_type" })
    const customerId = useWatch({ control: form.control, name: "customer_id" })
    const supplierId = useWatch({ control: form.control, name: "supplier_id" })

    const fetchJournals = async () => {
        try {
            const response = await api.get('/treasury/journals/')
            setJournals(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching journals:", error)
        }
    }

    const fetchPartners = async () => {
        try {
            const endpoint = paymentType === "INBOUND" ? '/sales/customers/' : '/purchasing/suppliers/'
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
            fetchJournals()
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
            customer_id: (data.customer_id === "" || data.customer_id === "__none__") ? null : data.customer_id,
            supplier_id: (data.supplier_id === "" || data.supplier_id === "__none__") ? null : data.supplier_id,
            invoice_id: (data.invoice_id === "" || data.invoice_id === "__none__") ? null : data.invoice_id,
        }
        try {
            await api.post('/treasury/payments/register/', payload)
            toast.success("Pago registrado correctamente")
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error registering payment:", error)
            toast.error(error.response?.data?.error || "Error al registrar el pago")
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
                    <DialogTitle>Registrar Pago</DialogTitle>
                    <DialogDescription>
                        Ingrese los detalles del pago o cobro.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                        <FormField
                            control={form.control}
                            name="journal_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Caja / Banco</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione diario" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {journals.map((j) => (
                                                <SelectItem key={j.id} value={j.id.toString()}>
                                                    {j.name} ({j.currency})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name={paymentType === "INBOUND" ? "customer_id" : "supplier_id"}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{paymentType === "INBOUND" ? "Cliente" : "Proveedor"}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
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

                            <FormField
                                control={form.control}
                                name="invoice_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Factura (Opcional)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="__none__">Ninguna</SelectItem>
                                                {orders.map((o) => (
                                                    <SelectItem key={o.id} value={o.id.toString()}>
                                                        {o.dte_type_display} - {o.number || 'Pendiente'} (${Number(o.total).toLocaleString()})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                                {loading ? "Registrando..." : "Registrar Pago"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
