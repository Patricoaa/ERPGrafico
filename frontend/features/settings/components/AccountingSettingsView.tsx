"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Settings2, Receipt, Percent, Coins, TrendingUp } from "lucide-react"
import { FormSkeleton } from "@/components/shared/FormSkeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeaderButton } from "@/components/shared/PageHeader"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { AccountSelector } from "@/components/selectors/AccountSelector"

import { accountingSchema, taxSchema, type AccountingFormValues, type TaxFormValues } from "./AccountingSettingsView.schema"
import { UseFormReturn } from "react-hook-form"

// --- COMPONENT ---

export function AccountingSettingsView({ activeTab = "structure", onSavingChange }: { 
    activeTab?: string,
    onSavingChange?: (saving: boolean) => void 
}) {
    const [currentTab, setCurrentTab] = useState(activeTab)

    return (
        <div className="space-y-6">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-md border-2">
                    <TabsTrigger value="structure" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <Settings2 className="h-3.5 w-3.5" />
                        Estructura Contable
                    </TabsTrigger>
                    <TabsTrigger value="tax" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <Receipt className="h-3.5 w-3.5" />
                        Impuestos (F29)
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="structure">
                        <StructureSettings onSavingChange={onSavingChange} />
                    </TabsContent>
                    <TabsContent value="tax">
                        <TaxSettings onSavingChange={onSavingChange} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}

// --- SUB-COMPONENTS ---

function StructureSettings({ onSavingChange }: { onSavingChange?: (saving: boolean) => void }) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [populating, setPopulating] = useState(false)

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: {
            hierarchy_levels: 4,
            code_separator: ".",
            asset_prefix: "1",
            liability_prefix: "2",
            equity_prefix: "3",
            income_prefix: "4",
            expense_prefix: "5",
        }
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/accounting/settings/current/')
                const settings = res.data
                const formattedSettings = {} as AccountingFormValues
                const keys = Object.keys(accountingSchema.shape) as (keyof AccountingFormValues)[]

                keys.forEach((key) => {
                    const val = settings[key]
                    if (val === null || val === undefined) {
                        (formattedSettings as Record<string, unknown>)[key] = (key.includes('prefix') || key === 'code_separator' ? "" : (key === 'hierarchy_levels' ? 4 : null))
                    } else {
                        (formattedSettings as Record<string, unknown>)[key] = (typeof val === 'number' ? val : val.toString())
                    }
                })
                form.reset(formattedSettings)
            } catch (error: unknown) {
                toast.error("Error al cargar configuración")
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: AccountingFormValues) => {
        setSaving(true)
        onSavingChange?.(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            form.reset(data)
        } catch {
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
            onSavingChange?.(false)
        }
    }, [form, onSavingChange])

    useEffect(() => {
        if (!loading && isDirty) {
            const timer = setTimeout(() => form.handleSubmit(onSubmit)(), 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, loading, isDirty, form, onSubmit])

    const handlePopulateIFRS = async () => {
        if (!confirm("¿Está seguro de cargar el plan de cuentas IFRS? Esto creará las cuentas detalladas y configurará todos los mapeos predeterminados automáticamente.")) return
        setPopulating(true)
        try {
            const res = await api.post('/accounting/accounts/populate_ifrs/')
            toast.success(res.data.message)
            window.location.reload()
        } catch (error: unknown) {
            toast.error("Error al poblar plan de cuentas")
        } finally {
            setPopulating(false)
        }
    }

    if (loading) return <FormSkeleton fields={3} />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg border border-dashed border-primary/20">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Plan de Cuentas IFRS</p>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">Poblar estructura recomendada automáticamente</p>
                </div>
                <PageHeaderButton
                    onClick={handlePopulateIFRS}
                    disabled={populating}
                    iconName={populating ? "loader-2" : "database"}
                    label={populating ? "Poblar IFRS" : "Poblar IFRS"}
                    variant="outline"
                />
            </div>

            <Form {...form}>
                <form className="space-y-6">
                    <Card className="border-primary/10 shadow-sm rounded-md border-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Estructura del Código</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-sm flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-primary/80 tracking-tighter">Vista Previa del Formato</p>
                                    <p className="text-[9px] text-muted-foreground uppercase opacity-70">Ejemplo nivel {form.watch("hierarchy_levels")}</p>
                                </div>
                                <div className="px-4 py-2 bg-background border-2 rounded-sm text-xl font-mono font-bold tracking-tighter text-primary">
                                    {generatePreview(form.getValues())}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="hierarchy_levels"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Niveles de Jerarquía</FormLabel>
                                                <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                                                    <FormControl><SelectTrigger className="h-9 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent className="text-[10px] font-mono border-2">
                                                        {[2, 3, 4, 5].map((n) => <SelectItem key={n} value={n.toString()}>{n} Niveles</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="code_separator"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Separador</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9 rounded-sm"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent className="text-[10px] font-mono border-2">
                                                        <SelectItem value=".">Punto ( . )</SelectItem>
                                                        <SelectItem value="-">Guion ( - )</SelectItem>
                                                        <SelectItem value="/">Slash ( / )</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="space-y-4 p-4 bg-muted/20 rounded-sm border-2 border-dashed">
                                    <h4 className="text-[10px] font-black uppercase opacity-60 mb-2">Prefijos (Nivel 1)</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <PrefixField form={form} name="asset_prefix" label="Activos" />
                                        <PrefixField form={form} name="liability_prefix" label="Pasivos" />
                                        <PrefixField form={form} name="equity_prefix" label="Patrimonio" />
                                        <PrefixField form={form} name="income_prefix" label="Ingresos" />
                                        <PrefixField form={form} name="expense_prefix" label="Gastos" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

function TaxSettings({ onSavingChange }: { onSavingChange?: (saving: boolean) => void }) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const form = useForm<TaxFormValues>({
        resolver: zodResolver(taxSchema),
        defaultValues: {
            default_tax_rate: 19.00,
            vat_payable_account: null,
            vat_carryforward_account: null,
            withholding_tax_account: null,
            ppm_account: null,
            second_category_tax_account: null,
            correction_income_account: null,
            default_tax_receivable_account: null,
            default_tax_payable_account: null,
        }
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/accounting/settings/current/')
                const settings = res.data
                const formattedSettings = {} as TaxFormValues
                const fields = Object.keys(taxSchema.shape)

                fields.forEach((key) => {
                    const val = settings[key]
                    const typedKey = key as keyof TaxFormValues
                    if (val === null || val === undefined) {
                        (formattedSettings as Record<string, unknown>)[typedKey] = (key === 'default_tax_rate' ? 19.00 : null)
                    } else if (key === 'default_tax_rate') {
                        (formattedSettings as Record<string, unknown>)[typedKey] = parseFloat(val.toString())
                    } else {
                        (formattedSettings as Record<string, unknown>)[typedKey] = val.toString()
                    }
                })
                form.reset(formattedSettings)
            } catch (error: unknown) {
                toast.error("Error al cargar configuración")
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: TaxFormValues) => {
        setSaving(true)
        onSavingChange?.(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            form.reset(data)
        } catch {
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
            onSavingChange?.(false)
        }
    }, [form, onSavingChange])

    useEffect(() => {
        if (!loading && isDirty) {
            const timer = setTimeout(() => form.handleSubmit(onSubmit)(), 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, loading, isDirty, form, onSubmit])

    if (loading) return <FormSkeleton fields={4} cards={3} />

    return (
        <Form {...form}>
            <form className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1 border-2 rounded-md">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Percent className="h-4 w-4" />
                                Tasa General
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="default_tax_rate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">IVA Chile (%)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input {...field} type="number" step="0.01" className="h-10 rounded-sm font-mono text-lg" onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-black">%</span>
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-2 rounded-md">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    IVA y F29
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="default_tax_payable_account" label="IVA Débito Fiscal" accountType="LIABILITY" />
                                    <AccountField form={form} name="default_tax_receivable_account" label="IVA Crédito Fiscal" accountType="ASSET" />
                                </div>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="vat_payable_account" label="IVA por Pagar (F29)" accountType="LIABILITY" />
                                    <AccountField form={form} name="vat_carryforward_account" label="Remanente IVA" accountType="ASSET" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="correction_income_account" label="IPCU / Corrección Monetaria" accountType="INCOME" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-2 rounded-md">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                    <Coins className="h-4 w-4" />
                                    Contribuciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="ppm_account" label="PPM (Pago Prov.)" accountType="ASSET" />
                                    <AccountField form={form} name="withholding_tax_account" label="Retenciones Honorarios" accountType="LIABILITY" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="second_category_tax_account" label="Impuesto Único Trabajadores" accountType="LIABILITY" />
                                </div>
                                <div className="p-3 rounded-sm bg-info/10 border-2 border-info/20 text-[10px] text-info font-bold uppercase flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Cuentas reguladoras de cierre fiscal automático.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
    )
}

function AccountField({ form, name, label, accountType }: { form: UseFormReturn<TaxFormValues>, name: keyof TaxFormValues, label: string, accountType: string }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">{label}</FormLabel>
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

function PrefixField({ form, name, label }: { form: UseFormReturn<AccountingFormValues>, name: keyof AccountingFormValues, label: string }) {
    return (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem className="space-y-1">
                <FormLabel className="text-[9px] font-black uppercase text-muted-foreground/60">{label}</FormLabel>
                <FormControl><Input {...field} className="h-8 rounded-sm font-mono text-[11px]" /></FormControl>
            </FormItem>
        )} />
    )
}

function generatePreview(values: AccountingFormValues) {
    const { hierarchy_levels, code_separator, asset_prefix } = values;
    let code = asset_prefix || "1";
    const levels = [{ padding: 1 }, { padding: 2 }, { padding: 2 }, { padding: 3 }];
    for (let i = 0; i < Math.min(hierarchy_levels - 1, levels.length); i++) {
        code += (code_separator || ".") + "1".padStart(levels[i].padding, "0");
    }
    return code;
}
