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
    invoice_number: z.string().min(1, "Número es requerido"),
    invoice_date: z.string().min(1, "Fecha es requerida"),
    amount: z.coerce.number().min(0, "El monto debe ser mayor o igual a 0"),
    dte_type: z.string().default("FACTURA"),
})

interface ServiceInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    obligation: any
    onSuccess: () => void
}

export function ServiceInvoiceDialog({ open, onOpenChange, obligation, onSuccess }: ServiceInvoiceDialogProps) {
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            invoice_number: "",
            invoice_date: new Date().toISOString().split('T')[0],
            dte_type: "FACTURA",
            amount: 0,
        },
    })

    useEffect(() => {
        if (obligation) {
            form.reset({
                invoice_number: "",
                invoice_date: new Date().toISOString().split('T')[0],
                amount: parseFloat(obligation.amount) || 0,
                dte_type: "FACTURA"
            })
        }
    }, [obligation, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            await api.post(`/services/obligations/${obligation.id}/register_invoice/`, values)
            toast.success("Factura registrada correctamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al registrar factura")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Documento Recibido</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="dte_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Documento</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="FACTURA">Factura</SelectItem>
                                            <SelectItem value="BOLETA">Boleta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="invoice_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>N° Documento</FormLabel>
                                        <FormControl><Input placeholder="12345" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="invoice_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha Emisión</FormLabel>
                                        <FormControl><Input type="date" {...field} /></FormControl>
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
                                    <FormLabel>Monto Total</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} value={field.value?.toString() || "0"} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-4">
                            <Button type="submit">Registrar</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
