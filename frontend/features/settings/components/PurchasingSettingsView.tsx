"use client"

import { useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form } from "@/components/ui/form"
import { AccountField, AutoSaveStatusBadge, SkeletonShell } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import { purchasingSchema, type PurchasingFormValues } from "@/features/settings/schemas/purchasing"

import { useAccountingSettings } from "@/features/settings/hooks/useAccountingSettings"

export function PurchasingSettingsView() {
    const { purchasing: settings, isLoading, updateSettings } = useAccountingSettings()

    const form = useForm<PurchasingFormValues>({
        resolver: zodResolver(purchasingSchema),
        defaultValues: {
            default_expense_account: null,
            default_service_expense_account: null,
            default_subscription_expense_account: null,
        },
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: PurchasingFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración..." />

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge
                    status={status}
                    invalidReason={invalidReason}
                    lastSavedAt={lastSavedAt}
                    onRetry={retry}
                />
            </div>
            <Form {...form}>
                <form className="space-y-6">
                    <Card variant="transparent">
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


