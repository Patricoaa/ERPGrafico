"use client"

import React from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useBillingSettings } from "@/features/settings"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField, FormItem } from "@/components/ui/form"
import { AutoSaveStatusBadge, SkeletonShell } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import {
    DTE_TYPE_IDS,
    DTE_TYPE_OPTIONS,
    dteSideSchema,
    type ConfigurableDteType,
    type DteSideFormValues,
} from "./DteSettingsView.schema"

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
    const { settings, isLoading, isError, refetch, updateSettings } = useBillingSettings()
    const field = FIELD_BY_SIDE[side]
    const card = CARD_BY_SIDE[side]

    const form = useForm<DteSideFormValues>({
        resolver: zodResolver(dteSideSchema),
        defaultValues: { allowed_dte_types: [] },
    })

    React.useEffect(() => {
        if (settings) {
            const configuredTypes = settings[field] || []
            form.reset({
                allowed_dte_types: configuredTypes.length > 0
                    ? configuredTypes as ConfigurableDteType[]
                    : [...DTE_TYPE_IDS],
            })
        }
    }, [settings, field, form])

    const onSave = React.useCallback(async (data: DteSideFormValues) => {
        await updateSettings({ [field]: data.allowed_dte_types })
    }, [updateSettings, field])

    const validate = React.useCallback((values: DteSideFormValues) => {
        const result = dteSideSchema.safeParse(values)
        return result.success ? true : result.error.issues[0]?.message ?? "Revise los tipos seleccionados."
    }, [])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, validate })

    useUnsavedChangesGuard(status)

    if (isError) {
        return (
            <Alert variant="destructive" className="max-w-3xl mx-auto">
                <div className="space-y-3">
                    <AlertTitle>No se pudo cargar la configuración DTE</AlertTitle>
                    <AlertDescription>Los cambios están deshabilitados para evitar sobrescribir una configuración que no se pudo leer.</AlertDescription>
                    <Button type="button" variant="outline" onClick={() => void refetch()}>
                        Reintentar
                    </Button>
                </div>
            </Alert>
        )
    }

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
    return (
        <Card variant="default">
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description} Mantenga al menos un tipo habilitado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                        <FormItem>
                            <div className="grid grid-cols-1 gap-4">
                                {DTE_TYPE_OPTIONS.map((type) => {
                                    const selectedTypes = field.value ?? []
                                    const checked = selectedTypes.includes(type.id)
                                    const checkboxId = `dte-type-${type.id}`

                                    return (
                                        <label
                                            key={type.id}
                                            htmlFor={checkboxId}
                                            className="surface-item flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                                        >
                                            <Checkbox
                                                id={checkboxId}
                                                checked={checked}
                                                disabled={checked && selectedTypes.length === 1}
                                                aria-label={`${type.label}, código SII ${type.code}`}
                                                onCheckedChange={(nextChecked) => {
                                                    if (nextChecked) {
                                                        field.onChange([...selectedTypes, type.id])
                                                    } else if (selectedTypes.length > 1) {
                                                        field.onChange(selectedTypes.filter((value) => value !== type.id))
                                                    }
                                                }}
                                            />
                                            <span className="flex-1">
                                                <span className="block text-sm font-bold leading-none">{type.label}</span>
                                                <span className="block text-3xs text-muted-foreground mt-1">Código SII: {type.code}</span>
                                            </span>
                                        </label>
                                        )
                                    })}
                            </div>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
