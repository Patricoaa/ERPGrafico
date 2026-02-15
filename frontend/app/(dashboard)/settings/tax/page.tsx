"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
    Loader2,
    Save,
    Percent,
    Receipt,
    Coins,
    TrendingUp,
    CloudCheck,
    CloudUpload,
    FileText
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"

const taxSchema = z.object({
    default_vat_rate: z.number().min(0).max(100),
    vat_payable_account: z.string().nullable(),
    vat_carryforward_account: z.string().nullable(),
    withholding_tax_account: z.string().nullable(),
    ppm_account: z.string().nullable(),
    second_category_tax_account: z.string().nullable(),
    correction_income_account: z.string().nullable(),
    default_tax_receivable_account: z.string().nullable(),
    default_tax_payable_account: z.string().nullable(),
})

type TaxFormValues = z.infer<typeof taxSchema>

export default function TaxSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const form = useForm<TaxFormValues>({
        resolver: zodResolver(taxSchema),
        defaultValues: {
            default_vat_rate: 19.00,
            vat_payable_account: null,
            vat_carryforward_account: null,
            withholding_tax_account: null,
            ppm_account: null,
            second_category_tax_account: null,
            correction_income_account: null,
            default_tax_receivable_account: null,
            default_tax_payable_account: null,
        }
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/accounting/settings/current/')
                const settings = res.data
                const formattedSettings: any = {}

                // Map only the fields we care about in this page
                const fields = Object.keys(form.getValues())
                fields.forEach((key: any) => {
                    const val = (settings as any)[key]
                    if (val === null || val === undefined) {
                        formattedSettings[key] = (key === 'default_vat_rate' ? 19.00 : null)
                    } else if (key === 'default_vat_rate') {
                        formattedSettings[key] = parseFloat(val.toString())
                    } else {
                        formattedSettings[key] = val.toString()
                    }
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

    // Auto-save logic
    useEffect(() => {
        if (!loading && isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, loading, isDirty])

    async function onSubmit(data: TaxFormValues) {
        setSaving(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            toast.success("Configuración de impuestos aplicada")
            form.reset(data)
        } catch (error) {
            toast.error("Error al guardar cambios")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto">
            <PageHeader
                title="Configuración de Impuestos"
                description="Gestione las tasas impositivas y el mapeo de cuentas para el cumplimiento tributario (F29)."

            >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-[10px] font-medium transition-all duration-300">
                    {saving ? (
                        <>
                            <CloudUpload className="h-3 w-3 animate-pulse text-blue-500" />
                            <span className="text-blue-600">Guardando cambios...</span>
                        </>
                    ) : (
                        <>
                            <CloudCheck className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600">Cambios guardados</span>
                        </>
                    )}
                </div>
            </PageHeader>

            <Form {...form}>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-1">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Percent className="h-5 w-5 text-primary" />
                                    <div>
                                        <CardTitle className="text-lg text-primary">Tasa General</CardTitle>
                                        <CardDescription>Parámetros impositivos base</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="default_vat_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">IVA Predeterminado (%)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        {...field}
                                                        type="number"
                                                        step="0.01"
                                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-600">
                                    Esta tasa se aplica automáticamente a todos los documentos de venta y compra sujetos a IVA.
                                </div>
                            </CardContent>
                        </Card>

                        <div className="md:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Receipt className="h-5 w-5 text-amber-500" />
                                        <div>
                                            <CardTitle className="text-lg">Impuesto al Valor Agregado (IVA)</CardTitle>
                                            <CardDescription>Cuentas para el control mensual de IVA F29</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <AccountField form={form} name="default_tax_payable_account" label="IVA Débito Fiscal (Mensual)" accountType="LIABILITY" />
                                        <AccountField form={form} name="default_tax_receivable_account" label="IVA Crédito Fiscal (Mensual)" accountType="ASSET" />
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <AccountField form={form} name="vat_payable_account" label="IVA por Pagar (Cierre)" accountType="LIABILITY" />
                                        <AccountField form={form} name="vat_carryforward_account" label="Remanente IVA" accountType="ASSET" />
                                    </div>

                                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-700 flex items-start gap-2">
                                        <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>Al cerrar un período mensual, los saldos de Crédito y Débito se netean contra las cuentas de IVA por Pagar o Remanente.</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <Coins className="h-5 w-5 text-emerald-500" />
                                        <div>
                                            <CardTitle className="text-lg">Otras Contribuciones y Ajustes</CardTitle>
                                            <CardDescription>Retenciones, PPM y corrección monetaria</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <AccountField form={form} name="ppm_account" label="PPM por Pagar / Recuperar" accountType="ASSET" />
                                        <AccountField form={form} name="withholding_tax_account" label="Retenciones Honorarios (10.75%)" accountType="LIABILITY" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <AccountField form={form} name="second_category_tax_account" label="Impuesto Único trabajadores" accountType="LIABILITY" />
                                        <AccountField form={form} name="correction_income_account" label="IPCU / Corrección Monetaria" accountType="INCOME" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </form>
            </Form>
        </div>
    )
}

interface AccountFieldProps {
    form: any
    name: string
    label: string
    accountType: string
}

function AccountField({ form, name, label, accountType }: AccountFieldProps) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">{label}</FormLabel>
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
