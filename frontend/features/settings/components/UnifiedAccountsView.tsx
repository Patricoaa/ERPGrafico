"use client"

import React, { useCallback, useEffect, useRef, useState, startTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSearchParams, usePathname, useRouter } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { AccountField, ActionConfirmModal, AutoSaveStatusBadge, LabeledInput, LabeledSelect, PageHeaderButton, SkeletonShell, TabBar, TabBarContent } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useInitializeForm } from "@/hooks/useInitializeForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { settingsApi } from "@/features/settings/api/settingsApi"

import { structureSchema, type StructureFormValues } from "@/features/settings/schemas/structure"
import { salesAccountsSchema, type SalesAccountsFormValues } from "@/features/settings/schemas/sales"
import { billingAccountsSchema, type BillingAccountsFormValues } from "@/features/settings/schemas/billing"
import { inventoryAccountsSchema, type InventoryAccountsFormValues } from "@/features/settings/schemas/inventory"
import { hrSchema, type HRSettingsFormValues } from "@/features/settings/schemas/hr"
import { taxSchema, type TaxFormValues } from "@/features/settings/schemas/tax"
import { partnerAccountsSchema, type PartnerAccountsFormValues } from "@/features/settings/schemas/partner"
import { useAccountingSettings } from "@/features/settings/hooks/useAccountingSettings"
import { useSalesSettings } from "@/features/settings/hooks/useSalesSettings"
import { useBillingSettings } from "@/features/settings/hooks/useBillingSettings"
import { useInventorySettings } from "@/features/settings/hooks/useInventorySettings"
import { useTreasurySettings } from "@/features/settings/hooks/useTreasurySettings"
import { usePartnerSettings } from "@/features/settings/hooks/usePartnerSettings"

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
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const tabParam = searchParams.get('tab')
    const [activeTab, setActiveTab] = useState(
        TABS.some(t => t.value === tabParam) ? (tabParam as string) : "ventas"
    )
    const isFirstRender = useRef(true)

    const handleTabChange = useCallback((value: string) => {
        setActiveTab(value)
        router.replace(`${pathname}?tab=${value}`, { scroll: false })
    }, [pathname, router])

    // Sync URL → state on browser back/forward
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        if (tabParam && tabParam !== activeTab && TABS.some(t => t.value === tabParam)) {
            startTransition(() => {
                setActiveTab(tabParam)
            })
        }
    }, [tabParam]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col">
            <TabBar
                items={TABS}
                value={activeTab}
                onValueChange={handleTabChange}
                orientation="horizontal"
                contentClassName="overflow-y-auto bg-card"
            >
                <TabBarContent value="estructura">
                    {activeTab === "estructura" && <EstructuraForm />}
                </TabBarContent>
                <TabBarContent value="ventas">
                    {activeTab === "ventas" && <VentasForm />}
                </TabBarContent>
                <TabBarContent value="facturacion">
                    {activeTab === "facturacion" && <FacturacionForm />}
                </TabBarContent>
                <TabBarContent value="compras">
                    {activeTab === "compras" && <ComprasForm />}
                </TabBarContent>
                <TabBarContent value="inventario">
                    {activeTab === "inventario" && <InventarioForm />}
                </TabBarContent>
                <TabBarContent value="tesoreria">
                    {activeTab === "tesoreria" && <TesoreriasForm />}
                </TabBarContent>
                <TabBarContent value="rrhh">
                    {activeTab === "rrhh" && <RRHHForm />}
                </TabBarContent>
                <TabBarContent value="socios">
                    {activeTab === "socios" && <SociosForm />}
                </TabBarContent>
                <TabBarContent value="impuestos">
                    {activeTab === "impuestos" && <ImpuestosForm />}
                </TabBarContent>
            </TabBar>
        </div>
    )
}

/* ───────── Ventas ───────── */

const VENTAS_DEFAULTS: SalesAccountsFormValues = {
    default_revenue_account: null,
    default_service_revenue_account: null,
    default_subscription_revenue_account: null,
    default_uncollectible_expense_account: null,
}

