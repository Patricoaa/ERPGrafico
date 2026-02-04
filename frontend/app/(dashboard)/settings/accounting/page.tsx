"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ChevronLeft, Loader2, Save, Database, Settings2, BarChart3, Calculator } from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

const accountingSchema = z.object({
    default_receivable_account: z.string().nullable(),
    default_payable_account: z.string().nullable(),
    default_revenue_account: z.string().nullable(),
    default_expense_account: z.string().nullable(),
    merchandise_cogs_account: z.string().nullable(),
    manufactured_cogs_account: z.string().nullable(),
    default_tax_receivable_account: z.string().nullable(),
    default_tax_payable_account: z.string().nullable(),
    default_inventory_account: z.string().nullable(),
    storable_inventory_account: z.string().nullable(),
    manufacturable_inventory_account: z.string().nullable(),
    default_consumable_account: z.string().nullable(),
    default_prepayment_account: z.string().nullable(),
    default_advance_payment_account: z.string().nullable(),
    adjustment_income_account: z.string().nullable(),
    adjustment_expense_account: z.string().nullable(),
    initial_inventory_account: z.string().nullable(),
    revaluation_account: z.string().nullable(),

    // Reconciliation
    bank_commission_account: z.string().nullable(),
    card_commission_account: z.string().nullable(),
    interest_income_account: z.string().nullable(),
    exchange_difference_account: z.string().nullable(),
    rounding_adjustment_account: z.string().nullable(),
    error_adjustment_account: z.string().nullable(),
    miscellaneous_adjustment_account: z.string().nullable(),

    default_service_expense_account: z.string().nullable(),
    default_service_revenue_account: z.string().nullable(),
    default_subscription_expense_account: z.string().nullable(),
    default_subscription_revenue_account: z.string().nullable(),
    pos_cash_difference_gain_account: z.string().nullable(),
    pos_cash_difference_loss_account: z.string().nullable(),
    pos_cash_difference_approval_threshold: z.number().default(5000),

    code_format: z.string(),
    asset_prefix: z.string(),
    liability_prefix: z.string(),
    equity_prefix: z.string(),
    income_prefix: z.string(),
    expense_prefix: z.string(),
    inventory_valuation_method: z.string(),
})

type AccountingFormValues = z.infer<typeof accountingSchema>

