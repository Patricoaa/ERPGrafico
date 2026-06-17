"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { AutoSaveStatusBadge, SkeletonShell, UnderlineTabs, UnderlineTabsContent } from "@/components/shared"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { accountingApi } from "@/features/accounting/api/accountingApi"

const partnerAccountsSchema = z.object({
    partner_capital_social_account: z.string().nullable(),
    partner_capital_contribution_account: z.string().nullable(),
    partner_withdrawal_account: z.string().nullable(),
    partner_provisional_withdrawal_account: z.string().nullable(),
})

type PartnerAccountsFormValues = z.infer<typeof partnerAccountsSchema>

const ACCOUNT_TABS = [
    { value: "capital", label: "Capital Social" },
    { value: "contributions", label: "Aportes de Capital" },
    { value: "withdrawals", label: "Retiros Definitivos" },
    { value: "provisional", label: "Retiros Provisorios" },
]

const DEFAULT_VALUES: PartnerAccountsFormValues = {
    partner_capital_social_account: null,
    partner_capital_contribution_account: null,
    partner_withdrawal_account: null,
    partner_provisional_withdrawal_account: null,
}

export function PartnerAccountsView() {
    const [settings, setSettings] = useState<PartnerAccountsFormValues | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("capital")

    const form = useForm<PartnerAccountsFormValues>({
        resolver: zodResolver(partnerAccountsSchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        ;(async () => {
            try {
                const data = await accountingApi.getSettings()
                const formatted: PartnerAccountsFormValues = {
                    partner_capital_social_account: data.partner_capital_social_account?.toString() || null,
                    partner_capital_contribution_account: data.partner_capital_contribution_account?.toString() || null,
                    partner_withdrawal_account: data.partner_withdrawal_account?.toString() || null,
                    partner_provisional_withdrawal_account: data.partner_provisional_withdrawal_account?.toString() || null,
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

    const onSave = useCallback(async (data: PartnerAccountsFormValues) => {
        await accountingApi.updateSettings({
            partner_capital_social_account: data.partner_capital_social_account ? parseInt(data.partner_capital_social_account) : null,
            partner_capital_contribution_account: data.partner_capital_contribution_account ? parseInt(data.partner_capital_contribution_account) : null,
            partner_withdrawal_account: data.partner_withdrawal_account ? parseInt(data.partner_withdrawal_account) : null,
            partner_provisional_withdrawal_account: data.partner_provisional_withdrawal_account ? parseInt(data.partner_provisional_withdrawal_account) : null,
        })
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de socios..." />

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
                        <UnderlineTabsContent value="capital">
                            <Card>
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
                        </UnderlineTabsContent>
                        <UnderlineTabsContent value="contributions">
                            <Card>
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
                        </UnderlineTabsContent>
                        <UnderlineTabsContent value="withdrawals">
                            <Card>
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
                        </UnderlineTabsContent>
                        <UnderlineTabsContent value="provisional">
                            <Card>
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
                        </UnderlineTabsContent>
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
