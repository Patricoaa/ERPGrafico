"use client"

import { useCallback } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { parseISO } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormField } from "@/components/ui/form"
import { AutoSaveStatusBadge, DatePicker, FadeIn, LabeledContainer, LabeledInput, LabeledSelect, LabeledSwitch, Banner, SkeletonShell } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { toDateOnlyISO } from "@/lib/utils"
import {
    useTerminalProviders,
    useTerminalSyncSettings,
    useUpdateTerminalSyncSettings,
} from "@/features/treasury"
import type { TerminalSyncSettings } from "@/features/treasury"

import { MIN_INTERVAL_MINUTES, terminalSyncSettingsSchema, validateTerminalSyncSettings, type TerminalSyncSettingsFormValues } from "./TreasurySettingsView.schema"

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
}))

const UNIT_OPTIONS = [
    { value: "MINUTES", label: "Minutos" },
    { value: "HOURS", label: "Horas" },
    { value: "DAYS", label: "Días" },
]

function toFormValues(settings: TerminalSyncSettings): TerminalSyncSettingsFormValues {
    return {
        enabled: settings.enabled,
        run_hour: settings.run_hour,
        interval_value: settings.interval_value,
        interval_unit: settings.interval_unit,
        lookback_days: settings.lookback_days,
        history_start_date: settings.history_start_date,
        max_retries: settings.max_retries,
        retry_delay_minutes: settings.retry_delay_minutes,
    }
}

const numberValue = (value: number) => (Number.isNaN(value) ? "" : value)
const parseNumber = (raw: string) => (raw === "" ? Number.NaN : Number(raw))

function TerminalSyncSettingsPanel({ settings }: { settings: TerminalSyncSettings }) {
    const { updateSettings } = useUpdateTerminalSyncSettings()
    const { providers } = useTerminalProviders()
    const hasTuuProvider = providers.some((p) => p.provider_type === "TUU" && p.has_api_key)

    const form = useForm<TerminalSyncSettingsFormValues>({
        resolver: zodResolver(terminalSyncSettingsSchema),
        mode: "onChange",
        defaultValues: toFormValues(settings),
    })

    const intervalUnit = form.watch("interval_unit")

    const onSave = useCallback(async (data: TerminalSyncSettingsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        validate: validateTerminalSyncSettings,
    })

    useUnsavedChangesGuard(status)

    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <FadeIn className="max-w-6xl mx-auto">
                <div className="space-y-6 mt-6 pb-6">
                    <div className="flex justify-end">
                        <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
                    </div>

                    {!hasTuuProvider && (
                        <Banner tone="warning">
                            No hay proveedores TUU con API key configurada, por lo que no hay ventas que sincronizar.{" "}
                            <Link href="/treasury/terminal-cobro/providers" className="font-medium text-primary underline underline-offset-2">
                                Configurar proveedores
                            </Link>
                        </Banner>
                    )}

                    <Form {...form}>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Sincronización automática</CardTitle>
                                <CardDescription>
                                    Trae periódicamente las ventas de los terminales TUU. El historial de ejecuciones está en{" "}
                                    <Link href="/treasury/terminal-cobro/imports" className="font-medium text-primary underline underline-offset-2">
                                        Terminal de cobro → Importaciones
                                    </Link>
                                    .
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField
                                    control={form.control}
                                    name="enabled"
                                    render={({ field }) => (
                                        <LabeledSwitch
                                            label="Sincronización automática"
                                            description={field.value ? "Habilitada" : "Deshabilitada"}
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="h-full md:col-span-3"
                                            color="info"
                                        />
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="interval_value"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Cada"
                                            hint={intervalUnit === "MINUTES" ? "Mínimo 5 minutos." : "Mínimo 1."}
                                            type="number"
                                            {...field}
                                            value={numberValue(field.value)}
                                            onChange={(event) => field.onChange(parseNumber(event.target.value))}
                                            min={intervalUnit === "MINUTES" ? MIN_INTERVAL_MINUTES : 1}
                                            step={1}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="interval_unit"
                                    render={({ field, fieldState }) => (
                                        <LabeledSelect
                                            label="Unidad"
                                            options={UNIT_OPTIONS}
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                                {intervalUnit === "DAYS" && (
                                    <FormField
                                        control={form.control}
                                        name="run_hour"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Hora de ejecución"
                                                options={HOUR_OPTIONS}
                                                value={Number.isNaN(field.value) ? "" : String(field.value)}
                                                onChange={(value) => field.onChange(Number(value))}
                                                error={fieldState.error?.message}
                                            />
                                        )}
                                    />
                                )}
                                <FormField
                                    control={form.control}
                                    name="lookback_days"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Días hacia atrás a revisar"
                                            hint="Entre 1 y 60 días."
                                            type="number"
                                            {...field}
                                            value={numberValue(field.value)}
                                            onChange={(event) => field.onChange(parseNumber(event.target.value))}
                                            min={1}
                                            max={60}
                                            step={1}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="history_start_date"
                                    render={({ field, fieldState }) => (
                                        <LabeledContainer label="Fecha de inicio del historial" error={fieldState.error?.message}>
                                            <DatePicker
                                                date={field.value ? parseISO(field.value) : undefined}
                                                onDateChange={(d) => field.onChange(d ? toDateOnlyISO(d) : null)}
                                                placeholder="Sin fecha de inicio"
                                                className="w-full border-none bg-transparent hover:bg-transparent shadow-none"
                                            />
                                        </LabeledContainer>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="max_retries"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Reintentos máximos"
                                            hint="Entre 0 y 10."
                                            type="number"
                                            {...field}
                                            value={numberValue(field.value)}
                                            onChange={(event) => field.onChange(parseNumber(event.target.value))}
                                            min={0}
                                            max={10}
                                            step={1}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="retry_delay_minutes"
                                    render={({ field, fieldState }) => (
                                        <LabeledInput
                                            label="Minutos entre reintentos"
                                            hint="Entre 1 y 120 minutos."
                                            type="number"
                                            {...field}
                                            value={numberValue(field.value)}
                                            onChange={(event) => field.onChange(parseNumber(event.target.value))}
                                            min={1}
                                            max={120}
                                            step={1}
                                            error={fieldState.error?.message}
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </Form>

                </div>
            </FadeIn>
        </div>
    )
}

export function TreasurySettingsView() {
    const { settings, isLoading, isError, refetch } = useTerminalSyncSettings()
    if (isError && !settings) {
        return (
            <Banner
                tone="destructive"
                className="max-w-3xl mx-auto mt-6"
                title="No se pudo cargar la configuración del terminal de cobro"
                actions={
                    <Button type="button" variant="outline" onClick={() => void refetch()}>
                        Reintentar
                    </Button>
                }
            >
                Los cambios están deshabilitados para evitar sobrescribir una configuración que no se pudo leer.
            </Banner>
        )
    }
    return (
        <SkeletonShell isLoading={isLoading || !settings} ariaLabel="Cargando configuración del terminal de cobro">
            {settings && <TerminalSyncSettingsPanel settings={settings} />}
        </SkeletonShell>
    )
}
