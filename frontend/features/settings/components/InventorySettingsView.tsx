"use client"

import React, { useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useInventorySettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
    Loader2,
    Check,
    CloudUpload,
} from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"

const inventorySchema = z.object({
    // Inventory accounts by type
    storable_inventory_account: z.string().nullable(),
    manufacturable_inventory_account: z.string().nullable(),
    default_consumable_account: z.string().nullable(),
    // Bridge accounts
    stock_input_account: z.string().nullable(),
    stock_output_account: z.string().nullable(),
    // Adjustment accounts
    adjustment_income_account: z.string().nullable(),
    adjustment_expense_account: z.string().nullable(),
    revaluation_account: z.string().nullable(),
    // COGS accounts
    merchandise_cogs_account: z.string().nullable(),
    manufactured_cogs_account: z.string().nullable(),
    // Valuation method
    inventory_valuation_method: z.string(),
})

type InventoryFormValues = z.infer<typeof inventorySchema>

interface InventorySettingsViewProps {
    activeTab: string
}

export const InventorySettingsView: React.FC<InventorySettingsViewProps> = ({ activeTab }) => {
    const { settings, saving, updateSettings } = useInventorySettings()

    const form = useForm<InventoryFormValues>({
        resolver: zodResolver(inventorySchema),
        defaultValues: {
            storable_inventory_account: null,
            manufacturable_inventory_account: null,
            default_consumable_account: null,
            stock_input_account: null,
            stock_output_account: null,
            adjustment_income_account: null,
            adjustment_expense_account: null,
            revaluation_account: null,
            merchandise_cogs_account: null,
            manufactured_cogs_account: null,
            inventory_valuation_method: "AVERAGE",
        }
    })

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            const formattedSettings: Partial<InventoryFormValues> = {}
            const keys = Object.keys(inventorySchema.shape) as (keyof InventoryFormValues)[]

            keys.forEach((key) => {
                const val = settings[key as keyof typeof settings]
                if (val === null || val === undefined) {
                    formattedSettings[key] = (key === 'inventory_valuation_method' ? "AVERAGE" : null) as never
                } else {
                    formattedSettings[key] = val.toString() as never
                }
            })

            form.reset(formattedSettings as InventoryFormValues)
        }
    }, [settings, form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: InventoryFormValues) => {
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
        { value: "accounts", label: "Cuentas de Inventario", iconName: "package", href: "/settings/inventory?tab=accounts" },
        { value: "adjustments", label: "Ajustes y Valoración", iconName: "trending-up", href: "/settings/inventory?tab=adjustments" },
        { value: "cogs", label: "Costo de Ventas", iconName: "dollar-sign", href: "/settings/inventory?tab=cogs" },
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <PageHeader
                title="Configuración de Inventario"
                description="Gestione las cuentas de stock, ajustes y costo de ventas."

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
                <PageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

                <Form {...form}>
                    <form className="space-y-6">
                        <TabsContent value="accounts" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Cuentas por Tipo de Producto</CardTitle>
                                    <CardDescription>Cuentas de inventario según el tipo de producto</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <AccountField form={form} name="storable_inventory_account" label="Almacenables (STORABLE)" accountType="ASSET" />
                                    <AccountField form={form} name="manufacturable_inventory_account" label="Fabricables (MANUFACTURABLE)" accountType="ASSET" />
                                    <AccountField form={form} name="default_consumable_account" label="Consumibles (Gasto)" accountType="EXPENSE" />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Cuentas Puente</CardTitle>
                                    <CardDescription>Cuentas intermedias para movimientos de stock</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AccountField form={form} name="stock_input_account" label="Recepciones" accountType="LIABILITY" />
                                        <AccountField form={form} name="stock_output_account" label="Despachos" accountType="ASSET" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="adjustments" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Cuentas de Ajuste</CardTitle>
                                    <CardDescription>Cuentas para diferencias de inventario</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <AccountField form={form} name="adjustment_income_account" label="Sobrantes" accountType="INCOME" />
                                        <AccountField form={form} name="adjustment_expense_account" label="Mermas" accountType="EXPENSE" />
                                    </div>
                                    <AccountField form={form} name="revaluation_account" label="Revalorización de Stock" accountType="INCOME" />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Método de Valoración</CardTitle>
                                    <CardDescription>Determine cómo el sistema calcula el costo de sus existencias</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FormField
                                        control={form.control}
                                        name="inventory_valuation_method"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Método de Valoración</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || "AVERAGE"}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccione método" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="AVERAGE">Promedio Ponderado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="cogs" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Costo de Ventas (COGS)</CardTitle>
                                    <CardDescription>Cuentas de gasto para el costo de productos vendidos</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <AccountField form={form} name="merchandise_cogs_account" label="Costo Mercaderías (STORABLE)" accountType="EXPENSE" />
                                    <AccountField form={form} name="manufactured_cogs_account" label="Costo Producción (MANUFACTURABLE)" accountType="EXPENSE" />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </form>
                </Form>
            </Tabs>
        </div>
    )
}

export default InventorySettingsView

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
