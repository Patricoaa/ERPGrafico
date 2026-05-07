"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import {
    Loader2,
    Trash2,
    Settings2,
    AlertCircle
} from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import { AutoSaveStatusBadge, FormSkeleton, LabeledInput, LabeledSelect, ToolbarCreateButton } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import {
    getGlobalHRSettings,
    updateGlobalHRSettings,
    getAFPs,
    createAFP,
    updateAFP,
    deleteAFP,
    getPayrollConcepts,
    createPayrollConcept,
    updatePayrollConcept,
    deletePayrollConcept
} from '@/features/hr/api/hrApi'
import type {
    AFP,
    PayrollConcept
} from "@/types/hr"
import { Badge } from "@/components/ui/badge"
import { FormulaBuilder } from "@/features/hr/components/FormulaBuilder"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"

import { globalSettingsSchema, conceptSchema, afpSchema, type GlobalHRFormValues, type ConceptFormValues, type AFPFormValues } from "./HRSettingsView.schema"

export function HRSettingsView({ activeTab = "global" }: { activeTab?: string }) {
    const [loading, setLoading] = useState(true)
    const [concepts, setConcepts] = useState<PayrollConcept[]>([])
    const [afps, setAfps] = useState<AFP[]>([])

    // Global Settings Form
    const globalForm = useForm<z.infer<typeof globalSettingsSchema>>({
        resolver: zodResolver(globalSettingsSchema),
        defaultValues: {
            uf_current_value: "0",
            utm_current_value: "0",
            min_wage_value: "0",
            account_remuneraciones_por_pagar: null,
            account_previred_por_pagar: null,
            account_anticipos: null,
        }
    })

    const fetchData = useCallback(async () => {
        try {
            const [settings, conceptsData, afpsData] = await Promise.all([
                getGlobalHRSettings(),
                getPayrollConcepts(),
                getAFPs()
            ])

            globalForm.reset({
                uf_current_value: settings.uf_current_value,
                utm_current_value: settings.utm_current_value,
                min_wage_value: settings.min_wage_value || "500000",
                account_remuneraciones_por_pagar: settings.account_remuneraciones_por_pagar?.toString() || null,
                account_previred_por_pagar: settings.account_previred_por_pagar?.toString() || null,
                account_anticipos: settings.account_anticipos?.toString() || null,
            })
            setConcepts(conceptsData)
            setAfps(afpsData)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar datos de RRHH")
        } finally {
            setLoading(false)
        }
    }, [globalForm])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const conceptDeleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deletePayrollConcept(id)
            toast.success("Concepto eliminado")
            fetchData()
        } catch {
            toast.error("Error al eliminar concepto")
        }
    })

    const afpDeleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteAFP(id)
            toast.success("AFP eliminada")
            fetchData()
        } catch {
            toast.error("Error al eliminar AFP")
        }
    })

    const onSaveGlobal = useCallback(async (data: GlobalHRFormValues) => {
        const convertedData = {
            ...data,
            account_remuneraciones_por_pagar: data.account_remuneraciones_por_pagar ? Number(data.account_remuneraciones_por_pagar) : null,
            account_previred_por_pagar: data.account_previred_por_pagar ? Number(data.account_previred_por_pagar) : null,
            account_anticipos: data.account_anticipos ? Number(data.account_anticipos) : null,
        }
        await updateGlobalHRSettings(convertedData)
    }, [])

    const { status: globalStatus, invalidReason: globalInvalidReason, lastSavedAt: globalLastSavedAt, retry: globalRetry } = useAutoSaveForm({
        form: globalForm,
        onSave: onSaveGlobal,
        enabled: !loading,
    })

    useUnsavedChangesGuard(globalStatus)

    const conceptColumns: ColumnDef<PayrollConcept>[] = [
        {
            accessorKey: "name",
            header: "Concepto de Nómina",
            cell: ({ row }) => (
                <div className="flex items-center gap-2 py-1">
                    <span className="font-black text-[12px] tracking-tight uppercase leading-none">{row.getValue("name")}</span>
                    {row.original.is_system && (
                        <Badge variant="secondary" className="text-[8px] font-black h-4 px-1 rounded-sm bg-primary/10 text-primary border-primary/20">
                            SYSTEM
                        </Badge>
                    )}
                </div>
            )
        },
        {
            accessorKey: "category_display",
            header: "Categoría",
            cell: ({ row }) => {
                const category = row.original.category
                const isHaber = category.includes('HABER')
                return (
                    <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase h-5 shadow-sm rounded-sm",
                        isHaber ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                        {row.getValue("category_display")}
                    </Badge>
                )
            }
        },
        {
            accessorKey: "formula_type_display",
            header: "Lógica / Fórmula",
            cell: ({ row }) => (
                <span className="text-[10px] font-medium text-muted-foreground italic">
                    {row.getValue("formula_type_display")}
                </span>
            )
        },
        {
            accessorKey: "account_code",
            header: "Cuenta Contable",
            cell: ({ row }) => (
                <div className="font-mono text-[10px] text-primary/70 bg-primary/5 px-2 py-0.5 rounded-sm border border-primary/10 w-fit">
                    {row.getValue("account_code")}
                </div>
            )
        },
        createActionsColumn<PayrollConcept>({
            renderActions: (concept) => (
                <>
                    <ConceptDialog concept={concept} onSaved={fetchData} />
                    {!concept.is_system && (
                        <DataCell.Action
                            icon={Trash2}
                            title="Eliminar"
                            className="text-destructive h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => conceptDeleteConfirm.requestConfirm(concept.id)}
                        />
                    )}
                </>
            )
        })
    ]

    if (loading) return <FormSkeleton hasTabs tabs={3} fields={4} />

    return (
        <div className="max-w-6xl mx-auto space-y-6">
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
                            <Card className="rounded-md border-2">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Indicadores Económicos</CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold">Valores oficiales para el cálculo mensual</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <FormField
                                        control={globalForm.control}
                                        name="uf_current_value"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Valor UF Actual ($)"
                                                type="number"
                                                step="0.01"
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
                                        name="utm_current_value"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Valor UTM Actual ($)"
                                                type="number"
                                                step="0.01"
                                                className="font-mono"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="rounded-md border-2">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 opacity-50" />
                                        Cuentas Consolidadas
                                    </CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold">Cuentas contables de cierre de nómina centralizado</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <FormField
                                        control={globalForm.control}
                                        name="account_remuneraciones_por_pagar"
                                        render={({ field }) => (
                                            <AccountSelector
                                                label="Remuneraciones por Pagar (Líquido)"
                                                value={field.value}
                                                onChange={field.onChange}
                                                accountType="LIABILITY"
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={globalForm.control}
                                        name="account_previred_por_pagar"
                                        render={({ field }) => (
                                            <AccountSelector
                                                label="Obligaciones Previred (Pasivo)"
                                                value={field.value}
                                                onChange={field.onChange}
                                                accountType="LIABILITY"
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={globalForm.control}
                                        name="account_anticipos"
                                        render={({ field }) => (
                                            <AccountSelector
                                                label="Anticipos de Remuneraciones (Activo)"
                                                value={field.value}
                                                onChange={field.onChange}
                                                accountType="ASSET"
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
                <div className="space-y-6 m-0 p-0 border-0 outline-none mt-6">
                    <div className="flex justify-between items-center px-1">
                        <div>
                            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Conceptos de Nómina</h3>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Gestión de haberes, descuentos y aportes</p>
                        </div>
                        <ConceptDialog onSaved={fetchData} />
                    </div>

                    <DataTable
                        columns={conceptColumns}
                        data={concepts}
                        filterColumn="name"
                        searchPlaceholder="Buscar concepto..."
                        isLoading={loading}
                        cardMode={true}
                    />
                </div>
            )}

            {/* --- Tab: Previsión --- */}
            {activeTab === "previsional" && (
                <div className="space-y-6 m-0 p-0 border-0 outline-none mt-6">
                    <div className="flex justify-between items-center px-1">
                        <div>
                            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Instituciones Previsionales (AFP)</h3>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Gestión de comisiones para cálculo individual</p>
                        </div>
                        <AFPDialog onSaved={fetchData} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {afps.map((afp) => (
                            <Card key={afp.id} className="relative overflow-hidden group hover:border-primary/50 transition-all rounded-md border-2">
                                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <AFPDialog afp={afp} onSaved={fetchData} />
                                </div>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-black uppercase tracking-tight">{afp.name}</CardTitle>
                                    <CardDescription className="text-2xl font-black text-primary font-heading">
                                        {afp.percentage}%
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-[9px] uppercase text-muted-foreground font-black mb-1 opacity-60">Pasivo de Pago</div>
                                    <div className="text-[10px] truncate font-mono bg-primary/5 p-1.5 rounded-sm border border-primary/10 inline-block max-w-full text-primary font-bold">
                                        {afp.account ? "CENTRALIZADA" : "SIN CUENTA"}
                                    </div>
                                    <Button variant="ghost" size="sm" className="mt-4 w-full text-[9px] font-black uppercase text-destructive hover:bg-destructive/10 rounded-sm"
                                        onClick={() => afpDeleteConfirm.requestConfirm(afp.id)}>
                                        Eliminar Institución
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <ActionConfirmModal
                open={conceptDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) conceptDeleteConfirm.cancel() }}
                onConfirm={conceptDeleteConfirm.confirm}
                title="Eliminar Concepto"
                description="¿Está seguro de que desea eliminar este concepto de nómina? Esta acción no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={afpDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) afpDeleteConfirm.cancel() }}
                onConfirm={afpDeleteConfirm.confirm}
                title="Eliminar AFP"
                description="¿Está seguro de que desea eliminar esta AFP? Se perderá el historial asociado."
                variant="destructive"
            />
        </div>
    )
}


// --- DIALOGS ---

function ConceptDialog({ concept, onSaved }: { concept?: PayrollConcept, onSaved: () => void }) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const form = useForm<ConceptFormValues>({
        resolver: zodResolver(conceptSchema),
        defaultValues: concept ? {
            name: concept.name,
            category: concept.category,
            account: concept.account.toString(),
            formula_type: concept.formula_type,
            formula: concept.formula || "",
            default_amount: concept.default_amount,
        } : {
            name: "",
            category: "HABER_IMPONIBLE",
            account: "",
            formula_type: "FIXED",
            formula: "",
            default_amount: "0",
        }
    })

    const onSubmit = async (data: ConceptFormValues) => {
        setSaving(true)
        try {
            const convertedData = {
                ...data,
                account: Number(data.account),
            }
            if (concept) {
                await updatePayrollConcept(concept.id, convertedData)
                toast.success("Concepto actualizado")
            } else {
                await createPayrollConcept(convertedData)
                toast.success("Concepto creado")
            }
            onSaved()
            setOpen(false)
        } catch {
            toast.error("Error al guardar concepto")
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            {concept ? (
                <DataCell.Action icon={Settings2} title="Configurar" onClick={() => setOpen(true)} />
            ) : (
                <ToolbarCreateButton onClick={() => setOpen(true)} label="Nuevo Concepto" />
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="md"
                title={
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                        Mantenimiento de Concepto
                    </div>
                }
                description="Defina el comportamiento y la cuenta contable de este ítem de nómina."
                footer={
                    <div className="flex w-full gap-3 justify-end pt-2 border-t">
                        <ActionSlideButton type="submit" form="concept-form" loading={saving} disabled={saving} className="w-full h-10 font-black uppercase tracking-widest text-[11px]">
                            Validar y Guardar Cambios
                        </ActionSlideButton>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="concept-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Nombre Público"
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Categoría Nómina"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                    options={[
                                        { value: "HABER_IMPONIBLE", label: "Haber Imponible" },
                                        { value: "HABER_NO_IMPONIBLE", label: "Haber No Imponible" },
                                        { value: "DESCUENTO_LEGAL_TRABAJADOR", label: "Desc. Legal (Cargo Trabajador)" },
                                        { value: "DESCUENTO_LEGAL_EMPLEADOR", label: "Desc. Legal (Cargo Empleador)" },
                                        { value: "OTRO_DESCUENTO", label: "Otro Descuento / Anticipo" },
                                    ]}
                                    placeholder="Seleccione categoría"
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account"
                            render={({ field }) => {
                                const category = form.watch("category")
                                let accountType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | undefined = undefined

                                if (category === 'HABER_IMPONIBLE' || category === 'HABER_NO_IMPONIBLE' || category === 'DESCUENTO_LEGAL_EMPLEADOR') {
                                    accountType = 'EXPENSE'
                                } else if (category === 'DESCUENTO_LEGAL_TRABAJADOR') {
                                    accountType = 'LIABILITY'
                                }
                                return (
                                    <AccountSelector
                                        label="Asignación Contable"
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType={accountType}
                                    />
                                )
                            }}
                        />
                        <FormField
                            control={form.control}
                            name="formula_type"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Lógica de Cálculo"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                    options={[
                                        { value: "FIXED", label: "Monto Fijo (Manual)" },
                                        { value: "PERCENTAGE", label: "Porcentaje % (del Imponible)" },
                                        { value: "EMPLOYEE_SPECIFIC", label: "Ficha Empleado (Individual)" },
                                        { value: "FORMULA", label: "Fórmula Matemática" },
                                        { value: "CHILEAN_LAW", label: "Legal Chile (Automático)" },
                                    ]}
                                    placeholder="Seleccione lógica"
                                />
                            )}
                        />

                        {form.watch("formula_type") === 'FORMULA' && (
                            <FormField
                                control={form.control}
                                name="formula"
                                render={({ field, fieldState }) => (
                                    <div className="bg-primary/5 p-3 rounded-md border border-dashed border-primary/20 space-y-3">
                                        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-primary">
                                            Constructor de Fórmula
                                            <Badge variant="outline" className="text-[8px] bg-background">ADVANCED</Badge>
                                        </span>
                                        <LabeledInput
                                            label="Expresión"
                                            placeholder="BASE * 0.25"
                                            className="font-mono text-[11px]"
                                            error={fieldState.error?.message}
                                            {...field}
                                        />
                                        <FormulaBuilder
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                        />
                                    </div>
                                )}
                            />
                        )}

                        {(form.watch("formula_type") === 'FIXED' || form.watch("formula_type") === 'PERCENTAGE') && (
                            <FormField
                                control={form.control}
                                name="default_amount"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label={form.watch("formula_type") === 'PERCENTAGE' ? "Factor Porcentual (%)" : "Monto Predeterminado ($)"}
                                        type="number"
                                        step="0.0001"
                                        className="font-mono"
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )}
                            />
                        )}
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}

function AFPDialog({ afp, onSaved }: { afp?: AFP, onSaved: () => void }) {
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
                await updateAFP(afp.id, convertedData)
                toast.success("AFP actualizada")
            } else {
                await createAFP(convertedData)
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
                <Button variant="outline" size="icon" className="h-7 w-7 border-2 rounded-sm" onClick={() => setOpen(true)}>
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
                        <ActionSlideButton type="submit" form="afp-form" loading={saving} disabled={saving} className="w-full h-10 font-black uppercase tracking-widest text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground">
                            Guardar Institución
                        </ActionSlideButton>
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
