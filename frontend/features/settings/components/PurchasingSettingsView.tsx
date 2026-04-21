"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { FormSkeleton } from "@/components/shared/FormSkeleton"
import { AccountSelector } from "@/components/selectors/AccountSelector"

import { purchasingSchema, type PurchasingFormValues } from "./PurchasingSettingsView.schema"
import { UseFormReturn, Path } from "react-hook-form"

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
                const formattedSettings = {} as PurchasingFormValues
                const fields = Object.keys(purchasingSchema.shape) as (keyof PurchasingFormValues)[]

                fields.forEach((key) => {
                    const val = settings[key]
                    formattedSettings[key] = (val ? val.toString() : null) as never
                })

                form.reset(formattedSettings)
            } catch (error: unknown) {
                toast.error("Error al cargar configuración")
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

    if (loading) return <FormSkeleton fields={3} />

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <Form {...form}>
                <form className="space-y-6">
                    <Card className="rounded-md border-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Cuentas de Gastos Predeterminadas</CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground italic">Configuración de contrapartidas contables para compras y gastos operativos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <AccountField form={form} name="default_expense_account" label="Cuenta Gastos Generales (Insumos/Stock)" accountType="EXPENSE" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <AccountField form={form} name="default_service_expense_account" label="Gastos por Servicios Externos" accountType="EXPENSE" />
                                <AccountField form={form} name="default_subscription_expense_account" label="Gastos por Suscripciones Digitales" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>

    )
}

function AccountField({ form, name, label, accountType }: { form: UseFormReturn<PurchasingFormValues>, name: Path<PurchasingFormValues>, label: string, accountType: string }) {
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