export default function AccountingSettingsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [populating, setPopulating] = useState(false)

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: {
            default_receivable_account: null,
            default_payable_account: null,
            default_revenue_account: null,
            default_expense_account: null,
            merchandise_cogs_account: null,
            manufactured_cogs_account: null,
            default_tax_receivable_account: null,
            default_tax_payable_account: null,
            default_inventory_account: null,
            storable_inventory_account: null,
            manufacturable_inventory_account: null,
            default_consumable_account: null,
            default_prepayment_account: null,
            default_advance_payment_account: null,
            adjustment_income_account: null,
            adjustment_expense_account: null,
            initial_inventory_account: null,
            revaluation_account: null,

            bank_commission_account: null,
            card_commission_account: null,
            interest_income_account: null,
            exchange_difference_account: null,
            rounding_adjustment_account: null,
            error_adjustment_account: null,
            miscellaneous_adjustment_account: null,

            default_service_expense_account: null,
            default_service_revenue_account: null,
            default_subscription_expense_account: null,
            default_subscription_revenue_account: null,
            pos_cash_difference_gain_account: null,
            pos_cash_difference_loss_account: null,
            pos_cash_difference_approval_threshold: 5000,

            code_format: "X.X.XX.XXX",
            asset_prefix: "1",
            liability_prefix: "2",
            equity_prefix: "3",
            income_prefix: "4",
            expense_prefix: "5",
            inventory_valuation_method: "AVERAGE",
        }
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/accounting/settings/current/')
                const settings = res.data
                const formattedSettings: any = {}
                Object.keys(form.getValues()).forEach(key => {
                    const val = settings[key]
                    formattedSettings[key] = (val === null || val === undefined) ? (key.includes('prefix') || key === 'code_format' ? "" : null) : val.toString()
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

    async function onSubmit(data: AccountingFormValues) {
        setSaving(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            toast.success("Configuración contable guardada")
        } catch (error) {
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
        }
    }

    const handlePopulateIFRS = async () => {
        if (!confirm("¿Está seguro de cargar el plan de cuentas IFRS? Esto creará las cuentas detalladas y configurará todos los mapeos predeterminados automáticamente.")) return
        setPopulating(true)
        try {
            const res = await api.post('/accounting/accounts/populate_ifrs/')
            toast.success(res.data.message)
            window.location.reload()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al poblar plan de cuentas")
        } finally {
            setPopulating(false)
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
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Configuración Contable</h2>
                        <p className="text-muted-foreground mt-1">Gestione el plan de cuentas, mapeos predeterminados y reglas de negocio.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handlePopulateIFRS}
                        disabled={populating || saving}
                        className="gap-2"
                    >
                        {populating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                        Poblar Plan IFRS
                    </Button>
                    <Button
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={saving || populating}
                        className="gap-2"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar Cambios
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="mapping" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                    <TabsTrigger value="mapping" className="gap-2">
                        <BarChart3 className="h-4 w-4" /> Mapeos Base
                    </TabsTrigger>
                    <TabsTrigger value="structure" className="gap-2">
                        <Settings2 className="h-4 w-4" /> Estructura y Prefijos
                    </TabsTrigger>
                    <TabsTrigger value="business" className="gap-2">
                        <Calculator className="h-4 w-4" /> Reglas de Negocio
                    </TabsTrigger>
                </TabsList>

                <Form {...form}>
                    <form className="space-y-6 overflow-visible">
                        <TabsContent value="mapping" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Operaciones de Venta y Servicio</CardTitle>
                                        <CardDescription>Cuentas para ingresos y cuentas por cobrar.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <AccountField form={form} name="default_receivable_account" label="CxC Clientes (Activo)" accountType="ASSET" />
                                        <AccountField form={form} name="default_revenue_account" label="Ingresos por Ventas (Ingreso)" accountType="INCOME" />

                                        <Separator className="my-2" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <AccountField form={form} name="default_service_revenue_account" label="Servicios (Ingreso)" accountType="INCOME" />
                                            <AccountField form={form} name="default_subscription_revenue_account" label="Suscripciones (Ingreso)" accountType="INCOME" />
                                        </div>

                                        <Separator className="my-2" />
                                        <AccountField form={form} name="default_advance_payment_account" label="Anticipos de Clientes (Pasivo)" accountType="LIABILITY" />
                                        <AccountField form={form} name="default_tax_payable_account" label="IVA Débito Fiscal (Pasivo)" accountType="LIABILITY" />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Operaciones de Compra y Gasto</CardTitle>
                                        <CardDescription>Cuentas para costos, gastos y cuentas por pagar.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <AccountField form={form} name="default_payable_account" label="CxP Proveedores (Pasivo)" accountType="LIABILITY" />

                                        <Separator className="my-2" />
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Costo de Ventas (COGS)</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <AccountField form={form} name="merchandise_cogs_account" label="Mercaderías" accountType="EXPENSE" />
                                            <AccountField form={form} name="manufactured_cogs_account" label="Producción" accountType="EXPENSE" />
                                        </div>

                                        <Separator className="my-2" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <AccountField form={form} name="default_service_expense_account" label="Gastos Servicios" accountType="EXPENSE" />
                                            <AccountField form={form} name="default_subscription_expense_account" label="Gastos Suscrip." accountType="EXPENSE" />
                                        </div>

                                        <Separator className="my-2" />
                                        <AccountField form={form} name="default_prepayment_account" label="Anticipos a Proveedores (Activo)" accountType="ASSET" />
                                        <AccountField form={form} name="default_tax_receivable_account" label="IVA Crédito Fiscal (Activo)" accountType="ASSET" />
                                    </CardContent>
                                </Card>

                                <Card className="md:col-span-2">
                                    <CardHeader className="bg-muted/10">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle className="text-lg">Diferencias y Ajustes de Tesorería</CardTitle>
                                                <CardDescription>Cuentas para comisiones, intereses y control de caja POS.</CardDescription>
                                            </div>
                                            <div className="bg-primary/10 px-3 py-1 rounded-full">
                                                <p className="text-[10px] font-bold uppercase text-primary">Control de Caja</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-4 border-r pr-6">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Conciliación Bancaria</p>
                                                <AccountField form={form} name="bank_commission_account" label="Comisiones Bancarias" accountType="EXPENSE" />
                                                <AccountField form={form} name="card_commission_account" label="Comisiones Tarjeta" accountType="EXPENSE" />
                                                <AccountField form={form} name="interest_income_account" label="Intereses Ganados" accountType="INCOME" />
                                            </div>

                                            <div className="space-y-4 border-r px-6">
                                                <p className="text-[10px] font-bold uppercase text-emerald-600 mb-2">Punto de Venta (POS)</p>
                                                <AccountField form={form} name="pos_cash_difference_gain_account" label="Sobrante de Caja (Ingreso)" accountType="INCOME" />
                                                <AccountField form={form} name="pos_cash_difference_loss_account" label="Faltante de Caja (Gasto)" accountType="EXPENSE" />
                                                <AccountField form={form} name="rounding_adjustment_account" label="Ajuste Redondeo" accountType="EXPENSE" />
                                            </div>

                                            <div className="space-y-4 pl-6">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Otros Ajustes</p>
                                                <AccountField form={form} name="exchange_difference_account" label="Dif. Cambio" accountType="" />
                                                <AccountField form={form} name="error_adjustment_account" label="Ajuste Error" accountType="EXPENSE" />
                                                <AccountField form={form} name="miscellaneous_adjustment_account" label="Ajustes Varios" accountType="EXPENSE" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="md:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Gestión de Inventario</CardTitle>
                                        <CardDescription>Control de stock por tipo de producto y cuentas puente.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Cuentas por Tipo de Producto</p>
                                                <AccountField form={form} name="storable_inventory_account" label="Almacenables (STORABLE)" accountType="ASSET" />
                                                <AccountField form={form} name="manufacturable_inventory_account" label="Fabricables (MANUFACTURABLE)" accountType="ASSET" />
                                                <AccountField form={form} name="default_consumable_account" label="Consumibles (Gasto)" accountType="EXPENSE" />
                                            </div>

                                            <div className="space-y-4">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Cuentas Puente y Ajustes</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <AccountField form={form} name="stock_input_account" label="Recepciones" accountType="LIABILITY" />
                                                    <AccountField form={form} name="stock_output_account" label="Despachos" accountType="ASSET" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <AccountField form={form} name="adjustment_income_account" label="Sobrantes" accountType="INCOME" />
                                                    <AccountField form={form} name="adjustment_expense_account" label="Mermas" accountType="EXPENSE" />
                                                </div>
                                            </div>
                                        </div>

                                        <Separator className="my-6" />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <AccountField form={form} name="initial_inventory_account" label="Carga de Stock Inicial (Patrimonio)" accountType="EQUITY" />
                                            <AccountField form={form} name="revaluation_account" label="Revalorización de Stock" accountType="INCOME" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="md:col-span-2 bg-muted/5 border-dashed">
                                    <CardHeader>
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Configuración de Respaldo (Legacy / Fallback)</CardTitle>
                                        <CardDescription className="text-xs">Cuentas obsoletas mantenidas por compatibilidad. Se recomienda no utilizarlas.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-70 grayscale-[0.5]">
                                        <AccountField form={form} name="default_inventory_account" label="Inventario Global (Obsoleto)" accountType="ASSET" />
                                        <AccountField form={form} name="default_expense_account" label="Gasto Global (Obsoleto)" accountType="EXPENSE" />
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="structure" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Jerarquía del Plan de Cuentas</CardTitle>
                                    <CardDescription>Defina cómo se construyen los códigos de cuenta y sus prefijos.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="code_format"
                                        render={({ field }) => (
                                            <FormItem className="max-w-md">
                                                <FormLabel>Formato de Código</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Ej: X.X.XX.XXX" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <FormField control={form.control} name="asset_prefix" render={({ field }) => (
                                            <FormItem><FormLabel>Activos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="liability_prefix" render={({ field }) => (
                                            <FormItem><FormLabel>Pasivos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="equity_prefix" render={({ field }) => (
                                            <FormItem><FormLabel>Patrimonio</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="income_prefix" render={({ field }) => (
                                            <FormItem><FormLabel>Ingresos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="expense_prefix" render={({ field }) => (
                                            <FormItem><FormLabel>Gastos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                        )} />
                                    </div>

                                    <Alert>
                                        <Settings2 className="h-4 w-4" />
                                        <AlertTitle>Nota sobre prefijos</AlertTitle>
                                        <AlertDescription>
                                            El sistema utiliza estos prefijos para sugerir códigos al crear nuevas cuentas en el nivel raíz.
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="business" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Valoración de Inventario</CardTitle>
                                        <CardDescription>Determine cómo el sistema calcula el costo de sus existencias.</CardDescription>
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

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-emerald-600">Control de Caja POS</CardTitle>
                                        <CardDescription>Reglas automáticas para el cierre de terminales.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="pos_cash_difference_approval_threshold"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <FormLabel className="text-xs font-semibold uppercase">Umbral de Aprobación Aut.</FormLabel>
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
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </form>
                </Form>
            </Tabs>
        </div>
    )
}

interface AccountFieldProps {
    form: UseFormReturn<AccountingFormValues>
    name: keyof AccountingFormValues
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
                            onChange={field.onChange}
                            accountType={accountType}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
