"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { AutoSaveStatusBadge, LabeledSelect, SkeletonShell } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { accountingApi } from "@/features/accounting"

const valuationSchema = z.object({
    inventory_valuation_method: z.string(),
})

type ValuationFormValues = z.infer<typeof valuationSchema>

export default function InventorySettingsPageClient() {
    const [settings, setSettings] = useState<ValuationFormValues | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const form = useForm<ValuationFormValues>({
        resolver: zodResolver(valuationSchema),
        defaultValues: {
            inventory_valuation_method: "AVERAGE",
        },
    })

    useEffect(() => {
        (async () => {
            try {
                const data = await accountingApi.getSettings() as { inventory_valuation_method?: "AVERAGE" | "FIFO" | "LIFO" }
                form.reset({
                    inventory_valuation_method: data.inventory_valuation_method || "AVERAGE",
                })
                setSettings({ inventory_valuation_method: data.inventory_valuation_method || "AVERAGE" })
            } catch {
                toast.error("Error al cargar configuración de inventario")
            } finally {
                setIsLoading(false)
            }
        })()
    }, [form])

    const onSave = useCallback(async (data: ValuationFormValues) => {
        await accountingApi.updateSettings({
            inventory_valuation_method: data.inventory_valuation_method,
        })
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave })
    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración..." />

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
            </div>
            <Form {...form}>
                <form>
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Método de Valoración de Inventario</CardTitle>
                            <CardDescription>Determine cómo el sistema calcula el costo de sus existencias</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name="inventory_valuation_method"
                                render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Método de Valoración"
                                        value={field.value || "AVERAGE"}
                                        onChange={field.onChange}
                                        error={fieldState.error?.message}
                                        options={[
                                            { value: "AVERAGE", label: "Promedio Ponderado" },
                                        ]}
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
