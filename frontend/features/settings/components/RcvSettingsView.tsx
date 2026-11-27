"use client"

import { useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormField } from "@/components/ui/form"
import { AutoSaveStatusBadge, Banner, DatePicker, FadeIn, LabeledContainer, LabeledInput, LabeledSelect, LabeledSwitch, SkeletonShell, SubmitButton } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { Can } from "@/components/auth"
import { useAuth } from "@/contexts/AuthContext"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { formatRUT } from "@/lib/utils/format"
import { toDateOnlyISO } from "@/lib/utils"
import { parseISO } from "date-fns"
import {
    formatRcvPeriod,
    rcvApiKeyEntity,
    rcvApiKeyViews,
    useRcvApiKeys,
    useRcvSettings,
    useUpdateRcvSettings,
} from "@/features/accounting"
import type { RcvApiKey, RcvSettings } from "@/features/accounting"

import { RcvApiKeyModal } from "./RcvApiKeyModal"
import { rcvSettingsSchema, validateRcvSettings, type RcvSettingsFormValues } from "./RcvSettingsView.schema"

const SETTINGS_PERMISSION = "accounting.change_rcvsettings"

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
}))

function toFormValues(settings: RcvSettings): RcvSettingsFormValues {
    return {
        company_rut: settings.company_rut,
        user_rut: settings.user_rut,
        enabled: settings.enabled,
        interval_days: settings.interval_days,
        run_hour: settings.run_hour,
        include_purchases: settings.include_purchases,
        include_sales: settings.include_sales,
        fiscal_match_start_date: settings.fiscal_match_start_date,
        terminal_match_window_minutes: settings.terminal_match_window_minutes,
    }
}

const numberValue = (value: number) => (Number.isNaN(value) ? "" : value)
const parseNumber = (raw: string) => (raw === "" ? Number.NaN : Number(raw))

/** La clave SII es de solo escritura: nunca se precarga y se limpia tras guardar. Mutación aparte del autosave. */
function SiiPasswordField({ hasPassword }: { hasPassword: boolean }) {
    const { updateSettings, isUpdating } = useUpdateRcvSettings()
    const [changing, setChanging] = useState(!hasPassword)
    const [password, setPassword] = useState("")

    const save = async () => {
        try {
            await updateSettings({ sii_password: password })
            setPassword("")
            setChanging(false)
        } catch {
            // El hook ya muestra el error; se conserva lo escrito para reintentar.
        }
    }

    if (!changing) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-foreground">Clave del SII</p>
                    <p className="text-sm text-muted-foreground">Configurada</p>
                </div>
                <Can permission={SETTINGS_PERMISSION}>
                    <Button type="button" variant="outline" onClick={() => setChanging(true)}>
                        Cambiar
                    </Button>
                </Can>
            </div>
        )
    }

    return (
        <div className="flex items-start gap-3">
            <div className="flex-1">
                <LabeledInput
                    label="Clave del SII"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Ingrese la clave del SII"
                    hint="Se guarda cifrada y no se vuelve a mostrar."
                />
            </div>
            <Can permission={SETTINGS_PERMISSION}>
                <div className="flex gap-2 pt-1">
                    <SubmitButton type="button" loading={isUpdating} disabled={password.trim() === ""} onClick={() => void save()}>
                        Guardar clave
                    </SubmitButton>
                    {hasPassword && (
                        <Button type="button" variant="outline" onClick={() => { setPassword(""); setChanging(false) }}>
                            Cancelar
                        </Button>
                    )}
                </div>
            </Can>
        </div>
    )
}

function ApiKeysCard() {
    const { apiKeys, isLoading, isError, refetch } = useRcvApiKeys()
    const [selected, setSelected] = useState<RcvApiKey | null>(null)
    const [creating, setCreating] = useState(false)
    const collection = useEntityCollection(
        rcvApiKeyEntity,
        { rows: apiKeys, rowCount: apiKeys.length, isLoading, isRefetching: false, error: isError, refetch },
        { pagination: { mode: "none" } },
    )

    return (
        <Card variant="default">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1.5">
                    <CardTitle className="text-lg text-primary">API keys de SimpleAPI</CardTitle>
                    <CardDescription>El cupo lo controla SimpleAPI. Se usa primero la key con menos consultas este mes; si SimpleAPI responde que una no tiene cupo, se pasa a la siguiente.</CardDescription>
                </div>
                <Can permission="accounting.add_rcvapikey">
                    <Button type="button" onClick={() => setCreating(true)}>
                        Agregar API key
                    </Button>
                </Can>
            </CardHeader>
            <CardContent>
                <Collection.Root collection={collection} label="API keys de SimpleAPI" onOpen={(row) => setSelected(row)}>
                    <Collection.View
                        table={rcvApiKeyViews.table}
                        emptyTitle="Sin API keys"
                        emptyDescription="Agrega una API key de SimpleAPI para poder importar el RCV."
                    />
                </Collection.Root>
            </CardContent>
            <RcvApiKeyModal
                key={selected?.id ?? "new"}
                apiKey={selected}
                open={creating || selected !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreating(false)
                        setSelected(null)
                    }
                }}
            />
        </Card>
    )
}

