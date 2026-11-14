"use client"

import { useCallback } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { parseISO } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert } from "@/components/ui/alert"
import { Form, FormField } from "@/components/ui/form"
import { AutoSaveStatusBadge, DatePicker, FadeIn, LabeledContainer, LabeledInput, LabeledSelect, LabeledSwitch, SkeletonShell, StatusBadge } from "@/components/shared"
import { Collection, formatDate, useEntityCollection } from "@/components/entity-view"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { toDateOnlyISO } from "@/lib/utils"
import {
    terminalSyncRunStatus,
    terminalSyncRunViews,
    terminalSyncRunEntity,
    useTerminalProviders,
    useTerminalSyncRuns,
    useTerminalSyncSettings,
    useUpdateTerminalSyncSettings,
} from "@/features/treasury"
import type { TerminalSyncLastRun, TerminalSyncSettings } from "@/features/treasury"

import { terminalSyncSettingsSchema, type TerminalSyncSettingsFormValues } from "./TreasurySettingsView.schema"

const RUNS_PAGE_SIZE = 10

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
}))

function toFormValues(settings: TerminalSyncSettings): TerminalSyncSettingsFormValues {
    return {
        enabled: settings.enabled,
        run_hour: settings.run_hour,
        lookback_days: settings.lookback_days,
        history_start_date: settings.history_start_date,
        max_retries: settings.max_retries,
        retry_delay_minutes: settings.retry_delay_minutes,
    }
}

const numberValue = (value: number) => (Number.isNaN(value) ? "" : value)
const parseNumber = (raw: string) => (raw === "" ? Number.NaN : Number(raw))

function LastRunBlock({ lastRun }: { lastRun: TerminalSyncLastRun | null }) {
    if (!lastRun) {
        return <p className="text-sm text-muted-foreground">Aún no se ha ejecutado ninguna sincronización.</p>
    }
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
                <StatusBadge {...terminalSyncRunStatus(lastRun.status)} variant="badge" />
                <span className="text-sm text-foreground">{lastRun.provider_name}</span>
                <span className="text-sm text-muted-foreground">{formatDate(lastRun.started_at, true)}</span>
            </div>
            {lastRun.error_message && <p className="text-sm text-destructive">{lastRun.error_message}</p>}
        </div>
    )
}

function RecentRuns() {
    const { runs, totalCount, isLoading, isRefetching, isError, refetch } = useTerminalSyncRuns({ page_size: RUNS_PAGE_SIZE })
    const collection = useEntityCollection(
        terminalSyncRunEntity,
        { rows: runs, rowCount: totalCount, isLoading, isRefetching, error: isError, refetch },
        { pagination: { mode: "none" } },
    )
    return (
        <Collection.Root collection={collection} label="Últimas ejecuciones">
            <Collection.View
                table={terminalSyncRunViews.table}
                emptyTitle="Sin ejecuciones"
                emptyDescription="Las sincronizaciones aparecerán aquí cuando se ejecuten."
            />
        </Collection.Root>
    )
}

function TerminalSyncSettingsPanel({ settings }: { settings: TerminalSyncSettings }) {
    const { updateSettings } = useUpdateTerminalSyncSettings()
    const { providers } = useTerminalProviders()
    const hasTuuProvider = providers.some((p) => p.provider_type === "TUU" && p.has_api_key)

    const form = useForm<TerminalSyncSettingsFormValues>({
        resolver: zodResolver(terminalSyncSettingsSchema),
        defaultValues: toFormValues(settings),
    })

    const onSave = useCallback(async (data: TerminalSyncSettingsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
    })

    useUnsavedChangesGuard(status)

    return (
        <div className="max-w-6xl mx-auto flex flex-col flex-1 min-h-0 space-y-6">
            <FadeIn>
                <div className="space-y-6 mt-6">
                    <div className="flex justify-end">
                        <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
                    </div>

                    {!hasTuuProvider && (
                        <Alert variant="warning">
                            <p className="text-sm">
                                No hay proveedores TUU con API key configurada, por lo que no hay ventas que sincronizar.{" "}
                                <Link href="/treasury/terminal-cobro/providers" className="font-medium text-primary underline underline-offset-2">
                                    Configurar proveedores
                                </Link>
                            </p>
                        </Alert>
                    )}

                    <Form {...form}>
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Sincronización automática</CardTitle>
                                <CardDescription>Trae cada día las ventas de los terminales TUU.</CardDescription>
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

                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Última ejecución</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <LastRunBlock lastRun={settings.last_run} />
                        </CardContent>
                    </Card>

                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Últimas ejecuciones</CardTitle>
                            <CardDescription>Las 10 sincronizaciones más recientes.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RecentRuns />
                        </CardContent>
                    </Card>
                </div>
            </FadeIn>
        </div>
    )
}

export function TreasurySettingsView() {
    const { settings, isLoading } = useTerminalSyncSettings()
    return (
        <SkeletonShell isLoading={isLoading || !settings} ariaLabel="Cargando configuración del terminal de cobro">
            {settings && <TerminalSyncSettingsPanel settings={settings} />}
        </SkeletonShell>
    )
}
