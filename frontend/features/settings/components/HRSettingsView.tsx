"use client"

import { useState, useCallback } from "react"
import { frozenFieldsOf } from "@/lib/edit-policy"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type * as z from "zod"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Settings2 } from "lucide-react"

import { ActionConfirmModal, SubmitButton, AutoSaveStatusBadge, BaseModal, Chip, FadeIn, LabeledInput, LabeledSelect, SkeletonShell, ToolbarCreateButton } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useHrSettings } from '@/features/hr'
import type {
    AFP,
    PayrollConcept
} from "@/types/hr"

import { FormulaBuilder } from "@/features/hr"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { PayrollConceptClientView } from './PayrollConceptClientView'

import { globalSettingsSchema, conceptSchema, afpSchema, type GlobalHRFormValues, type ConceptFormValues, type AFPFormValues } from "./HRSettingsView.schema"

export function HRSettingsView({ activeTab = "global" }: { activeTab?: string }) {
    const { settings, afps, isLoading, updateSettings, createAfp, updateAfp, deleteAfp, refetch } = useHrSettings()

    // Global Settings Form
    const globalForm = useForm<z.infer<typeof globalSettingsSchema>>({
        resolver: zodResolver(globalSettingsSchema),
        defaultValues: {
            uf_current_value: "0",
            utm_current_value: "0",
            min_wage_value: "0",
            loan_deduction_cap_percent: "15",
        }
    })

    // Initialize form when settings load
    const settingsRef = useCallback(() => {
        if (settings) {
            globalForm.reset({
                uf_current_value: settings.uf_current_value,
                utm_current_value: settings.utm_current_value,
                min_wage_value: settings.min_wage_value || "500000",
                loan_deduction_cap_percent: settings.loan_deduction_cap_percent ?? "15",
            })
        }
    }, [settings, globalForm])

    // Run once when settings first load
    const [formInitialized, setFormInitialized] = useState(false)
    if (settings && !formInitialized) {
        settingsRef()
        setFormInitialized(true)
    }

    const afpDeleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteAfp(id)
            toast.success("AFP eliminada")
        } catch {
            toast.error("Error al eliminar AFP")
        }
    })

    const onSaveGlobal = useCallback(async (data: GlobalHRFormValues) => {
        await updateSettings(data)
    }, [updateSettings])

    const { status: globalStatus, invalidReason: globalInvalidReason, lastSavedAt: globalLastSavedAt, retry: globalRetry } = useAutoSaveForm({
        form: globalForm,
        onSave: onSaveGlobal,
        enabled: !isLoading,
    })

    useUnsavedChangesGuard(globalStatus)

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando configuración de RRHH">
        <div className="max-w-6xl mx-auto flex flex-col flex-1 min-h-0 space-y-6">
            <FadeIn key={activeTab}>
                {/* --- Tab: Global --- */}
                {activeTab === "global" && (
                    <div className="space-y-6 m-0 p-0 border-0 outline-none mt-6">
                        <div className="flex justify-end">
                            <AutoSaveStatusBadge
                                status={globalStatus}
                                invalidReason={globalInvalidReason}
                                lastSavedAt={globalLastSavedAt}
                                onRetry={globalRetry}
                            />
                        </div>
                        <Form {...globalForm}>
                            <div className="grid gap-6">
                                <Card variant="default">
                                    <CardHeader>
                                        <CardTitle className="text-lg text-primary">Indicadores Económicos</CardTitle>
                                        <CardDescription>Valores oficiales para el cálculo mensual</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <FormField
                                            control={globalForm.control}
                                            name="uf_current_value"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Valor UF Actual ($)"
                                                    type="number"
                                                    step="1"
                                                    className="font-mono"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                        <FormField
                                            control={globalForm.control}
                                            name="min_wage_value"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Sueldo Mínimo ($)"
                                                    type="number"
                                                    className="font-mono"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                        <FormField
                                            control={globalForm.control}
                                            name="loan_deduction_cap_percent"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Tope de descuentos (% de haberes)"
                                                    type="number"
                                                    step="1"
                                                    className="font-mono"
                                                    hint="Sobre este porcentaje se advierte al asignar anticipos o cuotas."
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                        <FormField
                                            control={globalForm.control}
                                            name="utm_current_value"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Valor UTM Actual ($)"
                                                    type="number"
                                                    step="1"
                                                    className="font-mono"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </CardContent>
                                </Card>


                            </div>
                        </Form>
                    </div>
                )}

                {/* --- Tab: Conceptos --- */}
                {activeTab === "concepts" && (
                    <div className="flex flex-col flex-1 min-h-0 space-y-6 m-0 p-0 border-0 outline-none mt-6">
                        <div className="px-1">
                            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Conceptos de Nómina</h3>
                            <p className="text-3xs uppercase font-bold text-muted-foreground">Gestión de haberes, descuentos y aportes</p>
                        </div>
                        <PayrollConceptClientView />
                    </div>
                )}

                {/* --- Tab: Previsión --- */}
                {activeTab === "previsional" && (
                    <div className="space-y-6 m-0 p-0 border-0 outline-none mt-6">
                        <div className="flex justify-between items-center px-1">
                            <div>
                                <h3 className="text-sm font-black uppercase text-primary tracking-widest">Instituciones Previsionales (AFP)</h3>
                                <p className="text-3xs uppercase font-bold text-muted-foreground">Gestión de comisiones para cálculo individual</p>
                            </div>
                            <AFPDialog onSaved={() => refetch()} onCreate={createAfp} onUpdate={updateAfp} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {afps.map((afp) => (
                                <Card key={afp.id} variant="default" className="relative overflow-hidden group hover:border-primary/50 transition-all">
                                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <AFPDialog afp={afp} onSaved={() => refetch()} onCreate={createAfp} onUpdate={updateAfp} />
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg text-primary">{afp.name}</CardTitle>
                                        <CardDescription className="text-2xl font-black text-primary">
                                            {afp.percentage}%
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-4xs uppercase text-muted-foreground font-bold mb-1 opacity-60">Pasivo de Pago</div>
                                        <div className="text-3xs truncate font-mono bg-primary/5 p-1.5 rounded-sm border border-primary/10 inline-block max-w-full text-primary font-bold">
                                            {afp.account ? "CENTRALIZADA" : "SIN CUENTA"}
                                        </div>
                                        <Button variant="ghost" size="sm" className="mt-4 w-full text-4xs font-medium uppercase text-destructive hover:bg-destructive/10 rounded-sm"
                                            onClick={() => afpDeleteConfirm.requestConfirm(afp.id)}>
                                            Eliminar Institución
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </FadeIn>

            <ActionConfirmModal
                open={afpDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) afpDeleteConfirm.cancel() }}
                onConfirm={afpDeleteConfirm.confirm}
                title="Eliminar AFP"
                description="¿Está seguro de que desea eliminar esta AFP? Se perderá el historial asociado."
                variant="destructive"
            />
        </div>
        </SkeletonShell>
    )
}

// --- DIALOGS ---

function AFPDialog({ afp, onSaved, onCreate, onUpdate }: { afp?: AFP, onSaved: () => void, onCreate: (data: Record<string, unknown>) => Promise<unknown>, onUpdate: (id: number, data: Record<string, unknown>) => Promise<unknown> }) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const form = useForm<AFPFormValues>({
        resolver: zodResolver(afpSchema),
        defaultValues: afp ? {
            name: afp.name,
            percentage: afp.percentage,
            account: afp.account?.toString() || null,
        } : {
            name: "",
            percentage: "10.00",
            account: null,
        }
    })

    const onSubmit = async (data: AFPFormValues) => {
        setSaving(true)
        try {
            const convertedData = {
                ...data,
                account: data.account ? Number(data.account) : null,
            }
            if (afp) {
                await onUpdate(afp.id, convertedData)
                toast.success("AFP actualizada")
            } else {
                await onCreate(convertedData)
                toast.success("AFP registrada")
            }
            onSaved()
            setOpen(false)
        } catch {
            toast.error("Error al guardar AFP")
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            {afp ? (
                <Button variant="outline" size="icon" className="h-control-xs w-7 border-2 rounded-sm" onClick={() => setOpen(true)}>
                    <Settings2 className="h-3.5 w-3.5" />
                </Button>
            ) : (
                <ToolbarCreateButton onClick={() => setOpen(true)} label="Añadir Institución" />
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="sm"
                title={
                    <div className="text-sm font-black uppercase tracking-widest">
                        Mantenimiento de AFP
                    </div>
                }
                description="Configure las tasas vigentes para las cotizaciones previsionales."
                footer={
                    <div className="flex w-full gap-3 justify-end pt-2 border-t">
                        <SubmitButton type="submit" form="afp-form" loading={saving} disabled={saving} className="w-full h-control-lg font-bold uppercase tracking-widest text-2xs">
                            Guardar Institución
                        </SubmitButton>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="afp-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Nombre Legal"
                                    placeholder="Ej: Habitat..."
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="percentage"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Comisión Total (%)"
                                    type="number"
                                    step="0.0001"
                                    className="font-mono"
                                    hint="Incluya el 10% obligatorio + la comisión."
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account"
                            render={({ field }) => (
                                <AccountSelector
                                    label="Cuenta Pasivo Individual"
                                    value={field.value}
                                    onChange={field.onChange}
                                    accountType="LIABILITY"
                                />
                            )}
                        />
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}
