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
import { Paperclip } from "lucide-react"

const formSchema = z.object({
    invoice_number: z.string().min(1, "Número es requerido"),
    invoice_date: z.string().min(1, "Fecha es requerida"),
    amount: z.coerce.number().min(0, "El monto debe ser mayor o igual a 0"),
    dte_type: z.string().default("FACTURA"),
    document_attachment: z.any().optional(),
}).refine((data) => {
    if (data.dte_type === "FACTURA" && !data.document_attachment) {
        return false;
    }
    return true;
}, {
    message: "El adjunto es obligatorio para Facturas",
    path: ["document_attachment"],
});

interface ServiceInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    obligation: any
    onSuccess: () => void
}

export function ServiceInvoiceDialog({ open, onOpenChange, obligation, onSuccess }: ServiceInvoiceDialogProps) {
    const [file, setFile] = useState<File | null>(null)
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            invoice_number: "",
            invoice_date: new Date().toISOString().split('T')[0],
            dte_type: "FACTURA",
            amount: 0,
            document_attachment: undefined
        },
    })

    useEffect(() => {
        if (obligation) {
            form.reset({
                invoice_number: "",
                invoice_date: new Date().toISOString().split('T')[0],
                amount: parseFloat(obligation.amount) || 0,
                dte_type: "FACTURA",
                document_attachment: undefined
            })
            setFile(null)
        }
    }, [obligation, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const formData = new FormData()
            formData.append('invoice_number', values.invoice_number)
            formData.append('invoice_date', values.invoice_date)
            formData.append('amount', values.amount.toString())
            formData.append('dte_type', values.dte_type)
            if (file) {
                formData.append('document_attachment', file)
            }

            await api.post(`/services/obligations/${obligation.id}/register_invoice/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
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
            <DialogContent className="sm:max-w-[425px]">
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
                                    <FormLabel>Monto Total (Bruto)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} value={field.value?.toString() || "0"} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="document_attachment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adjunto del Documento</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="file"
                                                className="hidden"
                                                id="file-upload"
                                                accept="image/*,application/pdf"
                                                onChange={(e) => {
                                                    const files = e.target.files;
                                                    if (files && files[0]) {
                                                        setFile(files[0]);
                                                        field.onChange(files[0]);
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full flex justify-between"
                                                onClick={() => document.getElementById('file-upload')?.click()}
                                            >
                                                {file ? file.name : "Seleccionar archivo"}
                                                <Paperclip className="h-4 w-4 ml-2" />
                                            </Button>
                                        </div>
                                    </FormControl>
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
