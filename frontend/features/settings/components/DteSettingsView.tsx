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

import { dteSideSchema, type DteSideFormValues } from "./DteSettingsView.schema"

/** Lado del flujo DTE. Ventas emite; Compras recibe (ADR-0089). */
export type DteSide = "emit" | "receive"

const FIELD_BY_SIDE: Record<DteSide, "allowed_dte_types_emit" | "allowed_dte_types_receive"> = {
    emit: "allowed_dte_types_emit",
    receive: "allowed_dte_types_receive",
}

const CARD_BY_SIDE: Record<DteSide, { title: string; description: string }> = {
    emit: {
        title: "Documentos a Emitir (Ventas/POS)",
        description: "Seleccione qué tipos de documentos están habilitados para ser emitidos.",
    },
    receive: {
        title: "Documentos a Recibir (Compras)",
        description: "Seleccione qué tipos de documentos están habilitados para ser registrados.",
    },
}

interface DteSettingsViewProps {
    /** `emit` (Ventas/POS) o `receive` (Compras). Cada módulo guarda solo su mitad. */
    side: DteSide
}

/**
 * Configuración DTE por lado (ADR-0089). Antes era una sola página con dos tarjetas
 * (`BillingSettingsView`); ahora cada módulo comercial edita únicamente su mitad.
 * Mismo endpoint de PATCH parcial sobre `AccountingSettings` — sin migración.
 */
export function DteSettingsView({ side }: DteSettingsViewProps) {
    const { settings, isLoading, updateSettings } = useBillingSettings()
    const field = FIELD_BY_SIDE[side]
    const card = CARD_BY_SIDE[side]

    const form = useForm<DteSideFormValues>({
        resolver: zodResolver(dteSideSchema),
        defaultValues: { allowed_dte_types: [] },
    })

    React.useEffect(() => {
        if (settings) {
            form.reset({ allowed_dte_types: settings[field] || [] })
        }
    }, [settings, field, form])

    const onSave = React.useCallback(async (data: DteSideFormValues) => {
        await updateSettings({ [field]: data.allowed_dte_types })
    }, [updateSettings, field])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave })

    useUnsavedChangesGuard(status)

    return (
        <SkeletonShell isLoading={isLoading && !settings} ariaLabel="Cargando configuración...">
            <div className="max-w-3xl mx-auto space-y-6">
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
                        <DTEConfigCard
                            form={form}
                            name="allowed_dte_types"
                            title={card.title}
                            description={card.description}
                        />
                    </form>
                </Form>
            </div>
        </SkeletonShell>
    )
}

export default DteSettingsView

interface DTEConfigCardProps {
    form: UseFormReturn<DteSideFormValues>
    name: "allowed_dte_types"
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
                                    <div key={type.id} className="surface-item flex items-center space-x-3 space-y-0 p-3 hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => {
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
                                            <div className="text-3xs text-muted-foreground mt-1">Código SII: {type.code}</div>
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
