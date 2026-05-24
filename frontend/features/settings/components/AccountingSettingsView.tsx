"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { settingsApi } from "../hooks"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import {
    Settings2,
    Coins,
    TrendingUp,
    Percent,
    Receipt,
} from "lucide-react"
import { AutoSaveStatusBadge, LabeledInput, LabeledSelect, FadeIn, ActionConfirmModal } from "@/components/shared"
import { PageHeaderButton } from "@/components/shared/PageHeader"
import { Separator } from "@/components/ui/separator"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import { accountingSchema, defaultsSchema, taxSchema, type AccountingFormValues, type DefaultsFormValues, type TaxFormValues } from "./AccountingSettingsView.schema"

// --- COMPONENT ---

export function AccountingSettingsView({ activeTab = "structure" }: { activeTab?: string }) {
    return (
        <div className="space-y-6">
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
    const { structure: settings, refetch } = useAccountingSettings()
    const [populating, setPopulating] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: settings,
    })

    const onSave = useCallback(async (data: AccountingFormValues) => {
        await settingsApi.updateCurrentSettings(data as any)
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

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
                        <Card variant="transparent" className="border-primary/10 border-2">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Estructura del Código</CardTitle>
                                <CardDescription className="text-xs">Establezca los niveles de jerarquía y el formato del código para su Plan de Cuentas</CardDescription>
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
                        <Card variant="transparent" className="border-primary/10 border-2">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Prefijos de Cuentas</CardTitle>
                                <CardDescription className="text-xs">Establezca los prefijos del Nivel 1 para clasificar cada tipo de cuenta contable</CardDescription>
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

                    <Card variant="transparent" className="border-primary/10 border-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Plan de Cuentas IFRS</CardTitle>
                            <CardDescription className="text-xs">Cargue el Plan de Cuentas oficial recomendado por la normativa IFRS para comenzar de inmediato</CardDescription>
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
    const { defaults: settings } = useAccountingSettings()

    const form = useForm<DefaultsFormValues>({
        resolver: zodResolver(defaultsSchema),
        defaultValues: settings,
    })

    const onSave = useCallback(async (data: DefaultsFormValues) => {
        await settingsApi.updateCurrentSettings(data as any)
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    return (
        <Form {...form}>
            <form className="space-y-6">
                <div className="flex justify-end">
                    <AutoSaveStatusBadge
                        status={status}
                        invalidReason={invalidReason}
                        lastSavedAt={lastSavedAt}
                        onRetry={retry}
                    />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card variant="transparent" className="border-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Cuentas Comerciales Globales
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Cuentas por defecto de naturaleza deudora y acreedora para clientes y proveedores genéricos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <DefaultsAccountField form={form} name="default_receivable_account" label="Cuentas por Cobrar (Clientes)" accountType="ASSET" />
                            <DefaultsAccountField form={form} name="default_payable_account" label="Cuentas por Pagar (Proveedores)" accountType="LIABILITY" />
                        </CardContent>
                    </Card>

                    <Card variant="transparent" className="border-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Coins className="h-4 w-4" />
                                Resultados por Defecto
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Cuentas de salvavidas (fallback) para ingresos y gastos cuando no hay reglas específicas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <DefaultsAccountField form={form} name="default_revenue_account" label="Ingresos por Ventas (Fallback)" accountType="INCOME" />
                            <DefaultsAccountField form={form} name="default_expense_account" label="Gastos Generales (Fallback)" accountType="EXPENSE" />
                        </CardContent>
                    </Card>

                    <Card variant="transparent" className="border-2 lg:col-span-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Settings2 className="h-4 w-4" />
                                Costos y Ajustes de Inventario
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Cuentas para asentar automáticamente los movimientos de bodega (COGS y mermas).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DefaultsAccountField form={form} name="merchandise_cogs_account" label="Costo de Mercadería (CMV)" accountType="EXPENSE" />
                            <DefaultsAccountField form={form} name="manufactured_cogs_account" label="Costo de Producción Vendida" accountType="EXPENSE" />

                            <DefaultsAccountField form={form} name="adjustment_income_account" label="Ingreso por Ajuste (Sobrantes)" accountType="INCOME" />
                            <DefaultsAccountField form={form} name="adjustment_expense_account" label="Gasto por Ajuste (Mermas)" accountType="EXPENSE" />
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
    )
}

function TaxSettings() {
    const { tax: settings } = useAccountingSettings()

    const form = useForm<TaxFormValues>({
        resolver: zodResolver(taxSchema),
        defaultValues: settings,
    })

    const onSave = useCallback(async (data: TaxFormValues) => {
        await settingsApi.updateCurrentSettings(data as any)
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    return (
        <Form {...form}>
            <form className="space-y-6">
                <div className="flex justify-end">
                    <AutoSaveStatusBadge
                        status={status}
                        invalidReason={invalidReason}
                        lastSavedAt={lastSavedAt}
                        onRetry={retry}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card variant="transparent" className="md:col-span-1 border-2">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Percent className="h-5 w-5 text-primary" />
                                <div>
                                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Tasa General</CardTitle>
                                    <CardDescription className="text-xs">Parámetros impositivos base</CardDescription>
                                </div>
                            </div>
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
                        <Card variant="transparent" className="border-2">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-5 w-5 text-warning" />
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Impuesto al Valor Agregado (IVA)</CardTitle>
                                        <CardDescription className="text-xs">Cuentas para el control mensual de IVA F29</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <TaxAccountField form={form} name="default_tax_payable_account" label="IVA Débito Fiscal (Mensual)" accountType="LIABILITY" />
                                    <TaxAccountField form={form} name="default_tax_receivable_account" label="IVA Crédito Fiscal (Mensual)" accountType="ASSET" />
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <TaxAccountField form={form} name="vat_payable_account" label="IVA por Pagar (Cierre)" accountType="LIABILITY" />
                                    <TaxAccountField form={form} name="vat_carryforward_account" label="Remanente IVA" accountType="ASSET" />
                                </div>

                                <div className="p-3 rounded-lg bg-warning/5 border border-warning/10 text-[11px] text-warning flex items-start gap-2">
                                    <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>Al cerrar un período mensual, los saldos de Crédito y Débito se netean contra las cuentas de IVA por Pagar o Remanente.</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card variant="transparent" className="border-2">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Coins className="h-5 w-5 text-success" />
                                    <div>
                                        <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Otras Contribuciones</CardTitle>
                                        <CardDescription className="text-xs">Retenciones, PPM y corrección monetaria</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <TaxAccountField form={form} name="ppm_account" label="PPM por Pagar / Recuperar" accountType="ASSET" />
                                    <TaxAccountField form={form} name="withholding_tax_account" label="Retenciones Honorarios (10.75%)" accountType="LIABILITY" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <TaxAccountField form={form} name="second_category_tax_account" label="Impuesto Único trabajadores" accountType="LIABILITY" />
                                    <TaxAccountField form={form} name="correction_income_account" label="IPCU / Corrección Monetaria" accountType="INCOME" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <TaxAccountField form={form} name="loan_retention_account" label="Retención Préstamo Solidario" accountType="LIABILITY" />
                                    <TaxAccountField form={form} name="ila_tax_account" label="Impuesto ILA (Alcoholes/Bebidas)" accountType="LIABILITY" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <TaxAccountField form={form} name="vat_withholding_account" label="Retención IVA (Cambio Sujeto)" accountType="LIABILITY" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
    )
}

function TaxAccountField({ form, name, label, accountType }: { form: UseFormReturn<TaxFormValues>, name: keyof TaxFormValues, label: string, accountType: string }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
                <AccountSelector
                    label={label}
                    value={field.value as string}
                    onChange={(val) => field.onChange(val)}
                    accountType={accountType}
                    error={fieldState.error?.message}
                />
            )}
        />
    )
}

function DefaultsAccountField({ form, name, label, accountType }: { form: UseFormReturn<DefaultsFormValues>, name: keyof DefaultsFormValues, label: string, accountType: string }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
                <AccountSelector
                    label={label}
                    value={field.value as string}
                    onChange={(val) => field.onChange(val)}
                    accountType={accountType}
                    error={fieldState.error?.message}
                />
            )}
        />
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
