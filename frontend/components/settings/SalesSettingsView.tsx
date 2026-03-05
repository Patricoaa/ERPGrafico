"use client"

import React, { useEffect, useCallback } from "react"
import { useForm, UseFormReturn, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useSalesSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
    Loader2,
    CloudCheck,
    CloudUpload,
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"

const salesSchema = z.object({
    // Revenue accounts
    default_revenue_account: z.string().nullable(),
    default_service_revenue_account: z.string().nullable(),
    default_subscription_revenue_account: z.string().nullable(),
    // POS accounts
    pos_cash_difference_gain_account: z.string().nullable(),
    pos_cash_difference_loss_account: z.string().nullable(),
    pos_tip_account: z.string().nullable(),
    pos_cashback_error_account: z.string().nullable(),
    pos_counting_error_account: z.string().nullable(),
    pos_system_error_account: z.string().nullable(),
    pos_rounding_adjustment_account: z.string().nullable(),
    pos_partner_withdrawal_account: z.string().nullable(),
    pos_theft_account: z.string().nullable(),
    pos_other_inflow_account: z.string().nullable(),
    pos_other_outflow_account: z.string().nullable(),
    // Terminal accounts
    terminal_commission_bridge_account: z.string().nullable(),
    terminal_iva_bridge_account: z.string().nullable(),
})

type SalesFormValues = z.infer<typeof salesSchema>

interface SalesSettingsViewProps {
    activeTab: string
}

export const SalesSettingsView: React.FC<SalesSettingsViewProps> = ({ activeTab }) => {
    const { settings, saving, updateSettings } = useSalesSettings()

    const form = useForm<SalesFormValues>({
        resolver: zodResolver(salesSchema),
        defaultValues: {
            default_revenue_account: null,
            default_service_revenue_account: null,
            default_subscription_revenue_account: null,
            pos_cash_difference_gain_account: null,
            pos_cash_difference_loss_account: null,
            pos_tip_account: null,
            pos_cashback_error_account: null,
            pos_counting_error_account: null,
            pos_system_error_account: null,
            pos_rounding_adjustment_account: null,
            pos_partner_withdrawal_account: null,
            pos_theft_account: null,
            pos_other_inflow_account: null,
            pos_other_outflow_account: null,
            terminal_commission_bridge_account: null,
            terminal_iva_bridge_account: null,
        }
    })

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            const formattedSettings: Partial<SalesFormValues> = {}
            const keys = Object.keys(salesSchema.shape) as (keyof SalesFormValues)[]

            keys.forEach((key) => {
                const val = settings[key as keyof typeof settings]
                if (val === null || val === undefined) {
                    formattedSettings[key] = null as never
                } else {
                    formattedSettings[key] = val.toString() as never
                }
            })

            form.reset(formattedSettings as SalesFormValues)
        }
    }, [settings, form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: SalesFormValues) => {
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
        { value: "revenue", label: "Ingresos", iconName: "dollar-sign", href: "/settings/sales?tab=revenue" },
        { value: "pos", label: "Control POS", iconName: "store", href: "/settings/sales?tab=pos" },
        { value: "terminals", label: "Terminales", iconName: "credit-card", href: "/settings/sales?tab=terminals" },
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <PageHeader
                title="Configuración de Ventas"
                description="Gestione las cuentas de ingresos, control de caja POS y terminales de pago."

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

            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

                <Form {...form}>
                    <form className="space-y-6">
                        <TabsContent value="revenue" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Cuentas de Ingresos</CardTitle>
                                    <CardDescription>Cuentas predeterminadas para diferentes tipos de productos</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <AccountField form={form} name="default_revenue_account" label="Ingresos por Ventas (General)" accountType="INCOME" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AccountField form={form} name="default_service_revenue_account" label="Ingresos por Servicios" accountType="INCOME" />
                                        <AccountField form={form} name="default_subscription_revenue_account" label="Ingresos por Suscripciones" accountType="INCOME" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="pos" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-emerald-600">Control de Caja POS</CardTitle>
                                    <CardDescription>Cuentas para diferencias y movimientos manuales de caja</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AccountField form={form} name="pos_cash_difference_gain_account" label="Sobrante General" accountType="INCOME" />
                                        <AccountField form={form} name="pos_cash_difference_loss_account" label="Faltante General" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_counting_error_account" label="Error de Conteo" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_theft_account" label="Robo / Faltante" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_rounding_adjustment_account" label="Redondeo POS" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_tip_account" label="Propinas" accountType="INCOME" />
                                        <AccountField form={form} name="pos_cashback_error_account" label="Vuelto Incorrecto" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_system_error_account" label="Error de Sistema" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_partner_withdrawal_account" label="Retiro Socio" accountType="ASSET" />
                                        <AccountField form={form} name="pos_other_inflow_account" label="Otros Ingresos" accountType="INCOME" />
                                        <AccountField form={form} name="pos_other_outflow_account" label="Otros Egresos" accountType="EXPENSE" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="terminals" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-600">Cuentas Puente de Terminales</CardTitle>
                                    <CardDescription>Cuentas para comisiones de terminales de pago sin factura</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <AccountField form={form} name="terminal_commission_bridge_account" label="Puente Comisión Neto" accountType="ASSET" />
                                    <AccountField form={form} name="terminal_iva_bridge_account" label="Puente IVA Comisión" accountType="ASSET" />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </form>
                </Form>
            </Tabs>
        </div>
    )
}

export default SalesSettingsView

interface AccountFieldProps {
    form: UseFormReturn<SalesFormValues>
    name: Path<SalesFormValues>
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
