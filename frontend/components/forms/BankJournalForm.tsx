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

const journalSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    currency: z.string().min(1, "La moneda es requerida"),
    account: z.string().min(1, "La cuenta contable es requerida"),
})

type JournalFormValues = z.infer<typeof journalSchema>

interface BankJournalFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function BankJournalForm({ onSuccess, initialData, open: openProp, onOpenChange }: BankJournalFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(journalSchema),
        defaultValues: initialData ? {
            ...initialData,
            account: initialData.account?.toString() || "",
        } : {
            name: "",
            code: "",
            currency: "CLP",
        },
    })

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/?is_leaf=true')
            const allAccounts = response.data.results || response.data
            setAccounts(allAccounts.filter((a: any) => a.account_type === 'ASSET'))
        } catch (error) {
            console.error("Error fetching accounts:", error)
        }
    }

    useEffect(() => {
        if (open) fetchAccounts()
    }, [open])

    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    account: initialData.account?.id?.toString() || initialData.account?.toString() || "",
                })
            } else {
                form.reset({
                    name: "",
                    code: "",
                    currency: "CLP",
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: JournalFormValues) {
        setLoading(true)
        try {
            if (initialData) {
                await api.put(`/treasury/journals/${initialData.id}/`, data)
            } else {
                await api.post('/treasury/journals/', data)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving journal:", error)
            alert(error.response?.data?.detail || "Error al guardar la caja/banco")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Nueva Caja/Banco</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Caja o Banco" : "Crear Caja o Banco"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos de la cuenta de tesorería." : "Ingrese los datos de la nueva cuenta de tesorería (Caja, Banco, etc)."}
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
                                        <Input placeholder="Banco Estado" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código Interno</FormLabel>
                                    <FormControl>
                                        <Input placeholder="BNK-01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Moneda</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione moneda" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="CLP">CLP (Peso Chileno)</SelectItem>
                                            <SelectItem value="USD">USD (Dólar)</SelectItem>
                                            <SelectItem value="EUR">EUR (Euro)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta Contable (Activo)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta contable" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts.map((acc) => (
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
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Caja/Banco"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
