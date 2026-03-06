"use client"

import React, { useEffect, useCallback } from "react"
import { useForm, UseFormReturn, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useBillingSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
    Loader2,
    Percent,
    Receipt,
    Coins,
    TrendingUp,
    Check,
    CloudUpload,
    FileText,
    Users
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"

const billingSchema = z.object({
    // Tax fields
    default_vat_rate: z.number().min(0).max(100),
    vat_payable_account: z.string().nullable(),
    vat_carryforward_account: z.string().nullable(),
    withholding_tax_account: z.string().nullable(),
    ppm_account: z.string().nullable(),
    second_category_tax_account: z.string().nullable(),
    correction_income_account: z.string().nullable(),
    default_tax_receivable_account: z.string().nullable(),
    default_tax_payable_account: z.string().nullable(),
    loan_retention_account: z.string().nullable(),
    ila_tax_account: z.string().nullable(),
    vat_withholding_account: z.string().nullable(),
    // Billing fields
    default_receivable_account: z.string().nullable(),
    default_payable_account: z.string().nullable(),
    default_advance_payment_account: z.string().nullable(),
    default_prepayment_account: z.string().nullable(),
})

type BillingFormValues = z.infer<typeof billingSchema>

interface BillingSettingsViewProps {
    activeTab: string
}

export const BillingSettingsView: React.FC<BillingSettingsViewProps> = ({ activeTab }) => {
    const { settings, saving, updateSettings } = useBillingSettings()

    const form = useForm<BillingFormValues>({
        resolver: zodResolver(billingSchema),
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
            loan_retention_account: null,
            ila_tax_account: null,
            vat_withholding_account: null,
            default_receivable_account: null,
            default_payable_account: null,
            default_advance_payment_account: null,
            default_prepayment_account: null,
        }
    })

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            const formattedSettings: Partial<BillingFormValues> = {}
            const keys = Object.keys(billingSchema.shape) as (keyof BillingFormValues)[]

            keys.forEach((key) => {
                const val = settings[key as keyof typeof settings]
                if (val === null || val === undefined) {
                    formattedSettings[key] = (key === 'default_vat_rate' ? 19.00 : null) as never
                } else if (key === 'default_vat_rate') {
                    formattedSettings[key] = parseFloat(val.toString()) as never
                } else {
                    formattedSettings[key] = val.toString() as never
                }
            })

            form.reset(formattedSettings as BillingFormValues)
        }
    }, [settings, form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: BillingFormValues) => {
        try {
            await updateSettings(data)
            form.reset(data)
        } catch {
            // Error already handled by hook
        }
    }, [updateSettings, form])

    useEffect(() => {
        if (isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, isDirty, form, onSubmit])



    const tabs = [
        { value: "accounts", label: "Cuentas por Cobrar/Pagar", iconName: "users", href: "/settings/billing?tab=accounts" },
        { value: "tax", label: "Impuestos", iconName: "receipt", href: "/settings/billing?tab=tax" },
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <PageHeader
                title="Configuración de Facturación"
                description="Gestione las cuentas de clientes, proveedores y el cumplimiento tributario."

            >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-[10px] font-medium transition-all duration-300">
                    {saving ? (
                        <>
                            <CloudUpload className="h-3 w-3 animate-pulse text-blue-500" />
                            <span className="text-blue-600">Guardando cambios...</span>
                        </>
                    ) : (
                        <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-600">Cambios guardados</span>
                        </>
                    )}
                </div>
            </PageHeader>

            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

                <Form {...form}>
                    <form className="space-y-6">
                        <TabsContent value="accounts" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Cuentas por Cobrar</CardTitle>
                                        <CardDescription>Gestión de clientes y anticipos recibidos</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <AccountField form={form} name="default_receivable_account" label="CxC Clientes (Activo)" accountType="ASSET" />
                                        <AccountField form={form} name="default_advance_payment_account" label="Anticipos de Clientes (Pasivo)" accountType="LIABILITY" />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Cuentas por Pagar</CardTitle>
                                        <CardDescription>Gestión de proveedores y anticipos entregados</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <AccountField form={form} name="default_payable_account" label="CxP Proveedores (Pasivo)" accountType="LIABILITY" />
                                        <AccountField form={form} name="default_prepayment_account" label="Anticipos a Proveedores (Activo)" accountType="ASSET" />
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="tax" className="space-y-6">
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

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <AccountField form={form} name="loan_retention_account" label="Retención Préstamo Solidario" accountType="LIABILITY" />
                                                <AccountField form={form} name="ila_tax_account" label="Impuesto ILA (Alcoholes/Bebidas)" accountType="LIABILITY" />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <AccountField form={form} name="vat_withholding_account" label="Retención IVA (Cambio Sujeto)" accountType="LIABILITY" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>
                    </form>
                </Form>
            </Tabs>
        </div>
    )
}

export default BillingSettingsView

interface AccountFieldProps {
    form: UseFormReturn<BillingFormValues>
    name: Path<BillingFormValues>
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
