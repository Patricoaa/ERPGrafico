"use client"

import React, { useEffect, useCallback, useState } from "react"
import { useForm, UseFormReturn, Path } from "react-hook-form"
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
import { Badge } from "@/components/ui/badge"
import {
    Save,
    TrendingUp,
    CreditCard,
    Loader2,
    Check,
    CloudUpload,
    Scale,
    Percent,
    User as UserIcon,
    Users as UsersIcon,
    Settings,
    Wallet,
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector"
import { GroupSelector } from "@/components/selectors/GroupSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { Button } from "@/components/ui/button"
import { SalesSettings, SalesSettingsUpdatePayload } from "@/features/settings/types"
import { cn } from "@/lib/utils"

const accountFieldSchema = z.string().nullable()

const salesSchema = z.object({
    default_revenue_account: z.string().nullable(),
    default_service_revenue_account: z.string().nullable(),
    default_subscription_revenue_account: z.string().nullable(),
    pos_default_credit_percentage: z.number(),
    pos_enable_line_discounts: z.boolean(),
    pos_enable_total_discounts: z.boolean(),
    pos_line_discount_user: z.number().nullable(),
    pos_line_discount_group: z.string(),
    pos_global_discount_user: z.number().nullable(),
    pos_global_discount_group: z.string(),
    terminal_commission_bridge_account: z.string().nullable(),
    terminal_iva_bridge_account: z.string().nullable(),
    credit_auto_block_days: z.number().nullable(),
    default_uncollectible_expense_account: z.string().nullable(),
})


type SalesFormValues = z.infer<typeof salesSchema>

const AccountField = ({ form, name, label, accountType }: { form: UseFormReturn<SalesFormValues>, name: Path<SalesFormValues>, label: string, accountType: string | string[] }) => (

    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">{label}</FormLabel>
                <FormControl>
                    <AccountSelector
                        value={field.value as any}
                        onChange={field.onChange}
                        accountType={accountType}
                    />
                </FormControl>

                <FormMessage />
            </FormItem>
        )}
    />
)

