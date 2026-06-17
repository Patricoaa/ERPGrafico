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
})

type PartnerAccountsFormValues = z.infer<typeof partnerAccountsSchema>

const ACCOUNT_TABS = [
    { value: "capital", label: "Capital Social" },
]

const DEFAULT_VALUES: PartnerAccountsFormValues = {
    partner_capital_social_account: null,
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
                                    <CardTitle className="text-lg text-primary">Configuración Contable de Capital Social</CardTitle>
                                    <CardDescription>Define la cuenta donde se registrará el Capital Social de los socios</CardDescription>
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
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
