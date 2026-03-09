"use client"

import React, { useEffect, useCallback, useState } from "react"
import { useForm, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { useSalesSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
    Save,
    TrendingUp,
    LayoutGrid,
    CreditCard,
    Loader2,
    Check,
    CloudUpload,
    Scale,
    Percent,
    User as UserIcon,
    Users as UsersIcon,
    Settings,
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector"
import { GroupSelector } from "@/components/selectors/GroupSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { Button } from "@/components/ui/button"
import { SalesSettings } from "@/features/settings/types"
import { cn } from "@/lib/utils"

const accountFieldSchema = z.string().nullable()

const salesSchema = z.object({
    default_revenue_account: accountFieldSchema,
    default_service_revenue_account: accountFieldSchema,
    default_subscription_revenue_account: accountFieldSchema,
    pos_cash_difference_gain_account: accountFieldSchema,
    pos_cash_difference_loss_account: accountFieldSchema,
    pos_counting_error_account: accountFieldSchema,
    pos_theft_account: accountFieldSchema,
    pos_rounding_adjustment_account: accountFieldSchema,
    pos_tip_account: accountFieldSchema,
    pos_cashback_error_account: accountFieldSchema,
    pos_system_error_account: accountFieldSchema,
    pos_partner_withdrawal_account: accountFieldSchema,
    pos_other_inflow_account: accountFieldSchema,
    pos_other_outflow_account: accountFieldSchema,
    pos_default_credit_percentage: z.coerce.number().min(0).max(100).default(0),
    pos_enable_line_discounts: z.boolean().default(false),
    pos_enable_total_discounts: z.boolean().default(false),
    pos_line_discount_user: z.number().nullable().default(null),
    pos_line_discount_group: z.string().default(""),
    pos_global_discount_user: z.number().nullable().default(null),
    pos_global_discount_group: z.string().default(""),
    terminal_commission_bridge_account: accountFieldSchema,
    terminal_iva_bridge_account: accountFieldSchema,
})

const AccountField = ({ form, name, label, accountType }: { form: UseFormReturn<any>, name: string, label: string, accountType: string | string[] }) => (
    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">{label}</FormLabel>
                <FormControl>
                    <AccountSelector
                        value={field.value}
                        onChange={field.onChange}
                        accountType={accountType}
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
)

const DiscountPermissionControl = ({ form, userField, groupField }: { form: UseFormReturn<any>, userField: string, groupField: string }) => {
    const groupVal = form.watch(groupField)
    const [mode, setMode] = useState<'user' | 'group'>(groupVal ? 'group' : 'user')

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center p-0.5 bg-muted rounded-lg border shadow-sm w-fit self-start">
                <button
                    type="button"
                    className={cn(
                        "px-3 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                        mode === 'user' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => {
                        setMode('user')
                        form.setValue(groupField, "")
                    }}
                >
                    <UserIcon className="h-3 w-3" />
                    Usuario
                </button>
                <button
                    type="button"
                    className={cn(
                        "px-3 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5",
                        mode === 'group' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => {
                        setMode('group')
                        form.setValue(userField, null)
                    }}
                >
                    <UsersIcon className="h-3 w-3" />
                    Grupo
                </button>
            </div>

            <div className="w-full">
                {mode === 'user' ? (
                    <FormField
                        control={form.control}
                        name={userField}
                        render={({ field }) => (
                            <UserSelector
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Sel. usuario con permiso..."
                            />
                        )}
                    />
                ) : (
                    <FormField
                        control={form.control}
                        name={groupField}
                        render={({ field }) => (
                            <GroupSelector
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Sel. grupo con permiso..."
                            />
                        )}
                    />
                )}
            </div>
        </div>
    )
}

export function SalesSettingsView({ activeTab }: { activeTab: string }) {
    const { settings, saving, updateSettings } = useSalesSettings()

    const form = useForm<z.infer<typeof salesSchema>>({
        resolver: zodResolver(salesSchema),
        defaultValues: {
            default_revenue_account: null,
            default_service_revenue_account: null,
            default_subscription_revenue_account: null,
            pos_cash_difference_gain_account: null,
            pos_cash_difference_loss_account: null,
            pos_counting_error_account: null,
            pos_theft_account: null,
            pos_rounding_adjustment_account: null,
            pos_tip_account: null,
            pos_cashback_error_account: null,
            pos_system_error_account: null,
            pos_partner_withdrawal_account: null,
            pos_other_inflow_account: null,
            pos_other_outflow_account: null,
            pos_default_credit_percentage: 0,
            pos_enable_line_discounts: false,
            pos_enable_total_discounts: false,
            pos_line_discount_user: null,
            pos_line_discount_group: "",
            pos_global_discount_user: null,
            pos_global_discount_group: "",
            terminal_commission_bridge_account: null,
            terminal_iva_bridge_account: null,
        }
    })

    useEffect(() => {
        if (settings) {
            form.reset({
                default_revenue_account: settings.default_revenue_account?.toString() ?? null,
                default_service_revenue_account: settings.default_service_revenue_account?.toString() ?? null,
                default_subscription_revenue_account: settings.default_subscription_revenue_account?.toString() ?? null,
                pos_cash_difference_gain_account: settings.pos_cash_difference_gain_account?.toString() ?? null,
                pos_cash_difference_loss_account: settings.pos_cash_difference_loss_account?.toString() ?? null,
                pos_counting_error_account: settings.pos_counting_error_account?.toString() ?? null,
                pos_theft_account: settings.pos_theft_account?.toString() ?? null,
                pos_rounding_adjustment_account: settings.pos_rounding_adjustment_account?.toString() ?? null,
                pos_tip_account: settings.pos_tip_account?.toString() ?? null,
                pos_cashback_error_account: settings.pos_cashback_error_account?.toString() ?? null,
                pos_system_error_account: settings.pos_system_error_account?.toString() ?? null,
                pos_partner_withdrawal_account: settings.pos_partner_withdrawal_account?.toString() ?? null,
                pos_other_inflow_account: settings.pos_other_inflow_account?.toString() ?? null,
                pos_other_outflow_account: settings.pos_other_outflow_account?.toString() ?? null,
                pos_default_credit_percentage: Number(settings.pos_default_credit_percentage) || 0,
                pos_enable_line_discounts: !!settings.pos_enable_line_discounts,
                pos_enable_total_discounts: !!settings.pos_enable_total_discounts,
                pos_line_discount_user: settings.pos_line_discount_user ?? null,
                pos_line_discount_group: settings.pos_line_discount_group ?? "",
                pos_global_discount_user: settings.pos_global_discount_user ?? null,
                pos_global_discount_group: settings.pos_global_discount_group ?? "",
                terminal_commission_bridge_account: settings.terminal_commission_bridge_account?.toString() ?? null,
                terminal_iva_bridge_account: settings.terminal_iva_bridge_account?.toString() ?? null,
            })
        }
    }, [settings, form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: any) => {
        try {
            await updateSettings(data as SalesSettings)
            form.reset(data)
        } catch (error) {
            // Error handled by hook
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

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <PageHeader
                title="Configuración de Ventas"
                description="Gestione los parámetros generales de ventas, cuentas contables y comportamiento del POS"
                icon={Scale}
            >
                <div className="flex items-center gap-4">
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
                </div>
            </PageHeader>

            <ServerPageTabs
                tabs={[
                    { value: "config_pos", label: "Configuración POS", iconName: "settings", href: "/settings/sales?tab=config_pos" },
                    { value: "income", label: "Cuentas Ingresos", iconName: "trending-up", href: "/settings/sales?tab=income" },
                    { value: "pos", label: "Cuentas POS", iconName: "layout-grid", href: "/settings/sales?tab=pos" },
                    { value: "terminals", label: "Cuentas Terminal", iconName: "credit-card", href: "/settings/sales?tab=terminals" },
                ]}
                activeValue={activeTab}
                maxWidth="max-w-xl"
            />

            <div className="mt-6">
                <Form {...form}>
                    <Tabs value={activeTab} className="w-full h-full m-0 p-0 border-0 outline-none">

                        <TabsContent value="income" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-emerald-600">Cuentas de Ingresos Naturales</CardTitle>
                                    <CardDescription>Cuentas contables para registrar los distintos tipos de ingresos por venta</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <AccountField form={form} name="default_revenue_account" label="Ingreso General (Productos)" accountType="INCOME" />
                                        <AccountField form={form} name="default_service_revenue_account" label="Ingresos por Servicios" accountType="INCOME" />
                                        <AccountField form={form} name="default_subscription_revenue_account" label="Ingresos por Suscripciones" accountType="INCOME" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="pos" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-600">Cuentas Contables POS</CardTitle>
                                    <CardDescription>Configure las cuentas para el registro automático de transacciones de punto de venta</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <AccountField form={form} name="pos_cash_difference_gain_account" label="Sobrante General" accountType="INCOME" />
                                        <AccountField form={form} name="pos_cash_difference_loss_account" label="Faltante General" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_counting_error_account" label="Error de Conteo" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_theft_account" label="Robo / Faltante" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_rounding_adjustment_account" label="Redondeo POS" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_tip_account" label="Propinas" accountType="INCOME" />
                                        <AccountField form={form} name="pos_cashback_error_account" label="Vuelto Incorrecto" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_system_error_account" label="Error de Sistema" accountType="EXPENSE" />
                                        <AccountField form={form} name="pos_partner_withdrawal_account" label="Retiro Socio" accountType="EQUITY" />
                                        <AccountField form={form} name="pos_other_inflow_account" label="Otros Ingresos" accountType="INCOME" />
                                        <AccountField form={form} name="pos_other_outflow_account" label="Otros Egresos" accountType="EXPENSE" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="config_pos" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Parámetros Operativos POS</CardTitle>
                                    <CardDescription>Configure el comportamiento y permisos del punto de venta</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    {/* Descuentos Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 text-sm font-bold text-primary px-1">
                                            <Percent className="h-4 w-4" />
                                            Configuración de Descuentos
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Line Discounts */}
                                            <Card className="bg-muted/10 border shadow-none overflow-hidden">
                                                <div className="p-4 space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="pos_enable_line_discounts"
                                                        render={({ field }) => (
                                                            <div className="flex items-center justify-between">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-xs font-bold">Descuentos por Línea</FormLabel>
                                                                    <p className="text-[10px] text-muted-foreground">Habilitar en el carrito</p>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                </FormControl>
                                                            </div>
                                                        )}
                                                    />

                                                    {watchedValues.pos_enable_line_discounts && (
                                                        <div className="pt-2 space-y-3 border-t border-dashed">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase">Permiso para aplicar</div>
                                                            <DiscountPermissionControl
                                                                form={form}
                                                                userField="pos_line_discount_user"
                                                                groupField="pos_line_discount_group"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>

                                            {/* Global Discounts */}
                                            <Card className="bg-muted/10 border shadow-none overflow-hidden">
                                                <div className="p-4 space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="pos_enable_total_discounts"
                                                        render={({ field }) => (
                                                            <div className="flex items-center justify-between">
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-xs font-bold">Descuentos Globales</FormLabel>
                                                                    <p className="text-[10px] text-muted-foreground">Habilitar al total</p>
                                                                </div>
                                                                <FormControl>
                                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                </FormControl>
                                                            </div>
                                                        )}
                                                    />

                                                    {watchedValues.pos_enable_total_discounts && (
                                                        <div className="pt-2 space-y-3 border-t border-dashed">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase">Permiso para aplicar</div>
                                                            <DiscountPermissionControl
                                                                form={form}
                                                                userField="pos_global_discount_user"
                                                                groupField="pos_global_discount_group"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        </div>
                                    </div>

                                    <Separator className="opacity-50" />

                                    {/* Credit Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-primary px-1">
                                            <Scale className="h-4 w-4" />
                                            Línea de Crédito Preaprobada
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="pos_default_credit_percentage"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1 bg-muted/20 p-4 rounded-lg border border-dashed">
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Crédito Preaprobado (%)</FormLabel>
                                                    <p className="text-[10px] text-muted-foreground mb-3">
                                                        Porcentaje del total de la venta que se puede asignar como crédito a clientes sin línea de crédito definida.
                                                    </p>
                                                    <FormControl>
                                                        <div className="relative max-w-[150px]">
                                                            <Input
                                                                type="number"
                                                                {...field}
                                                                className="pr-8 h-9 font-bold text-center"
                                                                min={0}
                                                                max={100}
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span>
                                                        </div>
                                                    </FormControl>
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
                    </Tabs>
                </Form>
            </div>
        </div>
    )
}
