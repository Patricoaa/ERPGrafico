"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form } from "@/components/ui/form"
import { AccountField, AutoSaveStatusBadge, SkeletonShell, UnderlineTabs, UnderlineTabsContent } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { useSalesSettings } from "@/features/settings/hooks/useSalesSettings"

const salesAccountsSchema = z.object({
    default_revenue_account: z.string().nullable(),
    default_service_revenue_account: z.string().nullable(),
    default_subscription_revenue_account: z.string().nullable(),
    default_uncollectible_expense_account: z.string().nullable(),
})

type SalesAccountsFormValues = z.infer<typeof salesAccountsSchema>

const ACCOUNT_TABS = [
    { value: "income", label: "Ingresos" },
    { value: "uncollectible", label: "Incobrables" },
]

const DEFAULT_VALUES: SalesAccountsFormValues = {
    default_revenue_account: null,
    default_service_revenue_account: null,
    default_subscription_revenue_account: null,
    default_uncollectible_expense_account: null,
}

export function SalesAccountsView() {
    const { settings, isLoading, updateSettings } = useSalesSettings()
    const [activeTab, setActiveTab] = useState("income")

    const form = useForm<SalesAccountsFormValues>({
        resolver: zodResolver(salesAccountsSchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        if (settings) {
            form.reset({
                default_revenue_account: settings.default_revenue_account?.toString() ?? null,
                default_service_revenue_account: settings.default_service_revenue_account?.toString() ?? null,
                default_subscription_revenue_account: settings.default_subscription_revenue_account?.toString() ?? null,
                default_uncollectible_expense_account: settings.default_uncollectible_expense_account?.toString() ?? null,
            })
        }
    }, [settings, form])

    const onSave = useCallback(async (data: SalesAccountsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de ventas..." />

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
                        <UnderlineTabsContent value="income">
                            <Card>
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="uncollectible">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Cuenta de Castigo (Incobrables)</CardTitle>
                                    <CardDescription>Cuenta donde se cargarán las pérdidas al castigar deudas de clientes</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <AccountField
                                        form={form}
                                        name="default_uncollectible_expense_account"
                                        label="Cuenta Gasto Incobrables"
                                        accountType="EXPENSE"
                                    />
                                </CardContent>
                            </Card>
                        </UnderlineTabsContent>
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