const DiscountPermissionControl = ({ form, userField, groupField }: { form: UseFormReturn<SalesFormValues>, userField: Path<SalesFormValues>, groupField: Path<SalesFormValues> }) => {
    const groupVal = form.watch(groupField as any)

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
                                value={field.value as any}
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
                                value={field.value as any}
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

    const form = useForm<SalesFormValues>({
        resolver: zodResolver(salesSchema),
        defaultValues: {
            default_revenue_account: null,
            default_service_revenue_account: null,
            default_subscription_revenue_account: null,
            pos_default_credit_percentage: 0,
            pos_enable_line_discounts: false,
            pos_enable_total_discounts: false,
            pos_line_discount_user: null,
            pos_line_discount_group: "",
            pos_global_discount_user: null,
            pos_global_discount_group: "",
            terminal_commission_bridge_account: null,
            terminal_iva_bridge_account: null,
            credit_auto_block_days: 60,
            default_uncollectible_expense_account: null,
        }
    })


    useEffect(() => {
        if (settings) {
            form.reset({
                default_revenue_account: settings.default_revenue_account?.toString() ?? null,
                default_service_revenue_account: settings.default_service_revenue_account?.toString() ?? null,
                default_subscription_revenue_account: settings.default_subscription_revenue_account?.toString() ?? null,
                pos_default_credit_percentage: Number(settings.pos_default_credit_percentage) || 0,
                pos_enable_line_discounts: !!settings.pos_enable_line_discounts,
                pos_enable_total_discounts: !!settings.pos_enable_total_discounts,
                pos_line_discount_user: settings.pos_line_discount_user ?? null,
                pos_line_discount_group: settings.pos_line_discount_group ?? "",
                pos_global_discount_user: settings.pos_global_discount_user ?? null,
                pos_global_discount_group: settings.pos_global_discount_group ?? "",
                terminal_commission_bridge_account: settings.terminal_commission_bridge_account?.toString() ?? null,
                terminal_iva_bridge_account: settings.terminal_iva_bridge_account?.toString() ?? null,
                credit_auto_block_days: settings.credit_auto_block_days ?? null,
                default_uncollectible_expense_account: settings.default_uncollectible_expense_account?.toString() ?? null,
            })
        }
    }, [settings, form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: SalesFormValues) => {
        try {
            await updateSettings(data as SalesSettingsUpdatePayload)
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
                    { value: "credit", label: "Crédito y Cartera", iconName: "wallet", href: "/settings/sales?tab=credit" },
                    { value: "income", label: "Cuentas Ingresos", iconName: "trending-up", href: "/settings/sales?tab=income" },
                    { value: "terminals", label: "Cuentas Terminal", iconName: "credit-card", href: "/settings/sales?tab=terminals" },
                ]}
                activeValue={activeTab}
                maxWidth="max-w-4xl"
            />

            <div className="mt-6">
                <Form {...(form as any)}>
                    <Tabs value={activeTab} className="w-full h-full m-0 p-0 border-0 outline-none">


                        <TabsContent value="income" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Cuentas de Ingresos Naturales</CardTitle>
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

                        <TabsContent value="credit" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Crédito y Cartera</CardTitle>
                                    <CardDescription>Configure políticas de crédito, bloqueos automáticos y cuentas de castigo</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* POS Fallback Credit */}
                                            <Card className="bg-muted/10 border shadow-none overflow-hidden h-full">
                                                <div className="p-4 space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="pos_default_credit_percentage"
                                                        render={({ field }) => (
                                                            <div className="space-y-2">
                                                                <FormLabel className="text-xs font-bold">Crédito Preaprobado POS (%)</FormLabel>
                                                                <p className="text-[10px] text-muted-foreground leading-tight">
                                                                    % asignado por defecto si el cliente no tiene línea de crédito.
                                                                </p>
                                                                <FormControl>
                                                                    <div className="relative max-w-[120px]">
                                                                        <Input
                                                                            type="number"
                                                                            {...field}
                                                                            className="pr-8 h-9 font-bold text-center"
                                                                            min={0}
                                                                            max={100}
                                                                        />
                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold font-mono">%</span>
                                                                    </div>
                                                                </FormControl>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                            </Card>

                                            {/* Auto-Blocking Selection */}
                                            <Card className="bg-muted/10 border shadow-none overflow-hidden h-full">
                                                <div className="p-4 space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="credit_auto_block_days"
                                                        render={({ field }) => (
                                                            <div className="space-y-2">
                                                                <FormLabel className="text-xs font-bold">Días de Mora para Auto-Bloqueo</FormLabel>
                                                                <p className="text-[10px] text-muted-foreground leading-tight">
                                                                    Días máximos permitidos antes de restringir el crédito automáticamente.
                                                                </p>
                                                                <FormControl>
                                                                    <div className="relative max-w-[120px]">
                                                                        <Input
                                                                            type="number"
                                                                            {...field}
                                                                            value={field.value ?? ""}
                                                                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                                                            className="pr-8 h-9 font-bold text-center"
                                                                            placeholder="Desact."
                                                                        />
                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold font-mono">D</span>
                                                                    </div>
                                                                </FormControl>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                            </Card>
                                        </div>

                                        {/* Uncollectible Expense Account */}
                                        <Card className="bg-muted/10 border shadow-none overflow-hidden h-full">
                                            <div className="p-4 space-y-4">
                                                <AccountField
                                                    form={form}
                                                    name="default_uncollectible_expense_account"
                                                    label="Cuenta Gasto Incobrables"
                                                    accountType="EXPENSE"
                                                />
                                                <p className="text-[10px] text-muted-foreground leading-tight px-1">
                                                    Cuenta donde se cargarán las pérdidas al castigar deudas de clientes.
                                                </p>
                                            </div>
                                        </Card>
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
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="terminals" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Cuentas Puente de Terminales</CardTitle>
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
