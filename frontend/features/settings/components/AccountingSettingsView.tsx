"use client"

import {useState, useEffect, useCallback} from "react"
import { useForm, UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { ActionConfirmModal, AutoSaveStatusBadge, FadeIn, LabeledInput, LabeledSelect, PageHeaderButton, SkeletonShell } from '@/components/shared'
import { settingsApi } from "@/features/settings/api/settingsApi"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { accountingSchema, type AccountingFormValues } from "@/features/settings/schemas/accounting"

// --- COMPONENT ---

export function AccountingSettingsView() {
    return <StructureSettings />
}

// --- SUB-COMPONENTS ---

import { useAccountingSettings } from "@/features/settings/hooks/useAccountingSettings"

function StructureSettings() {
    const { structure: settings, isLoading, refetch, updateSettings } = useAccountingSettings()
    const [populating, setPopulating] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: {
            hierarchy_levels: 4,
            code_separator: ".",
            asset_prefix: "",
            liability_prefix: "",
            equity_prefix: "",
            income_prefix: "",
            expense_prefix: "",
        },
    })

    useEffect(() => {
        if (settings) form.reset(settings)
    }, [settings, form])

    const onSave = useCallback(async (data: AccountingFormValues) => {
        await updateSettings(data as unknown as Record<string, unknown>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: true,
    })

    useUnsavedChangesGuard(status)

    if (isLoading && !settings) return <SkeletonShell isLoading ariaLabel="Cargando configuración..." />

    const formValues = form.watch()

    const handlePopulateIFRS = () => setConfirmOpen(true)

    const onConfirmPopulate = async () => {
        setPopulating(true)
        try {
            const res = await settingsApi.populateIfrsChart()
            const { toast } = await import("sonner")
            toast.success(res.message)
            window.location.reload()
        } catch {
            const { toast } = await import("sonner")
            toast.error("Error al poblar plan de cuentas")
        } finally {
            setPopulating(false)
        }
    }

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
                <form className="space-y-6">
                    {/* Fila 1: Dos columnas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Columna 1: Estructura del Código */}
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Estructura del Código</CardTitle>
                                <CardDescription>Establezca los niveles de jerarquía y el formato del código para su Plan de Cuentas</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Vista previa del formato */}
                                <fieldset className="notched-field bg-primary/[0.03] border-primary/20 pointer-events-none select-none">
                                    <legend className="px-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary/80">
                                        Vista Previa del Formato
                                    </legend>
                                    <div className="flex items-center justify-between w-full min-h-[2.5rem] py-1">
                                        <p className="text-[10px] text-muted-foreground uppercase opacity-75 font-bold pl-2.5">
                                            Ejemplo nivel {formValues.hierarchy_levels}
                                        </p>
                                        <div className="px-4 py-1.5 bg-background border border-primary/20 rounded-sm text-lg font-mono font-bold tracking-tighter text-primary mr-1">
                                            {generatePreview(formValues)}
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="hierarchy_levels"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Niveles de Jerarquía"
                                                value={field.value?.toString() || "4"}
                                                onChange={(val) => field.onChange(parseInt(val))}
                                                error={fieldState.error?.message}
                                                options={[2, 3, 4, 5].map((n) => ({ value: n.toString(), label: `${n} Niveles` }))}
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="code_separator"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Separador"
                                                value={field.value || "."}
                                                onChange={field.onChange}
                                                error={fieldState.error?.message}
                                                options={[
                                                    { value: ".", label: "Punto ( . )" },
                                                    { value: "-", label: "Guion ( - )" },
                                                    { value: "/", label: "Slash ( / )" },
                                                ]}
                                            />
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Columna 2: Prefijos de Cuentas */}
                        <Card variant="default">
                            <CardHeader>
                                <CardTitle className="text-lg text-primary">Prefijos de Cuentas</CardTitle>
                                <CardDescription>Establezca los prefijos del Nivel 1 para clasificar cada tipo de cuenta contable</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <PrefixField form={form} name="asset_prefix" label="Activos" />
                                    <PrefixField form={form} name="liability_prefix" label="Pasivos" />
                                    <PrefixField form={form} name="equity_prefix" label="Patrimonio" />
                                    <PrefixField form={form} name="income_prefix" label="Ingresos" />
                                    <div className="col-span-2 md:col-span-1">
                                        <PrefixField form={form} name="expense_prefix" label="Gastos" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card variant="default">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Plan de Cuentas IFRS</CardTitle>
                            <CardDescription>Cargue el Plan de Cuentas oficial recomendado por la normativa IFRS para comenzar de inmediato</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-sm">
                            <div className="space-y-1">
                                <p className="text-[11px] font-bold uppercase text-primary/80">Generación Automática de Cuentas</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Esta acción creará las cuentas detalladas y configurará los mapeos contables por defecto de manera instantánea.</p>
                            </div>
                            <PageHeaderButton
                                onClick={handlePopulateIFRS}
                                disabled={populating}
                                iconName={populating ? "loader-2" : "database"}
                                label={populating ? "Poblar Plan de Cuentas IFRS" : "Poblar Plan de Cuentas IFRS"}
                                variant="outline"
                                className="font-bold whitespace-nowrap px-4 py-2 rounded-sm"
                            />
                        </CardContent>
                    </Card>
                </form>
            </Form>

            <ActionConfirmModal
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={onConfirmPopulate}
                title="Cargar Plan de Cuentas IFRS"
                description="¿Está seguro de cargar el plan de cuentas IFRS? Esto creará las cuentas detalladas y configurará todos los mapeos predeterminados automáticamente."
                variant="warning"
                confirmText="Cargar Plan IFRS"
            />
        </div>
    )
}

function PrefixField({ form, name, label }: { form: UseFormReturn<AccountingFormValues>, name: keyof AccountingFormValues, label: string }) {
    return (
        <FormField control={form.control} name={name} render={({ field, fieldState }) => (
            <LabeledInput
                {...field}
                value={field.value?.toString() || ""}
                label={label}
                error={fieldState.error?.message}
                className="font-mono text-[11px]"
            />
        )} />
    )
}

function generatePreview(values: AccountingFormValues) {
    const { hierarchy_levels, code_separator, asset_prefix } = values;
    let code = asset_prefix || "1";
    const levels = [{ padding: 1 }, { padding: 2 }, { padding: 2 }, { padding: 3 }];
    for (let i = 0; i < Math.min(hierarchy_levels - 1, levels.length); i++) {
        code += (code_separator || ".") + "1".padStart(levels[i].padding, "0");
    }
    return code;
}
