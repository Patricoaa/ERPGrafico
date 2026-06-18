"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { AccountField, ActionConfirmModal, AutoSaveStatusBadge, FadeIn, LabeledInput, LabeledSelect, PageHeaderButton, SkeletonShell, UnderlineTabs, UnderlineTabsContent } from "@/components/shared"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { settingsApi } from "@/features/settings/api/settingsApi"

import { accountingSchema, type AccountingFormValues } from "@/features/settings/schemas/accounting"
import { useAccountingSettings } from "@/features/settings/hooks/useAccountingSettings"
import { useSalesSettings } from "@/features/settings/hooks/useSalesSettings"
import { useBillingSettings } from "@/features/settings/hooks/useBillingSettings"
import { useInventorySettings } from "@/features/settings/hooks/useInventorySettings"
import { useTreasurySettings } from "@/features/settings/hooks/useTreasurySettings"
import { accountingApi } from "@/features/accounting/api/accountingApi"

const TABS = [
    { value: "estructura", label: "Estructura" },
    { value: "ventas", label: "Ventas" },
    { value: "facturacion", label: "Facturación" },
    { value: "compras", label: "Compras" },
    { value: "inventario", label: "Inventario" },
    { value: "tesoreria", label: "Tesorería" },
    { value: "rrhh", label: "RRHH" },
    { value: "socios", label: "Socios" },
    { value: "impuestos", label: "Impuestos" },
]

