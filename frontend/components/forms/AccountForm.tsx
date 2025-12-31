"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
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

const accountSchema = z.object({
    code: z.string().min(1, "El código es requerido"),
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
    parent: z.string().optional(),
})

type AccountFormValues = z.infer<typeof accountSchema>

interface AccountFormProps {
    onSuccess?: () => void
    accounts?: any[]
    initialData?: AccountFormValues & { id: number }
    triggerText?: string
}

export function AccountForm({ onSuccess, accounts = [], initialData, triggerText = "Nueva Cuenta" }: AccountFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            code: initialData?.code || "",
            name: initialData?.name || "",
            account_type: (initialData?.account_type as any) || "ASSET",
            parent: initialData?.parent || undefined,
        },
    })

    // Reset form when opening or initialData changes
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    code: initialData.code,
                    name: initialData.name,
                    account_type: initialData.account_type as any,
                    parent: initialData.parent || undefined,
                })
            } else {
                form.reset({
                    code: "",
                    name: "",
                    account_type: "ASSET",
                    parent: undefined,
                })
            }
        }
    }, [open, initialData, form])


    async function onSubmit(data: AccountFormValues) {
        setLoading(true)
        try {
            const payload = {
                ...data,
                parent: (data.parent && data.parent !== "__none__" && data.parent !== "none") ? data.parent : null,
            }

            if (initialData?.id) {
                await api.put(`/accounting/accounts/${initialData.id}/`, payload)
                toast.success("Cuenta actualizada")
            } else {
                await api.post('/accounting/accounts/', payload)
                toast.success("Cuenta creada")
            }

            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving account:", error)
            const detail = error.response?.data?.error || error.response?.data?.detail || "Error al guardar la cuenta"
            if (typeof detail === 'object') {
                // Format object errors
                const msg = Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(', ')
                toast.error(`Error: ${msg}`)
            } else {
                toast.error(detail)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant={initialData ? "ghost" : "default"} size={initialData ? "sm" : "default"}>
                    {triggerText}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Cuenta" : "Crear Cuenta Contable"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los detalles de la cuenta contable." : "Ingrese los datos de la nueva cuenta del plan de cuentas."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código</FormLabel>
                                    <FormControl>
                                        <Input placeholder="1.1.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Caja" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="ASSET">Activo</SelectItem>
                                            <SelectItem value="LIABILITY">Pasivo</SelectItem>
                                            <SelectItem value="EQUITY">Patrimonio</SelectItem>
                                            <SelectItem value="INCOME">Ingreso</SelectItem>
                                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parent"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta Padre (Opcional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sin padre" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">Sin padre</SelectItem>
                                            {accounts.filter(acc => acc.id).map((acc) => (
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
                                {loading ? "Creando..." : "Crear Cuenta"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
