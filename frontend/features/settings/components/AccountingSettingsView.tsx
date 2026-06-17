"use client"

import {useState, useEffect, useCallback} from "react"
import { useForm, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { TrendingUp } from "lucide-react"
import { AccountField, ActionConfirmModal, AutoSaveStatusBadge, FadeIn, LabeledInput, LabeledSelect, PageHeaderButton, SkeletonShell } from '@/components/shared'
import { settingsApi } from "@/features/settings/api/settingsApi"

import { Separator } from "@/components/ui/separator"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import { accountingSchema, defaultsSchema, taxSchema, type AccountingFormValues, type DefaultsFormValues, type TaxFormValues } from "@/features/settings/schemas/accounting"

// --- COMPONENT ---

export function AccountingSettingsView({ activeTab = "structure" }: { activeTab?: string }) {
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <FadeIn key={activeTab}>
                {activeTab === "structure" && <StructureSettings />}
                {activeTab === "defaults" && <DefaultsSettings />}
                {activeTab === "tax" && <TaxSettings />}
            </FadeIn>
        </div>
    )
}

// --- SUB-COMPONENTS ---

import { useAccountingSettings } from "@/features/settings/hooks/useAccountingSettings"

function StructureSettings() {
    const { structure: settings, isLoading, refetch, updateSettings } = useAccountingSettings()
    const [populating, setPopulating] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: {
            hierarchy_levels: 4,
            code_separator: ".",
            asset_prefix: "",
            liability_prefix: "",
            equity_prefix: "",
            income_prefix: "",
            expense_prefix: "",
        },
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: AccountingFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración..." />

    const formValues = form.watch()

    const handlePopulateIFRS = () => setConfirmOpen(true)

    const onConfirmPopulate = async () => {
        setPopulating(true)
        try {
            const res = await settingsApi.populateIfrsChart()
            const { toast } = await import("sonner")
            toast.success(res.message)
            window.location.reload()
        } catch {
            const { toast } = await import("sonner")
            toast.error("Error al poblar plan de cuentas")
        } finally {
            setPopulating(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge
                    status={status}
                    invalidReason={invalidReason}
                    lastSavedAt={lastSavedAt}
                    onRetry={retry}
                />
            </div>

            <Form {...form}>
                <form className="space-y-6">
                    {/* Fila 1: Dos columnas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Columna 1: Estructura del Código */}
                        <Card variant="transparent">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Estructura del Código</CardTitle>
                                <CardDescription>Establezca los niveles de jerarquía y el formato del código para su Plan de Cuentas</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Vista previa del formato */}
                                <fieldset className="notched-field bg-primary/[0.03] border-primary/20 pointer-events-none select-none">
                                    <legend className="px-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">
                                        Vista Previa del Formato
                                    </legend>
                                    <div className="flex items-center justify-between w-full min-h-[2.5rem] py-1">
                                        <p className="text-[10px] text-muted-foreground uppercase opacity-75 font-bold pl-2.5">
                                            Ejemplo nivel {formValues.hierarchy_levels}
                                        </p>
                                        <div className="px-4 py-1.5 bg-background border border-primary/20 rounded-sm text-lg font-mono font-bold tracking-tighter text-primary mr-1">
                                            {generatePreview(formValues)}
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="hierarchy_levels"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Niveles de Jerarquía"
                                                value={field.value?.toString() || "4"}
                                                onChange={(val) => field.onChange(parseInt(val))}
                                                error={fieldState.error?.message}
                                                options={[2, 3, 4, 5].map((n) => ({ value: n.toString(), label: `${n} Niveles` }))}
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="code_separator"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Separador"
                                                value={field.value || "."}
                                                onChange={field.onChange}
                                                error={fieldState.error?.message}
                                                options={[
                                                    { value: ".", label: "Punto ( . )" },
                                                    { value: "-", label: "Guion ( - )" },
                                                    { value: "/", label: "Slash ( / )" },
                                                ]}
                                            />
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Columna 2: Prefijos de Cuentas */}
                        <Card variant="transparent">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Prefijos de Cuentas</CardTitle>
                                <CardDescription>Establezca los prefijos del Nivel 1 para clasificar cada tipo de cuenta contable</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <PrefixField form={form} name="asset_prefix" label="Activos" />
                                    <PrefixField form={form} name="liability_prefix" label="Pasivos" />
                                    <PrefixField form={form} name="equity_prefix" label="Patrimonio" />
                                    <PrefixField form={form} name="income_prefix" label="Ingresos" />
                                    <div className="col-span-2 md:col-span-1">
                                        <PrefixField form={form} name="expense_prefix" label="Gastos" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card variant="transparent">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Plan de Cuentas IFRS</CardTitle>
                            <CardDescription>Cargue el Plan de Cuentas oficial recomendado por la normativa IFRS para comenzar de inmediato</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-sm">
                            <div className="space-y-1">
                                <p className="text-[11px] font-bold uppercase text-primary/80">Generación Automática de Cuentas</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Esta acción creará las cuentas detalladas y configurará los mapeos contables por defecto de manera instantánea.</p>
                            </div>
                            <PageHeaderButton
                                onClick={handlePopulateIFRS}
                                disabled={populating}
                                iconName={populating ? "loader-2" : "database"}
                                label={populating ? "Poblar Plan de Cuentas IFRS" : "Poblar Plan de Cuentas IFRS"}
                                variant="outline"
                                className="font-bold whitespace-nowrap px-4 py-2 rounded-sm"
                            />
                        </CardContent>
                    </Card>
                </form>
            </Form>

            <ActionConfirmModal
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={onConfirmPopulate}
                title="Cargar Plan de Cuentas IFRS"
                description="¿Está seguro de cargar el plan de cuentas IFRS? Esto creará las cuentas detalladas y configurará todos los mapeos predeterminados automáticamente."
                variant="warning"
                confirmText="Cargar Plan IFRS"
            />
        </div>
    )
}