export function UnifiedAccountsView() {
    const [activeTab, setActiveTab] = useState("ventas")

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <UnderlineTabs
                items={TABS}
                value={activeTab}
                onValueChange={setActiveTab}
                variant="underline"
                orientation="horizontal"
            >
                <UnderlineTabsContent value="estructura">
                    {activeTab === "estructura" && <EstructuraForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="ventas">
                    {activeTab === "ventas" && <VentasForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="facturacion">
                    {activeTab === "facturacion" && <FacturacionForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="compras">
                    {activeTab === "compras" && <ComprasForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="inventario">
                    {activeTab === "inventario" && <InventarioForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="tesoreria">
                    {activeTab === "tesoreria" && <TesoreriasForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="rrhh">
                    {activeTab === "rrhh" && <RRHHForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="socios">
                    {activeTab === "socios" && <SociosForm />}
                </UnderlineTabsContent>
                <UnderlineTabsContent value="impuestos">
                    {activeTab === "impuestos" && <ImpuestosForm />}
                </UnderlineTabsContent>
            </UnderlineTabs>
        </div>
    )
}

/* ───────── Ventas ───────── */

const ventasSchema = z.object({
    default_revenue_account: z.string().nullable(),
    default_service_revenue_account: z.string().nullable(),
    default_subscription_revenue_account: z.string().nullable(),
    default_uncollectible_expense_account: z.string().nullable(),
})

type VentasFormValues = z.infer<typeof ventasSchema>

const VENTAS_DEFAULTS: VentasFormValues = {
    default_revenue_account: null,
    default_service_revenue_account: null,
    default_subscription_revenue_account: null,
    default_uncollectible_expense_account: null,
}

function VentasForm() {
    const { settings, isLoading, updateSettings } = useSalesSettings()
    const [initialized, setInitialized] = useState(false)

    const form = useForm<VentasFormValues>({
        resolver: zodResolver(ventasSchema),
        defaultValues: VENTAS_DEFAULTS,
    })

    useEffect(() => {
        if (settings && !initialized) {
            form.reset({
                default_revenue_account: settings.default_revenue_account?.toString() ?? null,
                default_service_revenue_account: settings.default_service_revenue_account?.toString() ?? null,
                default_subscription_revenue_account: settings.default_subscription_revenue_account?.toString() ?? null,
                default_uncollectible_expense_account: settings.default_uncollectible_expense_account?.toString() ?? null,
            })
            setInitialized(true)
        }
    }, [settings, form, initialized])

    const onSave = useCallback(async (data: VentasFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !initialized) return <SkeletonShell isLoading ariaLabel="Cargando configuración de ventas..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <Card variant="default">
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
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuenta de Castigo (Incobrables)</CardTitle>
                            <CardDescription>Cuenta donde se cargarán las pérdidas al castigar deudas de clientes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AccountField form={form} name="default_uncollectible_expense_account" label="Cuenta Gasto Incobrables" accountType="EXPENSE" />
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Facturación ───────── */

const facturacionSchema = z.object({
    default_receivable_account: z.string().nullable(),
    default_payable_account: z.string().nullable(),
    default_advance_payment_account: z.string().nullable(),
    default_prepayment_account: z.string().nullable(),
})

type FacturacionFormValues = z.infer<typeof facturacionSchema>

const FACTURACION_DEFAULTS: FacturacionFormValues = {
    default_receivable_account: null,
    default_payable_account: null,
    default_advance_payment_account: null,
    default_prepayment_account: null,
}

function FacturacionForm() {
    const { settings, isLoading, updateSettings } = useBillingSettings()
    const [initialized, setInitialized] = useState(false)

    const form = useForm<FacturacionFormValues>({
        resolver: zodResolver(facturacionSchema),
        defaultValues: FACTURACION_DEFAULTS,
    })

    useEffect(() => {
        if (settings && !initialized) {
            form.reset({
                default_receivable_account: settings.default_receivable_account?.toString() ?? null,
                default_payable_account: settings.default_payable_account?.toString() ?? null,
                default_advance_payment_account: settings.default_advance_payment_account?.toString() ?? null,
                default_prepayment_account: settings.default_prepayment_account?.toString() ?? null,
            })
            setInitialized(true)
        }
    }, [settings, form, initialized])

    const onSave = useCallback(async (data: FacturacionFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !initialized) return <SkeletonShell isLoading ariaLabel="Cargando configuración de facturación..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Cuentas por Cobrar</CardTitle>
                                <CardDescription>Gestión de clientes y anticipos recibidos</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <AccountField form={form} name="default_receivable_account" label="CxC Clientes (Activo)" accountType="ASSET" />
                                <AccountField form={form} name="default_advance_payment_account" label="Anticipos de Clientes (Pasivo)" accountType="LIABILITY" />
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Cuentas por Pagar</CardTitle>
                                <CardDescription>Gestión de proveedores y anticipos entregados</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <AccountField form={form} name="default_payable_account" label="CxP Proveedores (Pasivo)" accountType="LIABILITY" />
                                <AccountField form={form} name="default_prepayment_account" label="Anticipos a Proveedores (Activo)" accountType="ASSET" />
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Compras ───────── */

import { purchasingSchema, type PurchasingFormValues } from "@/features/settings/schemas/purchasing"

function ComprasForm() {
    const { purchasing: settings, isLoading, updateSettings } = useAccountingSettings()
    const [initialized, setInitialized] = useState(false)

    const form = useForm<PurchasingFormValues>({
        resolver: zodResolver(purchasingSchema),
        defaultValues: {
            default_expense_account: null,
            default_service_expense_account: null,
            default_subscription_expense_account: null,
        },
    })

    useEffect(() => {
        if (settings && !initialized) {
            form.reset(settings)
            setInitialized(true)
        }
    }, [settings, form, initialized])

    const onSave = useCallback(async (data: PurchasingFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !initialized) return <SkeletonShell isLoading ariaLabel="Cargando configuración de compras..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas de Gastos Predeterminadas</CardTitle>
                            <CardDescription>Configuración de contrapartidas contables para compras y gastos operativos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <AccountField form={form} name="default_expense_account" label="Cuenta Gastos Generales (Insumos/Stock)" accountType="EXPENSE" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="default_service_expense_account" label="Gastos por Servicios Externos" accountType="EXPENSE" />
                                <AccountField form={form} name="default_subscription_expense_account" label="Gastos por Suscripciones Digitales" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Inventario ───────── */

const inventarioSchema = z.object({
    storable_inventory_account: z.string().nullable(),
    manufacturable_inventory_account: z.string().nullable(),
    default_consumable_account: z.string().nullable(),
    stock_input_account: z.string().nullable(),
    stock_output_account: z.string().nullable(),
    adjustment_income_account: z.string().nullable(),
    adjustment_expense_account: z.string().nullable(),
    revaluation_account: z.string().nullable(),
    merchandise_cogs_account: z.string().nullable(),
    manufactured_cogs_account: z.string().nullable(),
})

type InventarioFormValues = z.infer<typeof inventarioSchema>

const INVENTARIO_DEFAULTS: InventarioFormValues = {
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
}

function InventarioForm() {
    const { settings, isLoading, updateSettings } = useInventorySettings()
    const [initialized, setInitialized] = useState(false)

    const form = useForm<InventarioFormValues>({
        resolver: zodResolver(inventarioSchema),
        defaultValues: INVENTARIO_DEFAULTS,
    })

    useEffect(() => {
        if (settings && !initialized) {
            const formatted: Partial<InventarioFormValues> = {}
            const keys = Object.keys(inventarioSchema.shape) as (keyof InventarioFormValues)[]
            keys.forEach((key) => {
                const val = settings[key]
                ;(formatted as Record<string, unknown>)[key] = val ? val.toString() : null
            })
            form.reset(formatted as InventarioFormValues)
            setInitialized(true)
        }
    }, [settings, form, initialized])

    const onSave = useCallback(async (data: InventarioFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !initialized) return <SkeletonShell isLoading ariaLabel="Cargando configuración de inventario..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas por Tipo de Producto</CardTitle>
                            <CardDescription>Cuentas de inventario según el tipo de producto</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <AccountField form={form} name="storable_inventory_account" label="Almacenables (STORABLE)" accountType="ASSET" />
                            <AccountField form={form} name="manufacturable_inventory_account" label="Fabricables (MANUFACTURABLE)" accountType="ASSET" />
                            <AccountField form={form} name="default_consumable_account" label="Consumibles (Gasto)" accountType="EXPENSE" />
                        </CardContent>
                    </Card>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas Puente</CardTitle>
                            <CardDescription>Cuentas intermedias para movimientos de stock</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AccountField form={form} name="stock_input_account" label="Recepciones" accountType="LIABILITY" />
                                <AccountField form={form} name="stock_output_account" label="Despachos" accountType="ASSET" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas de Ajuste</CardTitle>
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
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Costo de Ventas (COGS)</CardTitle>
                            <CardDescription>Cuentas de gasto para el costo de productos vendidos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AccountField form={form} name="merchandise_cogs_account" label="Costo Mercaderías (STORABLE)" accountType="EXPENSE" />
                                <AccountField form={form} name="manufactured_cogs_account" label="Costo Producción (MANUFACTURABLE)" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Tesorería ───────── */

import { treasurySchema, type TreasuryFormValues } from "@/features/settings/schemas/treasury"

const TESORERIA_DEFAULTS: TreasuryFormValues = {
    bank_commission_account: null,
    interest_income_account: null,
    exchange_difference_account: null,
    rounding_adjustment_account: null,
    error_adjustment_account: null,
    miscellaneous_adjustment_account: null,
    pos_cash_difference_gain_account: null,
    pos_cash_difference_loss_account: null,
    pos_tip_account: null,
    pos_other_inflow_account: null,
    pos_counting_error_account: null,
    pos_system_error_account: null,
    pos_partner_withdrawal_account: null,
    pos_theft_account: null,
    pos_rounding_adjustment_account: null,
    pos_cashback_error_account: null,
    pos_other_outflow_account: null,
    terminal_commission_bridge_account: null,
    terminal_iva_bridge_account: null,
    check_portfolio_account: null,
    issued_checks_account: null,
    interest_expense_account: null,
    insurance_expense_account: null,
    interest_payable_account: null,
    loan_penalty_expense_account: null,
    loan_commission_expense_account: null,
    loan_stamp_tax_expense_account: null,
}

function TesoreriasForm() {
    const { settings, isLoading, updateSettings } = useTreasurySettings()
    const [initialized, setInitialized] = useState(false)

    const form = useForm<TreasuryFormValues>({
        resolver: zodResolver(treasurySchema),
        defaultValues: TESORERIA_DEFAULTS,
    })

    useEffect(() => {
        if (settings && !initialized) {
            form.reset(settings)
            setInitialized(true)
        }
    }, [settings, form, initialized])

    const onSave = useCallback(async (data: TreasuryFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !initialized) return <SkeletonShell isLoading ariaLabel="Cargando configuración de tesorería..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas de Conciliación Bancaria</CardTitle>
                            <CardDescription>Identificadores para ajustes automáticos en conciliación por lotes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="bank_commission_account" label="Gasto Comisiones Bancarias" accountType="EXPENSE" />
                                <AccountField form={form} name="interest_income_account" label="Ingreso por Intereses" accountType="INCOME" />
                                <AccountField form={form} name="exchange_difference_account" label="Diferencia de Cambio (M.E)" accountType="INCOME" />
                                <AccountField form={form} name="rounding_adjustment_account" label="Ajuste por Redondeo / Centavos" accountType="EXPENSE" />
                                <AccountField form={form} name="error_adjustment_account" label="Ajustes por Errores Operativos" accountType="EXPENSE" />
                                <AccountField form={form} name="miscellaneous_adjustment_account" label="Otros Ajustes de Tesorería" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Diferencias de Cierre de Caja (Arqueo)</CardTitle>
                            <CardDescription>Control de discrepancias entre saldo teórico y físico en POS</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="pos_cash_difference_gain_account" label="Sobrante de Caja (Ganancia)" accountType="INCOME" />
                                <AccountField form={form} name="pos_cash_difference_loss_account" label="Faltante de Caja (Pérdida)" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas para Movimientos Manuales</CardTitle>
                            <CardDescription>Configuración de ingresos y egresos ad-hoc del módulo POS</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="pos_tip_account" label="Recaudación Propinas" accountType="INCOME" />
                                <AccountField form={form} name="pos_partner_withdrawal_account" label="Retiro de Socios desde POS" accountType="EQUITY" />
                                <AccountField form={form} name="pos_other_inflow_account" label="Otros Ingresos Operativos" accountType="INCOME" />
                                <AccountField form={form} name="pos_counting_error_account" label="Ajuste Error de Conteo (Sobrante)" accountType="INCOME" />
                                <AccountField form={form} name="pos_system_error_account" label="Ajuste Operativo (Corrección)" accountType="EXPENSE" />
                                <AccountField form={form} name="pos_theft_account" label="Pérdidas / Merma de Efectivo" accountType="EXPENSE" />
                                <AccountField form={form} name="pos_rounding_adjustment_account" label="Redondeo de Pago" accountType="EXPENSE" />
                                <AccountField form={form} name="pos_cashback_error_account" label="Faltante por Vuelto Incorrecto" accountType="EXPENSE" />
                                <AccountField form={form} name="pos_other_outflow_account" label="Egresos Varios de Caja" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas Puente de Terminales</CardTitle>
                            <CardDescription>Cuentas para comisiones de terminales de pago sin factura</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="terminal_commission_bridge_account" label="Puente Comisión Neto" accountType="ASSET" />
                                <AccountField form={form} name="terminal_iva_bridge_account" label="Puente IVA Comisión" accountType="ASSET" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas de Cheques</CardTitle>
                            <CardDescription>Cuentas puente para contabilización de cheques recibidos y emitidos</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="check_portfolio_account" label="Cheques en Cartera (Documentos por Cobrar)" accountType="ASSET" />
                                <AccountField form={form} name="issued_checks_account" label="Cheques Girados por Pagar (Pasivo)" accountType="LIABILITY" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas de Gasto Financiero</CardTitle>
                            <CardDescription>Cuentas contables para intereses, seguros y comisiones bancarias</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="interest_expense_account" label="Gasto por Intereses (Préstamos / Tarjeta)" accountType="EXPENSE" />
                                <AccountField form={form} name="insurance_expense_account" label="Gasto por Seguros (Desgravamen / Cesantía)" accountType="EXPENSE" />
                                <AccountField form={form} name="interest_payable_account" label="Intereses por Pagar (Pasivo Devengado)" accountType="LIABILITY" />
                                <AccountField form={form} name="loan_penalty_expense_account" label="Gasto por Mora (Préstamos)" accountType="EXPENSE" />
                                <AccountField form={form} name="loan_commission_expense_account" label="Gasto por Comisión de Apertura" accountType="EXPENSE" />
                                <AccountField form={form} name="loan_stamp_tax_expense_account" label="Gasto por Impuesto de Timbres (ITE)" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

/* ───────── RRHH ───────── */

import { hrSchema, type HRSettingsFormValues } from "@/features/settings/schemas/accounting"

const RRHH_DEFAULTS: HRSettingsFormValues = {
    account_remuneraciones_por_pagar: null,
    account_previred_por_pagar: null,
    account_anticipos: null,
}

function RRHHForm() {
    const { hr: settings, isLoading, updateSettings } = useAccountingSettings()
    const [initialized, setInitialized] = useState(false)

    const form = useForm<HRSettingsFormValues>({
        resolver: zodResolver(hrSchema),
        defaultValues: RRHH_DEFAULTS,
    })

    useEffect(() => {
        if (!isLoading && settings && !initialized) {
            form.reset(settings)
            setInitialized(true)
        }
    }, [settings, isLoading, initialized, form])

    const onSave = useCallback(async (data: HRSettingsFormValues) => {
        const payload: Record<string, unknown> = {
            account_remuneraciones_por_pagar: data.account_remuneraciones_por_pagar ? parseInt(data.account_remuneraciones_por_pagar) : null,
            account_previred_por_pagar: data.account_previred_por_pagar ? parseInt(data.account_previred_por_pagar) : null,
            account_anticipos: data.account_anticipos ? parseInt(data.account_anticipos) : null,
        }
        await updateSettings(payload)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !initialized) return <SkeletonShell isLoading ariaLabel="Cargando configuración de RRHH..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Cuentas Consolidadas de Remuneraciones</CardTitle>
                            <CardDescription>Cuentas contables de cierre de nómina centralizado</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormField
                                control={form.control}
                                name="account_remuneraciones_por_pagar"
                                render={({ field }) => (
                                    <AccountSelector
                                        label="Remuneraciones por Pagar (Líquido)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="LIABILITY"
                                    />
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="account_previred_por_pagar"
                                render={({ field }) => (
                                    <AccountSelector
                                        label="Obligaciones Previred (Pasivo)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="LIABILITY"
                                    />
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="account_anticipos"
                                render={({ field }) => (
                                    <AccountSelector
                                        label="Anticipos de Remuneraciones (Activo)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="ASSET"
                                    />
                                )}
                            />
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Socios ───────── */

const sociosSchema = z.object({
    partner_capital_social_account: z.string().nullable(),
    partner_capital_contribution_account: z.string().nullable(),
    partner_withdrawal_account: z.string().nullable(),
    partner_provisional_withdrawal_account: z.string().nullable(),
    partner_capital_receivable_account: z.string().nullable(),
    partner_retained_earnings_account: z.string().nullable(),
    partner_current_year_earnings_account: z.string().nullable(),
    partner_dividends_payable_account: z.string().nullable(),
})

type SociosFormValues = z.infer<typeof sociosSchema>

const SOCIOS_DEFAULTS: SociosFormValues = {
    partner_capital_social_account: null,
    partner_capital_contribution_account: null,
    partner_withdrawal_account: null,
    partner_provisional_withdrawal_account: null,
    partner_capital_receivable_account: null,
    partner_retained_earnings_account: null,
    partner_current_year_earnings_account: null,
    partner_dividends_payable_account: null,
}

function SociosForm() {
    const [settings, setSettings] = useState<SociosFormValues | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const form = useForm<SociosFormValues>({
        resolver: zodResolver(sociosSchema),
        defaultValues: SOCIOS_DEFAULTS,
    })

    useEffect(() => {
        (async () => {
            try {
                const data = await accountingApi.getSettings()
                const formatted: SociosFormValues = {
                    partner_capital_social_account: data.partner_capital_social_account?.toString() || null,
                    partner_capital_contribution_account: data.partner_capital_contribution_account?.toString() || null,
                    partner_withdrawal_account: data.partner_withdrawal_account?.toString() || null,
                    partner_provisional_withdrawal_account: data.partner_provisional_withdrawal_account?.toString() || null,
                    partner_capital_receivable_account: data.partner_capital_receivable_account?.toString() || null,
                    partner_retained_earnings_account: data.partner_retained_earnings_account?.toString() || null,
                    partner_current_year_earnings_account: data.partner_current_year_earnings_account?.toString() || null,
                    partner_dividends_payable_account: data.partner_dividends_payable_account?.toString() || null,
                }
                setSettings(formatted)
                form.reset(formatted)
            } catch {
                toast.error("Error al cargar configuración de socios")
            } finally {
                setIsLoading(false)
            }
        })()
    }, [form])

    const onSave = useCallback(async (data: SociosFormValues) => {
        await accountingApi.updateSettings({
            partner_capital_social_account: data.partner_capital_social_account ? parseInt(data.partner_capital_social_account) : null,
            partner_capital_contribution_account: data.partner_capital_contribution_account ? parseInt(data.partner_capital_contribution_account) : null,
            partner_withdrawal_account: data.partner_withdrawal_account ? parseInt(data.partner_withdrawal_account) : null,
            partner_provisional_withdrawal_account: data.partner_provisional_withdrawal_account ? parseInt(data.partner_provisional_withdrawal_account) : null,
            partner_capital_receivable_account: data.partner_capital_receivable_account ? parseInt(data.partner_capital_receivable_account) : null,
            partner_retained_earnings_account: data.partner_retained_earnings_account ? parseInt(data.partner_retained_earnings_account) : null,
            partner_current_year_earnings_account: data.partner_current_year_earnings_account ? parseInt(data.partner_current_year_earnings_account) : null,
            partner_dividends_payable_account: data.partner_dividends_payable_account ? parseInt(data.partner_dividends_payable_account) : null,
        })
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de socios..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Capital Social</CardTitle>
                                <CardDescription>Cuenta raíz donde se registra el Capital Social de los socios</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_capital_social_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Capital Social"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Capital Social..."
                                            accountType="EQUITY"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Aportes de Capital</CardTitle>
                                <CardDescription>Cuenta raíz para los aportes de capital realizados por los socios</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_capital_contribution_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Aportes de Capital"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Aportes..."
                                            accountType="EQUITY"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Retiros Definitivos</CardTitle>
                                <CardDescription>Cuenta raíz para retiros definitivos de capital de los socios</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_withdrawal_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Retiros Definitivos"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Retiros..."
                                            accountType="EQUITY"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Retiros Provisorios</CardTitle>
                                <CardDescription>Cuenta raíz (contra patrimonio) para retiros provisorios de los socios</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_provisional_withdrawal_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Retiros Provisorios"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Retiros Provisorios..."
                                            accountType="EQUITY"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Capital por Cobrar</CardTitle>
                                <CardDescription>Cuenta de activo para el capital suscrito aún no pagado por los socios</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_capital_receivable_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Capital por Cobrar"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Capital por Cobrar..."
                                            accountType="ASSET"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Utilidades Retenidas</CardTitle>
                                <CardDescription>Cuenta de patrimonio que acumula resultados de ejercicios anteriores</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_retained_earnings_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Utilidades Retenidas"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Utilidades Retenidas..."
                                            accountType="EQUITY"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Resultado del Ejercicio</CardTitle>
                                <CardDescription>Cuenta de patrimonio para la utilidad o pérdida del período en curso</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_current_year_earnings_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Resultado del Ejercicio"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Resultado..."
                                            accountType="EQUITY"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Dividendos por Pagar</CardTitle>
                                <CardDescription>Cuenta de pasivo para dividendos declarados pendientes de pago</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="partner_dividends_payable_account"
                                    render={({ field }) => (
                                        <AccountSelector
                                            label="Cuenta de Dividendos por Pagar"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar cuenta de Dividendos por Pagar..."
                                            accountType="LIABILITY"
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Estructura (Plan de Cuentas) ───────── */

const ESTRUCTURA_DEFAULTS: AccountingFormValues = {
    hierarchy_levels: 4,
    code_separator: ".",
    asset_prefix: "",
    liability_prefix: "",
    equity_prefix: "",
    income_prefix: "",
    expense_prefix: "",
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

function EstructuraForm() {
    const { structure: settings, isLoading, updateSettings } = useAccountingSettings()
    const [initialized, setInitialized] = useState(false)

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: ESTRUCTURA_DEFAULTS,
    })

    useEffect(() => {
        if (!isLoading && settings && !initialized) {
            form.reset(settings)
            setInitialized(true)
        }
    }, [settings, isLoading, initialized, form])

    const onSave = useCallback(async (data: AccountingFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    const [populating, setPopulating] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

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

    if (isLoading && !initialized) return <SkeletonShell isLoading ariaLabel="Cargando estructura contable..." />

    const formValues = useWatch({ control: form.control }) as AccountingFormValues

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Estructura del Código</CardTitle>
                                <CardDescription>Establezca los niveles de jerarquía y el formato del código para su Plan de Cuentas</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
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
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Prefijos de Cuentas</CardTitle>
                                <CardDescription>Establezca los prefijos del Nivel 1 para clasificar cada tipo de cuenta contable</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="asset_prefix" render={({ field, fieldState }) => (
                                        <LabeledInput {...field} value={field.value?.toString() || ""} label="Activos" error={fieldState.error?.message} className="font-mono text-[11px]" />
                                    )} />
                                    <FormField control={form.control} name="liability_prefix" render={({ field, fieldState }) => (
                                        <LabeledInput {...field} value={field.value?.toString() || ""} label="Pasivos" error={fieldState.error?.message} className="font-mono text-[11px]" />
                                    )} />
                                    <FormField control={form.control} name="equity_prefix" render={({ field, fieldState }) => (
                                        <LabeledInput {...field} value={field.value?.toString() || ""} label="Patrimonio" error={fieldState.error?.message} className="font-mono text-[11px]" />
                                    )} />
                                    <FormField control={form.control} name="income_prefix" render={({ field, fieldState }) => (
                                        <LabeledInput {...field} value={field.value?.toString() || ""} label="Ingresos" error={fieldState.error?.message} className="font-mono text-[11px]" />
                                    )} />
                                    <div className="col-span-2 md:col-span-1">
                                        <FormField control={form.control} name="expense_prefix" render={({ field, fieldState }) => (
                                            <LabeledInput {...field} value={field.value?.toString() || ""} label="Gastos" error={fieldState.error?.message} className="font-mono text-[11px]" />
                                        )} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <Card variant="default">
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

/* ───────── Impuestos ───────── */

import { taxSchema, type TaxFormValues } from "@/features/settings/schemas/accounting"

const IMPUESTOS_DEFAULTS: TaxFormValues = {
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

function ImpuestosForm() {
    const { tax: settings, isLoading, updateSettings } = useAccountingSettings()

    const form = useForm<TaxFormValues>({
        resolver: zodResolver(taxSchema),
        defaultValues: IMPUESTOS_DEFAULTS,
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: TaxFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de impuestos..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card variant="default" className="md:col-span-1">
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
                                            value={field.value}
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
                            <Card variant="default">
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
                            <Card variant="default">
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Otras Contribuciones</CardTitle>
                                    <CardDescription>Retenciones, PPM y corrección monetaria</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <AccountField form={form} name="ppm_account" label="PPM por Pagar / Recuperar" accountType="ASSET" />
                                        <AccountField form={form} name="withholding_tax_account" label="Retenciones Honorarios (10.75%)" accountType="ASSET" />
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