function VentasForm() {
    const { settings, isLoading, updateSettings } = useSalesSettings()

    const form = useForm<SalesAccountsFormValues>({
        resolver: zodResolver(salesAccountsSchema),
        defaultValues: VENTAS_DEFAULTS,
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => ({
            default_revenue_account: (s as unknown as Record<string, unknown>).default_revenue_account?.toString() ?? null,
            default_service_revenue_account: (s as unknown as Record<string, unknown>).default_service_revenue_account?.toString() ?? null,
            default_subscription_revenue_account: (s as unknown as Record<string, unknown>).default_subscription_revenue_account?.toString() ?? null,
            default_uncollectible_expense_account: (s as unknown as Record<string, unknown>).default_uncollectible_expense_account?.toString() ?? null,
        }),
    })

    const onSave = useCallback(async (data: SalesAccountsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de ventas..." />

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
                                <CardTitle className="text-lg text-primary">Cuentas de Ingresos Naturales</CardTitle>
                                <CardDescription>Cuentas contables para registrar los distintos tipos de ingresos por venta</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="default_revenue_account" label="Ingreso General (Productos)" accountType="INCOME" />
                                    <AccountField form={form} name="default_service_revenue_account" label="Ingresos por Servicios" accountType="INCOME" />
                                    <div className="md:col-span-2"><AccountField form={form} name="default_subscription_revenue_account" label="Ingresos por Suscripciones" accountType="INCOME" /></div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Cuenta de Castigo (Incobrables)</CardTitle>
                                <CardDescription>Cuenta donde se cargarán las pérdidas al castigar deudas de clientes</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                                    <AccountField form={form} name="default_uncollectible_expense_account" label="Cuenta Gasto Incobrables" accountType="EXPENSE" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Facturación ───────── */

const FACTURACION_DEFAULTS: BillingAccountsFormValues = {
    default_receivable_account: null,
    default_payable_account: null,
    default_advance_payment_account: null,
    default_prepayment_account: null,
}

function FacturacionForm() {
    const { settings, isLoading, updateSettings } = useBillingSettings()

    const form = useForm<BillingAccountsFormValues>({
        resolver: zodResolver(billingAccountsSchema),
        defaultValues: FACTURACION_DEFAULTS,
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => ({
            default_receivable_account: (s as unknown as Record<string, unknown>).default_receivable_account?.toString() ?? null,
            default_payable_account: (s as unknown as Record<string, unknown>).default_payable_account?.toString() ?? null,
            default_advance_payment_account: (s as unknown as Record<string, unknown>).default_advance_payment_account?.toString() ?? null,
            default_prepayment_account: (s as unknown as Record<string, unknown>).default_prepayment_account?.toString() ?? null,
        }),
    })

    const onSave = useCallback(async (data: BillingAccountsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de facturación..." />

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
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="default_receivable_account" label="CxC Clientes (Activo)" accountType="ASSET" />
                                    <AccountField form={form} name="default_advance_payment_account" label="Anticipos de Clientes (Pasivo)" accountType="LIABILITY" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Cuentas por Pagar</CardTitle>
                                <CardDescription>Gestión de proveedores y anticipos entregados</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="default_payable_account" label="CxP Proveedores (Pasivo)" accountType="LIABILITY" />
                                    <AccountField form={form} name="default_prepayment_account" label="Anticipos a Proveedores (Activo)" accountType="ASSET" />
                                </div>
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

    const form = useForm<PurchasingFormValues>({
        resolver: zodResolver(purchasingSchema),
        defaultValues: {
            default_expense_account: null,
            default_consumable_account: null,
            default_service_expense_account: null,
            default_subscription_expense_account: null,
        },
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => {
            const formatted: Partial<PurchasingFormValues> = {}
            const keys = Object.keys(purchasingSchema.shape) as (keyof PurchasingFormValues)[]
            keys.forEach((key) => {
                const val = (s as unknown as Record<string, unknown>)[key]
                    ; (formatted as Record<string, unknown>)[key] = val ? val.toString() : null
            })
            return formatted as PurchasingFormValues
        },
    })

    const onSave = useCallback(async (data: PurchasingFormValues) => {
        await updateSettings(data as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de compras..." />

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
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="default_expense_account" label="Gastos Generales / Insumos (STORABLE)" accountType="EXPENSE" />
                                <AccountField form={form} name="default_consumable_account" label="Gastos Materiales Consumibles (CONSUMABLE)" accountType="EXPENSE" />
                                <AccountField form={form} name="default_service_expense_account" label="Gastos por Servicios (SERVICE)" accountType="EXPENSE" />
                                <AccountField form={form} name="default_subscription_expense_account" label="Gastos por Suscripciones (SUBSCRIPTION)" accountType="EXPENSE" />
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Inventario ───────── */

const INVENTARIO_DEFAULTS: InventoryAccountsFormValues = {
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

    const form = useForm<InventoryAccountsFormValues>({
        resolver: zodResolver(inventoryAccountsSchema),
        defaultValues: INVENTARIO_DEFAULTS,
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => {
            const formatted: Partial<InventoryAccountsFormValues> = {}
            const keys = Object.keys(inventoryAccountsSchema.shape) as (keyof InventoryAccountsFormValues)[]
            keys.forEach((key) => {
                const val = (s as unknown as Record<string, unknown>)[key]
                    ; (formatted as Record<string, unknown>)[key] = val ? val.toString() : null
            })
            return formatted as InventoryAccountsFormValues
        },
    })

    const onSave = useCallback(async (data: InventoryAccountsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de inventario..." />

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
                                <CardTitle className="text-lg text-primary">Cuentas por Tipo de Producto</CardTitle>
                                <CardDescription>Cuentas de inventario según el tipo de producto</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="storable_inventory_account" label="Almacenables (STORABLE)" accountType="ASSET" />
                                    <AccountField form={form} name="manufacturable_inventory_account" label="Fabricables (MANUFACTURABLE)" accountType="ASSET" />
                                    <div className="md:col-span-2"><AccountField form={form} name="default_consumable_account" label="Consumibles (Gasto)" accountType="EXPENSE" /></div>
                                </div>
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
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="adjustment_income_account" label="Sobrantes" accountType="INCOME" />
                                    <AccountField form={form} name="adjustment_expense_account" label="Mermas" accountType="EXPENSE" />
                                    <div className="md:col-span-2"><AccountField form={form} name="revaluation_account" label="Revalorización de Stock" accountType="INCOME" /></div>
                                </div>
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
                    </div>
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
    tax_withholding_account: null,
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

    const form = useForm<TreasuryFormValues>({
        resolver: zodResolver(treasurySchema),
        defaultValues: TESORERIA_DEFAULTS,
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => {
            const formatted: Partial<TreasuryFormValues> = {}
            const keys = Object.keys(treasurySchema.shape) as (keyof TreasuryFormValues)[]
            keys.forEach((key) => {
                const val = (s as unknown as Record<string, unknown>)[key]
                    ; (formatted as Record<string, unknown>)[key] = val ? val.toString() : null
            })
            return formatted as TreasuryFormValues
        },
    })

    const onSave = useCallback(async (data: TreasuryFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de tesorería..." />

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
                                    <div className="md:col-span-2"><AccountField form={form} name="tax_withholding_account" label="Ajustes por Retenciones de Impuestos" accountType="LIABILITY" /></div>
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
                        <div className="md:col-span-2">
                            <Card variant="default">
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Cuentas para Movimientos Manuales y Arqueo POS</CardTitle>
                                    <CardDescription>Configuración de ingresos, egresos y diferencias de caja del módulo POS</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase text-primary/60 mb-3 tracking-wider">Ingresos POS</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <AccountField form={form} name="pos_tip_account" label="Recaudación Propinas" accountType="INCOME" />
                                            <AccountField form={form} name="pos_other_inflow_account" label="Otros Ingresos Operativos" accountType="INCOME" />
                                            <AccountField form={form} name="pos_counting_error_account" label="Ajuste Error de Conteo (Sobrante)" accountType="INCOME" />
                                            <AccountField form={form} name="pos_rounding_adjustment_account" label="Redondeo de Pago" accountType="EXPENSE" />
                                        </div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <p className="text-[11px] font-bold uppercase text-primary/60 mb-3 tracking-wider">Egresos POS</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <AccountField form={form} name="pos_partner_withdrawal_account" label="Retiro de Socios desde POS" accountType="EQUITY" />
                                            <AccountField form={form} name="pos_system_error_account" label="Ajuste Operativo (Corrección)" accountType="EXPENSE" />
                                            <AccountField form={form} name="pos_theft_account" label="Pérdidas / Merma de Efectivo" accountType="EXPENSE" />
                                    <AccountField form={form} name="pos_cashback_error_account" label="Faltante por Vuelto Incorrecto" accountType="EXPENSE" />
                                    <div className="md:col-span-2"><AccountField form={form} name="pos_other_outflow_account" label="Egresos Varios de Caja" accountType="EXPENSE" /></div>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <p className="text-[11px] font-bold uppercase text-primary/60 mb-3 tracking-wider">Diferencias de Arqueo</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <AccountField form={form} name="pos_cash_difference_gain_account" label="Sobrante de Caja (Ganancia)" accountType="INCOME" />
                                            <AccountField form={form} name="pos_cash_difference_loss_account" label="Faltante de Caja (Pérdida)" accountType="EXPENSE" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
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
                    </div>
                </form>
            </Form>
        </div>
    )
}

/* ───────── RRHH ───────── */

const RRHH_DEFAULTS: HRSettingsFormValues = {
    account_remuneraciones_por_pagar: null,
    account_previred_por_pagar: null,
    account_anticipos: null,
}

function RRHHForm() {
    const { hr: settings, isLoading, updateSettings } = useAccountingSettings()

    const form = useForm<HRSettingsFormValues>({
        resolver: zodResolver(hrSchema),
        defaultValues: RRHH_DEFAULTS,
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => {
            const formatted: Partial<HRSettingsFormValues> = {}
            const keys = Object.keys(hrSchema.shape) as (keyof HRSettingsFormValues)[]
            keys.forEach((key) => {
                const val = (s as unknown as Record<string, unknown>)[key]
                    ; (formatted as Record<string, unknown>)[key] = val ? val.toString() : null
            })
            return formatted as HRSettingsFormValues
        },
    })

    const onSave = useCallback(async (data: HRSettingsFormValues) => {
        await updateSettings(data as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de RRHH..." />

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
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <AccountField form={form} name="account_remuneraciones_por_pagar" label="Remuneraciones por Pagar (Líquido)" accountType="LIABILITY" />
                                <AccountField form={form} name="account_previred_por_pagar" label="Obligaciones Previred (Pasivo)" accountType="LIABILITY" />
                                <div className="md:col-span-2"><AccountField form={form} name="account_anticipos" label="Anticipos de Remuneraciones (Activo)" accountType="ASSET" /></div>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Socios ───────── */

const SOCIOS_DEFAULTS: PartnerAccountsFormValues = {
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
    const { settings, isLoading, updateSettings } = usePartnerSettings()

    const form = useForm<PartnerAccountsFormValues>({
        resolver: zodResolver(partnerAccountsSchema),
        defaultValues: SOCIOS_DEFAULTS,
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => {
            const formatted: Partial<PartnerAccountsFormValues> = {}
            const keys = Object.keys(partnerAccountsSchema.shape) as (keyof PartnerAccountsFormValues)[]
            keys.forEach((key) => {
                const val = (s as unknown as Record<string, unknown>)[key]
                    ; (formatted as Record<string, unknown>)[key] = val ? val.toString() : null
            })
            return formatted as PartnerAccountsFormValues
        },
    })

    const onSave = useCallback(async (data: PartnerAccountsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

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
                                <CardTitle className="text-lg text-primary">Patrimonio y Capital Social</CardTitle>
                                <CardDescription>Cuentas de patrimonio que registran el capital suscritido, aportes y capital por cobrar</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="partner_capital_social_account" label="Capital Social" accountType="EQUITY" />
                                    <AccountField form={form} name="partner_capital_contribution_account" label="Aportes de Capital" accountType="EQUITY" />
                                    <div className="md:col-span-2"><AccountField form={form} name="partner_capital_receivable_account" label="Capital por Cobrar" accountType="ASSET" /></div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Retiros y Distribución de Utilidades</CardTitle>
                                <CardDescription>Cuentas para retiros de socios y dividendos declarados</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="partner_withdrawal_account" label="Retiros Definitivos" accountType="EQUITY" />
                                    <AccountField form={form} name="partner_provisional_withdrawal_account" label="Retiros Provisorios" accountType="EQUITY" />
                                    <div className="md:col-span-2"><AccountField form={form} name="partner_dividends_payable_account" label="Dividendos por Pagar" accountType="LIABILITY" /></div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card variant="default" className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Resultados Acumulados</CardTitle>
                                <CardDescription>Cuentas de patrimonio para utilidades retenidas y resultado del período</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <AccountField form={form} name="partner_retained_earnings_account" label="Utilidades Retenidas" accountType="EQUITY" />
                                    <AccountField form={form} name="partner_current_year_earnings_account" label="Resultado del Ejercicio" accountType="EQUITY" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </div>
    )
}

/* ───────── Estructura (Plan de Cuentas) ───────── */

const ESTRUCTURA_DEFAULTS: StructureFormValues = {
    hierarchy_levels: 4,
    code_separator: ".",
    asset_prefix: "",
    liability_prefix: "",
    equity_prefix: "",
    income_prefix: "",
    expense_prefix: "",
}

function generatePreview(values: StructureFormValues) {
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

    const form = useForm<StructureFormValues>({
        resolver: zodResolver(structureSchema),
        defaultValues: ESTRUCTURA_DEFAULTS,
    })

    useInitializeForm({
        form,
        data: settings,
        mapData: (s) => {
            const raw = s as unknown as Record<string, unknown>
            const formatted: Partial<StructureFormValues> = {
                hierarchy_levels: typeof raw.hierarchy_levels === 'number' ? raw.hierarchy_levels : 4,
                code_separator: raw.code_separator?.toString() ?? ".",
                asset_prefix: raw.asset_prefix?.toString() ?? "",
                liability_prefix: raw.liability_prefix?.toString() ?? "",
                equity_prefix: raw.equity_prefix?.toString() ?? "",
                income_prefix: raw.income_prefix?.toString() ?? "",
                expense_prefix: raw.expense_prefix?.toString() ?? "",
            }
            return formatted as StructureFormValues
        },
    })

    const onSave = useCallback(async (data: StructureFormValues) => {
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

    const formValues = useWatch({ control: form.control }) as StructureFormValues

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando estructura contable..." />

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
                                <fieldset className="notched-field border-primary/20 pointer-events-none select-none">
                                    <legend className="px-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">
                                        Vista Previa del Formato
                                    </legend>
                                    <div className="flex items-center justify-between w-full min-h-[2.5rem] py-1">
                                        <p className="text-[10px] text-muted-foreground uppercase opacity-75 font-bold pl-2.5">
                                            Ejemplo nivel {formValues.hierarchy_levels}
                                        </p>
                                        <span className="text-lg font-mono font-bold tracking-tighter text-primary mr-1">
                                            {generatePreview(formValues)}
                                        </span>
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
                        <div className="md:col-span-2">
                            <Card variant="default">
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Plan de Cuentas IFRS</CardTitle>
                                    <CardDescription>Esta acción creará las cuentas detalladas y configurará los mapeos contables por defecto de manera instantánea</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-sm">
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
                        </div>
                    </div>
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

const IMPUESTOS_DEFAULTS: TaxFormValues = {
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <div className="md:col-span-2"><AccountField form={form} name="vat_withholding_account" label="Retención IVA (Cambio Sujeto)" accountType="LIABILITY" /></div>
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </div>
    )
}