function DefaultsSettings() {
    const { defaults: settings, isLoading, updateSettings } = useAccountingSettings()

    const form = useForm<DefaultsFormValues>({
        resolver: zodResolver(defaultsSchema),
        defaultValues: {
            default_receivable_account: null,
            default_payable_account: null,
            default_revenue_account: null,
            default_expense_account: null,
            merchandise_cogs_account: null,
            manufactured_cogs_account: null,
            adjustment_income_account: null,
            adjustment_expense_account: null,
        },
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: DefaultsFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge
                    status={status}
                    invalidReason={invalidReason}
                    lastSavedAt={lastSavedAt}
                    onRetry={retry}
                />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card variant="transparent">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas Comerciales Globales</CardTitle>
                            <CardDescription>
                                Cuentas por defecto de naturaleza deudora y acreedora para clientes y proveedores genéricos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <AccountField form={form} name="default_receivable_account" label="Cuentas por Cobrar (Clientes)" accountType="ASSET" />
                            <AccountField form={form} name="default_payable_account" label="Cuentas por Pagar (Proveedores)" accountType="LIABILITY" />
                        </CardContent>
                    </Card>

                    <Card variant="transparent">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Resultados por Defecto</CardTitle>
                            <CardDescription>
                                Cuentas de salvavidas (fallback) para ingresos y gastos cuando no hay reglas específicas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <AccountField form={form} name="default_revenue_account" label="Ingresos por Ventas (Fallback)" accountType="INCOME" />
                            <AccountField form={form} name="default_expense_account" label="Gastos Generales (Fallback)" accountType="EXPENSE" />
                        </CardContent>
                    </Card>

                    <Card variant="transparent" className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Costos y Ajustes de Inventario</CardTitle>
                            <CardDescription>
                                Cuentas para asentar automáticamente los movimientos de bodega (COGS y mermas).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AccountField form={form} name="merchandise_cogs_account" label="Costo de Mercadería (CMV)" accountType="EXPENSE" />
                            <AccountField form={form} name="manufactured_cogs_account" label="Costo de Producción Vendida" accountType="EXPENSE" />

                            <AccountField form={form} name="adjustment_income_account" label="Ingreso por Ajuste (Sobrantes)" accountType="INCOME" />
                            <AccountField form={form} name="adjustment_expense_account" label="Gasto por Ajuste (Mermas)" accountType="EXPENSE" />
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
        </div>
    )
}

function TaxSettings() {
    const { tax: settings, isLoading, updateSettings } = useAccountingSettings()

    const form = useForm<TaxFormValues>({
        resolver: zodResolver(taxSchema),
        defaultValues: {
            default_vat_rate: 19.00,
            vat_payable_account: null,
            vat_carryforward_account: null,
            withholding_tax_account: null,
            ppm_account: null,
            second_category_tax_account: null,
            correction_income_account: null,
            default_tax_receivable_account: null,
            default_tax_payable_account: null,
            loan_retention_account: null,
            ila_tax_account: null,
            vat_withholding_account: null,
        },
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: TaxFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge
                    status={status}
                    invalidReason={invalidReason}
                    lastSavedAt={lastSavedAt}
                    onRetry={retry}
                />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card variant="transparent" className="md:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Tasa General</CardTitle>
                            <CardDescription>Parámetros impositivos base</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="default_vat_rate"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="IVA Predeterminado (%)"
                                        suffix={<span className="text-muted-foreground text-sm">%</span>}
                                        type="number"
                                        step="0.01"
                                        error={fieldState.error?.message}
                                        {...field}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                )}
                            />
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-primary">
                                Esta tasa se aplica automáticamente a todos los documentos de venta y compra sujetos a IVA.
                            </div>
                        </CardContent>
                    </Card>

                    <div className="md:col-span-2 space-y-6">
                        <Card variant="transparent">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Impuesto al Valor Agregado (IVA)</CardTitle>
                                <CardDescription>Cuentas para el control mensual de IVA F29</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="default_tax_payable_account" label="IVA Débito Fiscal (Mensual)" accountType="LIABILITY" />
                                    <AccountField form={form} name="default_tax_receivable_account" label="IVA Crédito Fiscal (Mensual)" accountType="ASSET" />
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="vat_payable_account" label="IVA por Pagar (Cierre)" accountType="LIABILITY" />
                                    <AccountField form={form} name="vat_carryforward_account" label="Remanente IVA" accountType="ASSET" />
                                </div>

                                <div className="p-3 rounded-lg bg-warning/5 border border-warning/10 text-[11px] text-warning flex items-start gap-2">
                                    <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>Al cerrar un período mensual, los saldos de Crédito y Débito se netean contra las cuentas de IVA por Pagar o Remanente.</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card variant="transparent">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Otras Contribuciones</CardTitle>
                                <CardDescription>Retenciones, PPM y corrección monetaria</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="ppm_account" label="PPM por Pagar / Recuperar" accountType="ASSET" />
                                    <AccountField form={form} name="withholding_tax_account" label="Retenciones Honorarios (10.75%)" accountType="LIABILITY" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="second_category_tax_account" label="Impuesto Único trabajadores" accountType="LIABILITY" />
                                    <AccountField form={form} name="correction_income_account" label="IPCU / Corrección Monetaria" accountType="INCOME" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="loan_retention_account" label="Retención Préstamo Solidario" accountType="LIABILITY" />
                                    <AccountField form={form} name="ila_tax_account" label="Impuesto ILA (Alcoholes/Bebidas)" accountType="LIABILITY" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="vat_withholding_account" label="Retención IVA (Cambio Sujeto)" accountType="LIABILITY" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
        </div>
    )
}

function PrefixField({ form, name, label }: { form: UseFormReturn<AccountingFormValues>, name: keyof AccountingFormValues, label: string }) {
    return (
        <FormField control={form.control} name={name} render={({ field, fieldState }) => (
            <LabeledInput
                {...field}
                value={field.value?.toString() || ""}
                label={label}
                error={fieldState.error?.message}
                className="font-mono text-[11px]"
            />
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
