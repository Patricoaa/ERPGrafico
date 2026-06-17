"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form } from "@/components/ui/form"
import { AccountField, AutoSaveStatusBadge, SkeletonShell, UnderlineTabs, UnderlineTabsContent } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { treasurySchema, type TreasuryFormValues } from "@/features/settings/schemas/treasury"
import { useTreasurySettings } from "@/features/settings/hooks/useTreasurySettings"

const ACCOUNT_TABS = [
    { value: "conciliation", label: "Conciliación" },
    { value: "audit", label: "Auditoría" },
    { value: "movements", label: "Movimientos" },
    { value: "terminals", label: "Terminales" },
    { value: "checks", label: "Cheques" },
    { value: "financial", label: "Financiero" },
]

const DEFAULT_VALUES: TreasuryFormValues = {
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

export function TreasuryAccountsView() {
    const { settings, isLoading, updateSettings } = useTreasurySettings()
    const [activeTab, setActiveTab] = useState("conciliation")

    const form = useForm<TreasuryFormValues>({
        resolver: zodResolver(treasurySchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: TreasuryFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de tesorería..." />

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
                        <UnderlineTabsContent value="conciliation">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Cuentas de Conciliación Bancaria</CardTitle>
                                    <CardDescription>Identificadores para ajustes automáticos en conciliación por lotes</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <AccountField form={form} name="bank_commission_account" label="Gasto Comisiones Bancarias" accountType="EXPENSE" />
                                        <AccountField form={form} name="interest_income_account" label="Ingreso por Intereses" accountType="INCOME" />
                                        <AccountField form={form} name="exchange_difference_account" label="Diferencia de Cambio (M.E)" accountType="" />
                                        <AccountField form={form} name="rounding_adjustment_account" label="Ajuste por Redondeo / Centavos" accountType="EXPENSE" />
                                        <AccountField form={form} name="error_adjustment_account" label="Ajustes por Errores Operativos" accountType="EXPENSE" />
                                        <AccountField form={form} name="miscellaneous_adjustment_account" label="Otros Ajustes de Tesorería" accountType="EXPENSE" />
                                    </div>
                                </CardContent>
                            </Card>
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="audit">
                            <Card>
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="movements">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Cuentas para Movimientos Manuales</CardTitle>
                                    <CardDescription>Configuración de ingresos y egresos ad-hoc del módulo POS</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <AccountField form={form} name="pos_tip_account" label="Recaudación Propinas" accountType="INCOME" />
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="terminals">
                            <Card>
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="checks">
                            <Card>
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="financial">
                            <Card>
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
                        </UnderlineTabsContent>
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
