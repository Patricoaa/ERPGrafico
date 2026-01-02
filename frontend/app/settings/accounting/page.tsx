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
import { ChevronLeft, Loader2 } from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"

const accountingSchema = z.object({
    default_receivable_account: z.string().nullable(),
    default_payable_account: z.string().nullable(),
    default_revenue_account: z.string().nullable(),
    default_expense_account: z.string().nullable(),
    default_tax_receivable_account: z.string().nullable(),
    default_tax_payable_account: z.string().nullable(),
    default_inventory_account: z.string().nullable(),
    default_cash_treasury_account: z.string().nullable(),
    default_card_treasury_account: z.string().nullable(),
    default_transfer_treasury_account: z.string().nullable(),
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

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: {
            default_receivable_account: null,
            default_payable_account: null,
            default_revenue_account: null,
            default_expense_account: null,
            default_tax_receivable_account: null,
            default_tax_payable_account: null,
            default_inventory_account: null,
            default_cash_treasury_account: null,
            default_card_treasury_account: null,
            default_transfer_treasury_account: null,
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
        if (!confirm("¿Está seguro de cargar el plan de cuentas IFRS? Esto creará las cuentas básicas si no existen.")) return
        setSaving(true)
        try {
            const res = await api.post('/accounting/accounts/populate_ifrs/')
            toast.success(res.data.message)
            window.location.reload() // Reload to fetch new accounts and updated settings
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al poblar plan de cuentas")
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

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">Configuración Contable</h2>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cuentas Predeterminadas</CardTitle>
                            <CardDescription>Defina las cuentas que se utilizarán automáticamente en las operaciones del sistema.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="default_receivable_account" label="Cuenta por Cobrar (Clientes)" accountType="ASSET" />
                                <AccountField form={form} name="default_payable_account" label="Cuenta por Pagar (Proveedores)" accountType="LIABILITY" />
                                <AccountField form={form} name="default_revenue_account" label="Cuenta de Ingresos (Ventas)" accountType="INCOME" />
                                <AccountField form={form} name="default_expense_account" label="Cuenta de Gastos (Compras)" accountType="EXPENSE" />
                                <AccountField form={form} name="default_tax_receivable_account" label="IVA Crédito (Compras)" accountType="ASSET" />
                                <AccountField form={form} name="default_tax_payable_account" label="IVA Débito (Ventas)" accountType="LIABILITY" />
                                <AccountField form={form} name="default_inventory_account" label="Cuenta de Inventario" accountType="ASSET" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t">
                                <div className="col-span-full">
                                    <h3 className="text-sm font-medium text-muted-foreground mb-4">Cuentas de Tesorería (Pagos y Cobros)</h3>
                                </div>
                                <TreasuryField form={form} name="default_cash_treasury_account" label="Caja Predeterminada (Efectivo)" type="CASH" />
                                <TreasuryField form={form} name="default_transfer_treasury_account" label="Cuenta Predeterminada (Transferencia)" type="BANK" />
                                <TreasuryField form={form} name="default_card_treasury_account" label="Cuenta Predeterminada (Tarjeta)" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Formato y Jerarquía</CardTitle>
                            <CardDescription>Configure la estructura del plan de cuentas y prefijos por tipo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="code_format"
                                render={({ field }) => (
                                    <FormItem>
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
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Inventario</CardTitle>
                            <CardDescription>Configure el comportamiento de la valoración de existencias.</CardDescription>
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
                                                <SelectItem value="FIFO">FIFO (Primero en entrar, primero en salir)</SelectItem>
                                                <SelectItem value="LIFO">LIFO (Último en entrar, primero en salir)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="flex justify-between items-center">
                        <Button type="button" variant="outline" onClick={handlePopulateIFRS} disabled={saving}>
                            Cargar Plan de Cuentas IFRS
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Configuración
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}

interface AccountFieldProps {
    form: UseFormReturn<AccountingFormValues>
    name: any
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
                    <FormLabel>{label}</FormLabel>
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
}

function TreasuryField({ form, name, label, type }: { form: UseFormReturn<AccountingFormValues>, name: any, label: string, type?: 'BANK' | 'CASH' }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <TreasuryAccountSelector
                            value={field.value}
                            onChange={field.onChange}
                            type={type}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
