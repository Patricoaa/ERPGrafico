"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useBillingSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { LabeledInput, AutoSaveStatusBadge, SkeletonShell } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import { vatRatesSchema, type VatRatesFormValues } from "./VatRatesView.schema"

export function VatRatesView() {
    const { settings, isLoading, updateSettings } = useBillingSettings()

    const form = useForm<VatRatesFormValues>({
        resolver: zodResolver(vatRatesSchema),
        defaultValues: {
            default_vat_rate: 19,
        }
    })

    React.useEffect(() => {
        if (settings) {
            form.reset({
                default_vat_rate: settings.default_vat_rate ?? 19,
            })
        }
    }, [settings, form])

    const onSave = React.useCallback(async (data: VatRatesFormValues) => {
        await updateSettings({ default_vat_rate: data.default_vat_rate })
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración de tasas..." />

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge
                    status={status}
                    invalidReason={invalidReason}
                    lastSavedAt={lastSavedAt}
                    onRetry={retry}
                />
            </div>
            <Form {...form}>
                <form className="mt-6 space-y-6">
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg">Tasa de IVA por Defecto</CardTitle>
                            <CardDescription>
                                Porcentaje de IVA usado en cálculos generales del sistema (precios, F29, asientos contables).
                                Este valor se aplica como predeterminado en todo el ERP.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="default_vat_rate"
                                render={({ field }) => (
                                    <LabeledInput
                                        {...field}
                                        value={field.value?.toString() ?? "19"}
                                        label="Tasa de IVA (%)"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        className="font-mono max-w-xs"
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

export default VatRatesView
