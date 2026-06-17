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
import { useBillingSettings } from "@/features/settings/hooks/useBillingSettings"

const accountIdSchema = z.union([z.string(), z.number()]).nullable()

const billingAccountsSchema = z.object({
    default_receivable_account: accountIdSchema,
    default_payable_account: accountIdSchema,
    default_advance_payment_account: accountIdSchema,
    default_prepayment_account: accountIdSchema,
})

type BillingAccountsFormValues = z.infer<typeof billingAccountsSchema>

const ACCOUNT_TABS = [
    { value: "accounts", label: "Cuentas" },
]

const DEFAULT_VALUES: BillingAccountsFormValues = {
    default_receivable_account: null,
    default_payable_account: null,
    default_advance_payment_account: null,
    default_prepayment_account: null,
}

export function BillingAccountsView() {
    const { settings, isLoading, updateSettings } = useBillingSettings()
    const [activeTab, setActiveTab] = useState("accounts")

    const form = useForm<BillingAccountsFormValues>({
        resolver: zodResolver(billingAccountsSchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        if (settings) {
            form.reset({
                default_receivable_account: settings.default_receivable_account?.toString() ?? null,
                default_payable_account: settings.default_payable_account?.toString() ?? null,
                default_advance_payment_account: settings.default_advance_payment_account?.toString() ?? null,
                default_prepayment_account: settings.default_prepayment_account?.toString() ?? null,
            })
        }
    }, [settings, form])

    const onSave = useCallback(async (data: BillingAccountsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de facturación..." />

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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg text-primary">Cuentas por Cobrar</CardTitle>
                                        <CardDescription>Gestión de clientes y anticipos recibidos</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <AccountField form={form} name="default_receivable_account" label="CxC Clientes (Activo)" accountType="ASSET" />
                                        <AccountField form={form} name="default_advance_payment_account" label="Anticipos de Clientes (Pasivo)" accountType="LIABILITY" />
                                    </CardContent>
                                </Card>

                                <Card>
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
                        </UnderlineTabsContent>
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