function RcvSettingsPanel({ settings }: { settings: RcvSettings }) {
    const { updateSettings } = useUpdateRcvSettings()
    const { can } = useAuth()
    const canChange = can(SETTINGS_PERMISSION)

    const form = useForm<RcvSettingsFormValues>({
        resolver: zodResolver(rcvSettingsSchema),
        mode: "onChange",
        defaultValues: toFormValues(settings),
    })

    // Autoguardado sin la clave SII: esa viaja por su propia mutación.
    const onSave = useCallback(async (data: RcvSettingsFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        validate: validateRcvSettings,
        enabled: canChange,
    })

    useUnsavedChangesGuard(status)

    const nextPeriod = formatRcvPeriod(settings.next_period.year, settings.next_period.month)

    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <FadeIn className="max-w-6xl mx-auto">
                <div className="space-y-6 mt-6 pb-6">
                    <div className="flex justify-end">
                        <AutoSaveStatusBadge status={status} invalidReason={invalidReason} lastSavedAt={lastSavedAt} onRetry={retry} />
                    </div>

                    <Form {...form}>
                        <fieldset disabled={!canChange} className="space-y-6 min-w-0">
                            <Card variant="default">
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Credenciales SII</CardTitle>
                                    <CardDescription>Datos de acceso al portal del SII para consultar el RCV.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="company_rut"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="RUT de la empresa"
                                                    placeholder="76.123.456-7"
                                                    {...field}
                                                    onBlur={() => {
                                                        field.onChange(formatRUT(field.value))
                                                        field.onBlur()
                                                    }}
                                                    error={fieldState.error?.message}
                                                />
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="user_rut"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="RUT del usuario"
                                                    placeholder="12.345.678-9"
                                                    {...field}
                                                    onBlur={() => {
                                                        field.onChange(formatRUT(field.value))
                                                        field.onBlur()
                                                    }}
                                                    error={fieldState.error?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                    <SiiPasswordField hasPassword={settings.has_sii_password} />
                                </CardContent>
                            </Card>

                            <Card variant="default">
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Importación automática</CardTitle>
                                    <CardDescription>Consulta periódicamente el RCV del SII y registra los documentos nuevos.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="enabled"
                                        render={({ field }) => (
                                            <LabeledSwitch
                                                label="Importación automática"
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
                                        name="interval_days"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Cada cuántos días"
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
                                    <div className="grid grid-cols-1 gap-3">
                                        <FormField
                                            control={form.control}
                                            name="include_purchases"
                                            render={({ field, fieldState }) => (
                                                <LabeledSwitch
                                                    label="Compras"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                />
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="include_sales"
                                            render={({ field }) => (
                                                <LabeledSwitch label="Ventas" checked={field.value} onCheckedChange={field.onChange} />
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-3 space-y-1 text-sm">
                                        <p className="text-foreground">Si corriera hoy consultaría {nextPeriod}</p>
                                        <p className="text-muted-foreground">
                                            Consumo estimado: {settings.estimated_monthly_queries} consultas/mes
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card variant="default">
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary">Cuadre</CardTitle>
                                    <CardDescription>
                                        Compara los documentos del ERP con las ventas TUU y el RCV del SII. Los documentos anteriores a la fecha de inicio no se evalúan.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="fiscal_match_start_date"
                                        render={({ field, fieldState }) => (
                                            <LabeledContainer label="Fecha de inicio del cuadre" error={fieldState.error?.message}>
                                                <DatePicker
                                                    date={field.value ? parseISO(field.value) : undefined}
                                                    onDateChange={(d) => field.onChange(d ? toDateOnlyISO(d) : null)}
                                                    placeholder="Sin fecha de inicio"
                                                    disabled={!canChange}
                                                    className="w-full border-none bg-transparent hover:bg-transparent shadow-none"
                                                />
                                            </LabeledContainer>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="terminal_match_window_minutes"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Ventana del cuadre TUU (minutos)"
                                                hint="Diferencia máxima entre la venta TUU y el documento. Entre 1 y 240."
                                                type="number"
                                                {...field}
                                                value={numberValue(field.value)}
                                                onChange={(event) => field.onChange(parseNumber(event.target.value))}
                                                min={1}
                                                max={240}
                                                step={1}
                                                error={fieldState.error?.message}
                                            />
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        </fieldset>
                    </Form>

                    <ApiKeysCard />
                </div>
            </FadeIn>
        </div>
    )
}

export function RcvSettingsView() {
    const { settings, isLoading, isError, refetch } = useRcvSettings()
    if (isError && !settings) {
        return (
            <Banner
                tone="destructive"
                className="max-w-3xl mx-auto mt-6"
                title="No se pudo cargar la configuración RCV / SII"
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
        <SkeletonShell isLoading={isLoading || !settings} ariaLabel="Cargando configuración RCV / SII">
            {settings && <RcvSettingsPanel settings={settings} />}
        </SkeletonShell>
    )
}
