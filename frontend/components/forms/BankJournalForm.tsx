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
    currency: z.string().default("CLP"),
    account: z.string().min(1, "La cuenta contable es requerida"),
})

type JournalFormValues = z.infer<typeof journalSchema>

interface BankJournalFormProps {
    onSuccess?: () => void
}

export function BankJournalForm({ onSuccess }: BankJournalFormProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(journalSchema),
        defaultValues: {
            name: "",
            code: "",
            currency: "CLP",
        },
    })

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/')
            // Filter only Asset accounts in frontend or backend query
            const allAccounts = response.data.results || response.data
            setAccounts(allAccounts.filter((a: any) => a.account_type === 'ASSET'))
        } catch (error) {
            console.error("Error fetching accounts:", error)
        }
    }

    useEffect(() => {
        if (open) fetchAccounts()
    }, [open])

    async function onSubmit(data: JournalFormValues) {
        setLoading(true)
        try {
            await api.post('/treasury/journals/', data)
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error creating journal:", error)
            if (error.response?.data) {
                const data = error.response.data
                let errorMessage = "Error al crear la caja/banco"

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
                alert("Error desconocido al crear la caja/banco")
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Nueva Caja/Banco</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Crear Caja o Banco</DialogTitle>
                    <DialogDescription>
                        Ingrese los datos de la nueva cuenta de tesorería (Caja, Banco, etc).
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
                                {loading ? "Creando..." : "Crear Caja/Banco"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
