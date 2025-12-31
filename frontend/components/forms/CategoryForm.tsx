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

const categorySchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    parent: z.string().optional(),
    asset_account: z.string().optional(),
    income_account: z.string().optional(),
    expense_account: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface CategoryFormProps {
    onSuccess?: () => void
}

export function CategoryForm({ onSuccess }: CategoryFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: "",
        },
    })

    const fetchData = async () => {
        try {
            const [catsRes, accsRes] = await Promise.all([
                api.get('/inventory/categories/'),
                api.get('/accounting/accounts/')
            ])
            setCategories(catsRes.data)
            setAccounts(accsRes.data.results || accsRes.data)
        } catch (error) {
            console.error("Error fetching dependencies:", error)
        }
    }

    useEffect(() => {
        if (open) fetchData()
    }, [open])

    async function onSubmit(data: CategoryFormValues) {
        setLoading(true)
        try {
            await api.post('/inventory/categories/', {
                ...data,
                parent: (data.parent && data.parent !== "none") ? data.parent : null,
                asset_account: (data.asset_account && data.asset_account !== "none") ? data.asset_account : null,
                income_account: (data.income_account && data.income_account !== "none") ? data.income_account : null,
                expense_account: (data.expense_account && data.expense_account !== "none") ? data.expense_account : null,
            })
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error creating category:", error)
            if (error.response?.data) {
                const data = error.response.data
                let errorMessage = "Error al crear la categoría"

                if (data.detail) {
                    errorMessage = data.detail
                } else {
                    const fieldErrors = Object.keys(data).map(key => {
                        const messages = Array.isArray(data[key]) ? data[key].join(", ") : data[key]
                        return `${key}: ${messages}`
                    }).join("\n")
                    if (fieldErrors) errorMessage = fieldErrors
                }
                alert(errorMessage)
            } else {
                alert("Error desconocido al crear la categoría")
            }
        } finally {
            setLoading(false)
        }
    }

    const assetAccounts = accounts.filter(a => a.account_type === 'ASSET')
    const incomeAccounts = accounts.filter(a => a.account_type === 'INCOME')
    const expenseAccounts = accounts.filter(a => a.account_type === 'EXPENSE')

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Nueva Categoría</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Crear Categoría</DialogTitle>
                    <DialogDescription>
                        Ingrese los datos de la nueva categoría y sus cuentas contables asociadas.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Insumos" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parent"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría Padre (Opcional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sin padre" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Sin padre</SelectItem>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                                    {cat.name}
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
                            name="asset_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Activo (Inventario)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Ninguna</SelectItem>
                                            {assetAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.code} - {acc.name}
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
                            name="income_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Ingresos (Ventas)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Ninguna</SelectItem>
                                            {incomeAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.code} - {acc.name}
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
                            name="expense_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Gastos (Costo)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Ninguna</SelectItem>
                                            {expenseAccounts.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.code} - {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Creando..." : "Crear Categoría"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
