"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import api from "@/lib/api"

const formSchema = z.object({
    payment_method: z.string().min(1, "Método de pago requerido"),
    treasury_account_id: z.string().min(1, "Cuenta de origen requerida"),
    amount: z.coerce.number().min(0, "El monto debe ser mayor o igual a 0"),
    reference: z.string().optional(),
    transaction_date: z.string().default(() => new Date().toISOString().split('T')[0]),
})

interface ServicePaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    obligation: any
    onSuccess: () => void
}

export function ServicePaymentDialog({ open, onOpenChange, obligation, onSuccess }: ServicePaymentDialogProps) {
    const [accounts, setAccounts] = useState([])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            payment_method: "TRANSFER",
            amount: 0,
            reference: "",
            treasury_account_id: "",
            transaction_date: new Date().toISOString().split('T')[0],
        },
    })

    useEffect(() => {
        api.get('/treasury/accounts/').then(res => {
            setAccounts(res.data.results || res.data)
        })
    }, [])

    useEffect(() => {
        if (obligation) {
            const pendingAmount = (parseFloat(obligation.amount) || 0) - (parseFloat(obligation.paid_amount) || 0)
            form.reset({
                payment_method: "TRANSFER",
                amount: pendingAmount > 0 ? pendingAmount : 0,
                reference: "",
                treasury_account_id: "",
                transaction_date: new Date().toISOString().split('T')[0]
            })
        }
    }, [obligation, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            await api.post(`/services/obligations/${obligation.id}/register_payment/`, values)
            toast.success("Pago registrado correctamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al registrar pago")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Pago</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="transaction_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha Pago</FormLabel>
                                        <FormControl><Input type="date" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Monto a Pagar</FormLabel>
                                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="payment_method"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Medio de Pago</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                            <SelectItem value="CASH">Efectivo</SelectItem>
                                            <SelectItem value="CHECK">Cheque</SelectItem>
                                            <SelectItem value="CREDIT_CARD">Tarjeta Crédito</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="treasury_account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Origen</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar Cuenta..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts.map((acc: any) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.name} ({acc.currency})
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
                            name="reference"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Referencia / N° Comprobante</FormLabel>
                                    <FormControl><Input placeholder="Ej: 12345678" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-4">
                            <Button type="submit">Pagar</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
