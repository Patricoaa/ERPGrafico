"use client"

import React, { useCallback, useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { AccountField, AutoSaveStatusBadge, LabeledInput, SkeletonShell, UnderlineTabs, UnderlineTabsContent } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { useAccountingSettings } from "@/features/settings/hooks/useAccountingSettings"
import { defaultsSchema, taxSchema } from "@/features/settings/schemas/accounting"

const accountingAccountsSchema = z.object({
    ...defaultsSchema.shape,
    ...taxSchema.shape,
})

type AccountingAccountsFormValues = z.infer<typeof accountingAccountsSchema>

const ACCOUNT_TABS = [
    { value: "defaults", label: "Por Defecto" },
    { value: "tax", label: "Impuestos" },
]

const DEFAULT_VALUES: AccountingAccountsFormValues = {
    default_receivable_account: null,
    default_payable_account: null,
    default_revenue_account: null,
    default_expense_account: null,
    merchandise_cogs_account: null,
    manufactured_cogs_account: null,
    adjustment_income_account: null,
    adjustment_expense_account: null,
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
}

export function AccountingAccountsView() {
    const { defaults, tax, isLoading, updateSettings } = useAccountingSettings()
    const [activeTab, setActiveTab] = useState("defaults")

    const settings = useMemo(() => {
        if (!defaults || !tax) return null
        return { ...defaults, ...tax }
    }, [defaults, tax])

    const form = useForm<AccountingAccountsFormValues>({
        resolver: zodResolver(accountingAccountsSchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: AccountingAccountsFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración contable..." />

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
                <form>
                    <UnderlineTabs
                        items={ACCOUNT_TABS}
                        value={activeTab}
                        onValueChange={setActiveTab}
                        variant="underline"
                        orientation="horizontal"
                    >
                        <UnderlineTabsContent value="defaults">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
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

                                <Card>
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

                                <Card className="lg:col-span-2">
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="tax">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="md:col-span-1">
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
                                    <Card>
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
                                        </CardContent>
                                    </Card>

                                    <Card>
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
                        </UnderlineTabsContent>
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
