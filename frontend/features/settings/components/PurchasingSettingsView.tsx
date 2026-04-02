"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
    Loader2,
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"

const purchasingSchema = z.object({
    default_expense_account: z.string().nullable(),
    default_service_expense_account: z.string().nullable(),
    default_subscription_expense_account: z.string().nullable(),
})

type PurchasingFormValues = z.infer<typeof purchasingSchema>

export function PurchasingSettingsView({ onSavingChange }: { onSavingChange?: (saving: boolean) => void }) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const form = useForm<PurchasingFormValues>({
        resolver: zodResolver(purchasingSchema),
        defaultValues: {
            default_expense_account: null,
            default_service_expense_account: null,
            default_subscription_expense_account: null,
        }
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/accounting/settings/current/')
                const settings = res.data
                const formattedSettings: any = {}

                const fields = Object.keys(form.getValues())
                fields.forEach((key: any) => {
                    const val = (settings as any)[key]
                    formattedSettings[key] = val ? val.toString() : null
                })

                form.reset(formattedSettings)
            } catch (error: any) {
                if (error.response?.status !== 404) {
                    toast.error("Error al cargar configuración")
                }
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: PurchasingFormValues) => {
        setSaving(true)
        onSavingChange?.(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            form.reset(data)
        } catch (error) {
            toast.error("Error al guardar cambios")
        } finally {
            setSaving(false)
            onSavingChange?.(false)
        }
    }, [form, onSavingChange])

    useEffect(() => {
        if (!loading && isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, loading, isDirty, form, onSubmit])

    if (loading) {
        return (
            <div className="flex h-[200px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <Form {...form}>
            <form className="space-y-6">
                <Card className="border-primary/10 shadow-sm rounded-[0.25rem]">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Cuentas de Gastos</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold">Cuentas predeterminadas para diferentes tipos de gastos</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <AccountField form={form} name="default_expense_account" label="Gastos Generales" accountType="EXPENSE" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AccountField form={form} name="default_service_expense_account" label="Gastos por Servicios" accountType="EXPENSE" />
                            <AccountField form={form} name="default_subscription_expense_account" label="Gastos por Suscripciones" accountType="EXPENSE" />
                        </div>
                    </CardContent>
                </Card>
            </form>
        </Form>
    )
}

function AccountField({ form, name, label, accountType }: { form: any, name: string, label: string, accountType: string }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">{label}</FormLabel>
                    <FormControl>
                        <AccountSelector
                            value={field.value as string}
                            onChange={(val) => field.onChange(val)}
                            accountType={accountType}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
