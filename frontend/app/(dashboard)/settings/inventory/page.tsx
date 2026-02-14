"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
    Loader2,
    CloudCheck,
    CloudUpload,
    Package,
    TrendingUp,
    DollarSign
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
    initial_inventory_account: z.string().nullable(),
    revaluation_account: z.string().nullable(),
    // COGS accounts
    merchandise_cogs_account: z.string().nullable(),
    manufactured_cogs_account: z.string().nullable(),
    // Valuation method
    inventory_valuation_method: z.string(),
})

type InventoryFormValues = z.infer<typeof inventorySchema>

export default function InventorySettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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
            initial_inventory_account: null,
            revaluation_account: null,
            merchandise_cogs_account: null,
            manufactured_cogs_account: null,
            inventory_valuation_method: "AVERAGE",
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
                        formattedSettings[key] = (key === 'inventory_valuation_method' ? "AVERAGE" : null)
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

    async function onSubmit(data: InventoryFormValues) {
        setSaving(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            toast.success("Configuración de inventario aplicada")
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
        { value: "accounts", label: "Cuentas de Inventario", icon: Package },
        { value: "adjustments", label: "Ajustes y Valoración", icon: TrendingUp },
        { value: "cogs", label: "Costo de Ventas", icon: DollarSign },
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <PageHeader
                title="Configuración de Inventario"
                description="Gestione las cuentas de stock, ajustes y costo de ventas."
                icon={Package}
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

            <Tabs defaultValue="accounts" className="space-y-4">
                <PageTabs tabs={tabs} maxWidth="max-w-2xl" />

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
                                    <AccountField form={form} name="initial_inventory_account" label="Carga de Stock Inicial (Patrimonio)" accountType="EQUITY" />
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
