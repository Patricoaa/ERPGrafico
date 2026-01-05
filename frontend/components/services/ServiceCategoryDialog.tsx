"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
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
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import api from "@/lib/api"
import { toast } from "sonner"

const formSchema = z.object({
    name: z.string().min(2, "El nombre es muy corto"),
    code: z.string().min(2, "El código es muy corto").max(20, "El código es muy largo"),
    expense_account: z.string().min(1, "Debe seleccionar cuenta de gasto"),
    payable_account: z.string().min(1, "Debe seleccionar cuenta por pagar"),
    requires_provision: z.boolean().default(false),
})

interface ServiceCategoryDialogProps {
    children?: React.ReactNode
    initialData?: any
    onSuccess?: () => void
}

export function ServiceCategoryDialog({ children, initialData, onSuccess }: ServiceCategoryDialogProps) {
    const [open, setOpen] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            code: "",
            expense_account: "",
            payable_account: "",
            requires_provision: false,
            ...initialData
        },
    })

    useEffect(() => {
        if (initialData) {
            form.reset({
                requires_provision: false,
                ...initialData,
                expense_account: initialData.expense_account?.toString(),
                payable_account: initialData.payable_account?.toString(),
            })
        }
    }, [initialData, form])

    useEffect(() => {
        const loadAccounts = async () => {
            try {
                const res = await api.get('/accounting/accounts/')
                setAccounts(res.data.results || res.data)
            } catch (e) {
                console.error(e)
                toast.error("Error cargando cuentas")
            }
        }
        loadAccounts()
    }, [])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            if (initialData?.id) {
                await api.patch(`/services/categories/${initialData.id}/`, values)
                toast.success("Categoría actualizada exitosamente")
            } else {
                await api.post("/services/categories/", values)
                toast.success("Categoría creada exitosamente")
            }

            setOpen(false)
            if (onSuccess) onSuccess()
            form.reset()
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al guardar categoría")
        }
    }

    const expenseAccounts = accounts.filter((a: any) => a.account_type === 'EXPENSE')
    const liabilityAccounts = accounts.filter((a: any) => a.account_type === 'LIABILITY')

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Categoría' : 'Nueva Categoría de Servicio'}</DialogTitle>
                    <DialogDescription>
                        Configure las cuentas contables y propiedades de la categoría.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre</FormLabel>
                                        <FormControl><Input placeholder="Ej: Arriendo" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Código</FormLabel>
                                        <FormControl><Input placeholder="Ej: ARR" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="expense_account"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cuenta de Gasto</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {expenseAccounts.map((a: any) => (
                                                    <SelectItem key={a.id} value={a.id.toString()}>
                                                        {a.code} - {a.name}
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
                                name="payable_account"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cuenta por Pagar</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {liabilityAccounts.map((a: any) => (
                                                    <SelectItem key={a.id} value={a.id.toString()}>
                                                        {a.code} - {a.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="requires_provision"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel>Requiere Provisión Mensual</FormLabel>
                                            <FormDescription>
                                                Generar provisiones contables mensuales para este tipo de servicio
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                {initialData ? 'Actualizar' : 'Crear'} Categoría
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
