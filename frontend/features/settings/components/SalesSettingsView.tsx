"use client"
// eslint-disable-next-line @typescript-eslint/no-unused-vars

import React, { useEffect, useCallback, useState } from "react"

import { useForm, UseFormReturn, Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSalesSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
    TrendingUp,
    CreditCard,
    Percent,
    User as UserIcon,
    Users as UsersIcon,
    Settings,
    Wallet,
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector"
import { GroupSelector } from "@/components/selectors/GroupSelector"
import { LabeledInput } from "@/components/shared"
import { SalesSettingsUpdatePayload } from "@/features/settings/types"
import { cn } from "@/lib/utils"

import { salesSchema, type SalesFormValues } from "./SalesSettingsView.schema"

const AccountField = ({ form, name, label, accountType }: { form: UseFormReturn<SalesFormValues>, name: Path<SalesFormValues>, label: string, accountType: string | string[] }) => (
    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">{label}</FormLabel>
                <FormControl>
                    <AccountSelector
                        value={field.value as string}
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
                                value={field.value as number | null}
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
                                value={field.value as string}
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


export function SalesSettingsView({ activeTab = "income", onSavingChange }: {
    activeTab?: string,
    onSavingChange?: (saving: boolean) => void
}) {
    const [currentTab, setCurrentTab] = useState(activeTab)
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

    // Update saving status to parent
    useEffect(() => {
        onSavingChange?.(saving)
    }, [saving, onSavingChange])

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
        <div className="max-w-6xl mx-auto space-y-6">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-muted/50 rounded-md border-2">
                    <TabsTrigger value="income" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Ingresos
                    </TabsTrigger>
                    <TabsTrigger value="credit" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <CreditCard className="h-3.5 w-3.5" />
                        Crédito
                    </TabsTrigger>
                    <TabsTrigger value="config_pos" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <Settings className="h-3.5 w-3.5" />
                        POS
                    </TabsTrigger>
                    <TabsTrigger value="terminals" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <Wallet className="h-3.5 w-3.5" />
                        Terminales
                    </TabsTrigger>
                </TabsList>

                <Form {...form}>

                    <form className="mt-6 space-y-6">
                        <TabsContent value="income" className="space-y-6 m-0 p-0 border-0 outline-none mt-4">
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

                        <TabsContent value="credit" className="space-y-6 m-0 p-0 border-0 outline-none mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Crédito y Cartera</CardTitle>
                                    <CardDescription>Configure políticas de crédito, bloqueos automáticos y cuentas de castigo</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Card className="bg-muted/10 border shadow-none overflow-hidden h-full">
                                                <div className="p-4 space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="pos_default_credit_percentage"
                                                        render={({ field, fieldState }) => (
                                                            <div className="space-y-2">
                                                                <LabeledInput
                                                                    label="Crédito Preaprobado POS (%)"
                                                                    hint="% asignado por defecto si el cliente no tiene línea de crédito."
                                                                    suffix={<span className="text-[10px] text-muted-foreground font-bold font-mono">%</span>}
                                                                    type="number"
                                                                    {...field}
                                                                    className="font-bold text-center max-w-[150px]"
                                                                    min={0}
                                                                    max={100}
                                                                    error={fieldState.error?.message}
                                                                />
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                            </Card>

                                            <Card className="bg-muted/10 border shadow-none overflow-hidden h-full">
                                                <div className="p-4 space-y-4">
                                                    <FormField
                                                        control={form.control}
                                                        name="credit_auto_block_days"
                                                        render={({ field, fieldState }) => (
                                                            <div className="space-y-2">
                                                                <LabeledInput
                                                                    label="Días de Mora para Auto-Bloqueo"
                                                                    hint="Días máximos permitidos antes de restringir el crédito automáticamente."
                                                                    suffix={<span className="text-[10px] text-muted-foreground font-bold font-mono">D</span>}
                                                                    type="number"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                                                    className="font-bold text-center max-w-[150px]"
                                                                    placeholder="Desact."
                                                                    error={fieldState.error?.message}
                                                                />
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                            </Card>
                                        </div>

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

                        <TabsContent value="config_pos" className="space-y-6 m-0 p-0 border-0 outline-none mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Parámetros Operativos POS</CardTitle>
                                    <CardDescription>Configure el comportamiento y permisos del punto de venta</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-2 text-sm font-bold text-primary px-1">
                                            <Percent className="h-4 w-4" />
                                            Configuración de Descuentos
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                                <FormMessage />
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
                                                                <FormMessage />
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

                        <TabsContent value="terminals" className="space-y-6 m-0 p-0 border-0 outline-none mt-4">
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
                    </form>
                </Form>
            </Tabs>
        </div>
    )
}


