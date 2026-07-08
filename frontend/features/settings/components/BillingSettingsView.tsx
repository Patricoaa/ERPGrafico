"use client"

import React from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useBillingSettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField, FormItem } from "@/components/ui/form"
import { Check } from "lucide-react"
import { AutoSaveStatusBadge, SkeletonShell } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import { billingSchema, type BillingFormValues } from "./BillingSettingsView.schema"

export function BillingSettingsView() {
    const { settings, isLoading, updateSettings } = useBillingSettings()

    const form = useForm<BillingFormValues>({
        resolver: zodResolver(billingSchema),
        defaultValues: {
            allowed_dte_types_emit: [],
            allowed_dte_types_receive: [],
        }
    })

    React.useEffect(() => {
        if (settings) {
            form.reset({
                allowed_dte_types_emit: settings.allowed_dte_types_emit || [],
                allowed_dte_types_receive: settings.allowed_dte_types_receive || [],
            })
        }
    }, [settings, form])

    const onSave = React.useCallback(async (data: BillingFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave })

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
                <form className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DTEConfigCard
                            form={form}
                            name="allowed_dte_types_emit"
                            title="Documentos a Emitir (Ventas/POS)"
                            description="Seleccione qué tipos de documentos están habilitados para ser emitidos."
                        />
                        <DTEConfigCard
                            form={form}
                            name="allowed_dte_types_receive"
                            title="Documentos a Recibir (Compras)"
                            description="Seleccione qué tipos de documentos están habilitados para ser registrados."
                        />
                    </div>
                </form>
            </Form>
        </div>
    )
}

export default BillingSettingsView

interface DTEConfigCardProps {
    form: UseFormReturn<BillingFormValues>
    name: "allowed_dte_types_emit" | "allowed_dte_types_receive"
    title: string
    description: string
}

function DTEConfigCard({ form, name, title, description }: DTEConfigCardProps) {
    const dteTypes = [
        { id: 'FACTURA', label: 'Factura Electrónica', code: '33' },
        { id: 'FACTURA_EXENTA', label: 'Factura Exenta', code: '34' },
        { id: 'BOLETA', label: 'Boleta Electrónica', code: '39' },
        { id: 'BOLETA_EXENTA', label: 'Boleta Exenta', code: '41' },
    ]

    return (
        <Card variant="default">
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                        <FormItem>
                            <div className="grid grid-cols-1 gap-4">
                                {dteTypes.map((type) => (
                                    <div key={type.id} className="flex items-center space-x-3 space-y-0 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => {
                                        const current = (field.value as string[]) || [];
                                        const next = current.includes(type.id)
                                            ? current.filter((v) => v !== type.id)
                                            : [...current, type.id];
                                        field.onChange(next);
                                    }}>
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${((field.value as string[]) || []).includes(type.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                            {((field.value as string[]) || []).includes(type.id) && <Check className="h-3.5 w-3.5 text-primary-foreground stroke-[4]" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold leading-none">{type.label}</div>
                                            <div className="text-[10px] text-muted-foreground mt-1">Código SII: {type.code}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
