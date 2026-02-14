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
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
    Loader2,
    CloudCheck,
    CloudUpload,
    ShoppingBag,
    DollarSign,
    Store,
    CreditCard
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"

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
    pos_cash_difference_approval_threshold: z.number(),
    // Terminal accounts
    terminal_commission_bridge_account: z.string().nullable(),
    terminal_iva_bridge_account: z.string().nullable(),
})

type SalesFormValues = z.infer<typeof salesSchema>

export default function SalesSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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
            pos_cash_difference_approval_threshold: 5000,
            terminal_commission_bridge_account: null,
            terminal_iva_bridge_account: null,
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
                    if (val === null || val === undefined) {
                        formattedSettings[key] = (key === 'pos_cash_difference_approval_threshold' ? 5000 : null)
                    } else if (key === 'pos_cash_difference_approval_threshold') {
                        formattedSettings[key] = parseInt(val.toString()) || 0
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

    useEffect(() => {
        if (!loading && isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, loading, isDirty])

    async function onSubmit(data: SalesFormValues) {
        setSaving(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            toast.success("Configuración de ventas aplicada")
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

    const tabs = [
        { value: "revenue", label: "Ingresos", icon: DollarSign },
        { value: "pos", label: "Control POS", icon: Store },
        { value: "terminals", label: "Terminales", icon: CreditCard },
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <PageHeader
                title="Configuración de Ventas"
                description="Gestione las cuentas de ingresos, control de caja POS y terminales de pago."
                icon={ShoppingBag}
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

            <Tabs defaultValue="revenue" className="space-y-4">
                <PageTabs tabs={tabs} maxWidth="max-w-2xl" />

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

                                    <div className="pt-4 border-t">
                                        <FormField
                                            control={form.control}
                                            name="pos_cash_difference_approval_threshold"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <FormLabel className="text-xs font-semibold uppercase">Umbral de Aprobación Automática</FormLabel>
                                                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">Valor en CLP</span>
                                                    </div>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            type="number"
                                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                            className="font-mono"
                                                        />
                                                    </FormControl>
                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                        Las diferencias de caja menores a este monto se aprobarán automáticamente al cerrar el terminal.
                                                    </p>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
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
