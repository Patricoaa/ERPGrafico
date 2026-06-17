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
import { getGlobalHRSettings, updateGlobalHRSettings } from "@/features/hr/api/hrApi"

const hrAccountsSchema = z.object({
    account_remuneraciones_por_pagar: z.string().nullable(),
    account_previred_por_pagar: z.string().nullable(),
    account_anticipos: z.string().nullable(),
})

type HRAccountsFormValues = z.infer<typeof hrAccountsSchema>

const ACCOUNT_TABS = [
    { value: "consolidated", label: "Consolidadas" },
]

const DEFAULT_VALUES: HRAccountsFormValues = {
    account_remuneraciones_por_pagar: null,
    account_previred_por_pagar: null,
    account_anticipos: null,
}

export function HRAccountsView() {
    const [settings, setSettings] = useState<HRAccountsFormValues | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("consolidated")

    const form = useForm<HRAccountsFormValues>({
        resolver: zodResolver(hrAccountsSchema),
        defaultValues: DEFAULT_VALUES,
    })

    useEffect(() => {
        ;(async () => {
            try {
                const data = await getGlobalHRSettings()
                const formatted: HRAccountsFormValues = {
                    account_remuneraciones_por_pagar: data.account_remuneraciones_por_pagar?.toString() || null,
                    account_previred_por_pagar: data.account_previred_por_pagar?.toString() || null,
                    account_anticipos: data.account_anticipos?.toString() || null,
                }
                setSettings(formatted)
                form.reset(formatted)
            } catch {
                toast.error("Error al cargar configuración de RRHH")
            } finally {
                setIsLoading(false)
            }
        })()
    }, [form])

    const onSave = useCallback(async (data: HRAccountsFormValues) => {
        await updateGlobalHRSettings({
            account_remuneraciones_por_pagar: data.account_remuneraciones_por_pagar ? parseInt(data.account_remuneraciones_por_pagar) : null,
            account_previred_por_pagar: data.account_previred_por_pagar ? parseInt(data.account_previred_por_pagar) : null,
            account_anticipos: data.account_anticipos ? parseInt(data.account_anticipos) : null,
        })
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de RRHH..." />

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
                        <UnderlineTabsContent value="consolidated">
                            <Card>
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
                        </UnderlineTabsContent>
                    </UnderlineTabs>
                </form>
            </Form>
        </div>
    )
}
