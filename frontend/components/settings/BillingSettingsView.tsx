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

const accountIdSchema = z.union([z.string(), z.number()]).nullable()

const billingSchema = z.object({
    // Tax fields
    default_vat_rate: z.number().min(0).max(100),
    vat_payable_account: accountIdSchema,
    vat_carryforward_account: accountIdSchema,
    withholding_tax_account: accountIdSchema,
    ppm_account: accountIdSchema,
    second_category_tax_account: accountIdSchema,
    correction_income_account: accountIdSchema,
    default_tax_receivable_account: accountIdSchema,
    default_tax_payable_account: accountIdSchema,
    loan_retention_account: accountIdSchema,
    ila_tax_account: accountIdSchema,
    vat_withholding_account: accountIdSchema,
    // Billing fields
    default_receivable_account: accountIdSchema,
    default_payable_account: accountIdSchema,
    default_advance_payment_account: accountIdSchema,
    default_prepayment_account: accountIdSchema,
    // DTE Configuration
    allowed_dte_types_emit: z.array(z.string()),
    allowed_dte_types_receive: z.array(z.string()),
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
            allowed_dte_types_emit: [],
            allowed_dte_types_receive: [],
        }
    })

    const watchedValues = form.watch()
    const { isDirty, errors } = form.formState

    const onSubmit = useCallback(async (data: BillingFormValues) => {
        try {
            await updateSettings(data as any)
            form.reset(data)
        } catch {
            // Error already handled by hook
        }
    }, [updateSettings, form])

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            const formattedSettings: Partial<BillingFormValues> = {}
            const keys = Object.keys(billingSchema.shape) as (keyof BillingFormValues)[]

            keys.forEach((key) => {
                const val = settings[key as keyof typeof settings]
                if (val === null || val === undefined) {
                    if (key === 'default_vat_rate') {
                        formattedSettings[key] = 19.00 as never;
                    } else if (key === 'allowed_dte_types_emit' || key === 'allowed_dte_types_receive') {
                        formattedSettings[key] = [] as never;
                    } else {
                        formattedSettings[key] = null as never;
                    }
                } else if (key === 'default_vat_rate') {
                    formattedSettings[key] = parseFloat(val.toString()) as never
                } else {
                    formattedSettings[key] = val as never
                }
            })

            form.reset(formattedSettings as BillingFormValues)
        }
    }, [settings, form])


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
        { value: "dtes", label: "Documentos Electrónicos", iconName: "file-text", href: "/settings/billing?tab=dtes" },
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
                            <CloudUpload className="h-3 w-3 animate-pulse text-primary" />
                            <span className="text-primary">Guardando cambios...</span>
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
                                        <div className="p-3 rounded-lg bg-primary/5 border border-blue-500/10 text-[11px] text-primary">
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

                        <TabsContent value="dtes" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <DTEConfigCard 
                                    form={form} 
                                    name="allowed_dte_types_emit" 
                                    title="Documentos a Emitir (Ventas/POS)" 
                                    description="Seleccione qué tipos de documentos están habilitados para ser emitidos."
                                />
                                <DTEConfigCard 
                                    form={form} 
                                    name="allowed_dte_types_receive" 
                                    title="Documentos a Recibir (Compras)" 
                                    description="Seleccione qué tipos de documentos están habilitados para ser registrados."
                                />
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

interface DTEConfigCardProps {
    form: UseFormReturn<BillingFormValues>
    name: "allowed_dte_types_emit" | "allowed_dte_types_receive"
    title: string
    description: string
}

function DTEConfigCard({ form, name, title, description }: DTEConfigCardProps) {
    const dteTypes = [
        { id: 'FACTURA', label: 'Factura Electrónica', code: '33' },
        { id: 'FACTURA_EXENTA', label: 'Factura Exenta', code: '34' },
        { id: 'BOLETA', label: 'Boleta Electrónica', code: '39' },
        { id: 'BOLETA_EXENTA', label: 'Boleta Exenta', code: '41' },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                        <FormItem>
                            <div className="grid grid-cols-1 gap-4">
                                {dteTypes.map((type) => (
                                    <div key={type.id} className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => {
                                        const current = (field.value as string[]) || [];
                                        const next = current.includes(type.id)
                                            ? current.filter((v) => v !== type.id)
                                            : [...current, type.id];
                                        field.onChange(next);
                                    }}>
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${((field.value as string[]) || []).includes(type.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                            {((field.value as string[]) || []).includes(type.id) && <Check className="h-3.5 w-3.5 text-primary-foreground stroke-[4]" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold leading-none">{type.label}</div>
                                            <div className="text-[10px] text-muted-foreground mt-1">Código SII: {type.code}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
