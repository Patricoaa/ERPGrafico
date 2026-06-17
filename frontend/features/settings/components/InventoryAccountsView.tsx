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
import { useInventorySettings } from "@/features/settings/hooks/useInventorySettings"

const inventoryAccountsSchema = z.object({
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

type InventoryAccountsFormValues = z.infer<typeof inventoryAccountsSchema>

const ACCOUNT_TABS = [
    { value: "accounts", label: "Producto" },
    { value: "adjustments", label: "Ajustes" },
    { value: "cogs", label: "COGS" },
]

const DEFAULT_VALUES: InventoryAccountsFormValues = {
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

export function InventoryAccountsView() {
    const { settings, isLoading, updateSettings } = useInventorySettings()
    const [activeTab, setActiveTab] = useState("accounts")

    const form = useForm<InventoryAccountsFormValues>({
        resolver: zodResolver(inventoryAccountsSchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        if (settings) {
            const formatted: Partial<InventoryAccountsFormValues> = {}
            const keys = Object.keys(inventoryAccountsSchema.shape) as (keyof InventoryAccountsFormValues)[]
            keys.forEach((key) => {
                const val = settings[key]
                if (val === null || val === undefined) {
                    (formatted as Record<string, unknown>)[key] = null
                } else {
                    (formatted as Record<string, unknown>)[key] = val.toString()
                }
            })
            form.reset(formatted as InventoryAccountsFormValues)
        }
    }, [settings, form])

    const onSave = useCallback(async (data: InventoryAccountsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de inventario..." />

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
                        <UnderlineTabsContent value="accounts">
                            <Card>
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

                            <Card>
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="adjustments">
                            <Card>
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
                        </UnderlineTabsContent>

                        <UnderlineTabsContent value="cogs">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Costo de Ventas (COGS)</CardTitle>
                                    <CardDescription>Cuentas de gasto para el costo de productos vendidos</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <AccountField form={form} name="merchandise_cogs_account" label="Costo Mercaderías (STORABLE)" accountType="EXPENSE" />
                                    <AccountField form={form} name="manufactured_cogs_account" label="Costo Producción (MANUFACTURABLE)" accountType="EXPENSE" />
                                </CardContent>
                            </Card>
                        </UnderlineTabsContent>
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
