"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createAbsence, updateAbsence } from '@/features/hr/api/hrApi'
import { useEmployees } from '@/features/hr/hooks/useEmployees'
import type { Absence, Employee } from "@/types/hr"
import { Button } from "@/components/ui/button"
import { CancelButton, ActionSlideButton } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { Printer } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { Drawer, LabeledInput, LabeledSelect, PeriodValidationDateInput, FormFooter, FormSplitLayout } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit/components"
import { formDrawerWidth } from "@/lib/form-widths"

export const absenceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    absence_type: z.enum(["AUSENTISMO", "LICENCIA", "PERMISO_SIN_GOCE", "AUSENCIA_HORAS"]),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().min(1, "Fecha de fin requerida"),
    days: z.number().min(0.5, "Los días deben ser mayores a 0"),
    notes: z.string().optional(),
})

export type AbsenceFormValues = z.infer<typeof absenceSchema>

export interface AbsenceDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    absence: Absence | null
    employees?: Employee[]
    onSaved: () => void
    trigger?: React.ReactNode
    mode?: DrawerMode
}

export function AbsenceDrawer({ open, onOpenChange, absence, employees: employeesProp, onSaved, trigger, mode: modeProp }: AbsenceDrawerProps) {
    const { employees: fetchedEmployees } = useEmployees()
    const employees = employeesProp ?? fetchedEmployees
    const mode: DrawerMode = modeProp ?? (absence ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })
    const [saving, setSaving] = useState(false)

    const width = formDrawerWidth("medium", !!absence)

    const form = useForm<AbsenceFormValues>({
        resolver: zodResolver(absenceSchema),
        defaultValues: {
            employee: "",
            absence_type: "AUSENTISMO",
            start_date: "",
            end_date: "",
            days: 1,
            notes: "",
        }
    })

    useEffect(() => {
        if (absence) {
            form.reset({
                employee: absence.employee.toString(),
                absence_type: absence.absence_type,
                start_date: absence.start_date,
                end_date: absence.end_date,
                days: Number(absence.days),
                notes: absence.notes || "",
            })
        } else {
            form.reset({
                employee: "",
                absence_type: "AUSENTISMO",
                start_date: "",
                end_date: "",
                days: 1,
                notes: "",
            })
        }
    }, [absence, form, open])

    const onSubmit = async (data: AbsenceFormValues) => {
        setSaving(true)
        try {
            const payload = {
                ...data,
                employee: parseInt(data.employee),
            }
            if (absence) {
                await updateAbsence(absence.id, payload as Parameters<typeof updateAbsence>[1])
                toast.success("Inasistencia actualizada")
            } else {
                await createAbsence(payload as Parameters<typeof createAbsence>[0])
                toast.success("Inasistencia registrada")
            }
            onSaved()
        } catch (e: unknown) {
            showApiError(e, "Error al guardar ausencia")
        } finally {
            setSaving(false)
        }
    }

    const drawerTitle = isView
        ? `Ficha de Inasistencia${absence?.id ? ` #${absence.id}` : ""}`
        : mode === 'create'
            ? "Registrar Inasistencia"
            : "Editar Inasistencia"

    const footer = isView ? undefined : (
        <FormFooter
            actions={
                <>
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <ActionSlideButton type="submit" disabled={saving} onClick={form.handleSubmit(onSubmit)} loading={saving}>
                        {mode === 'create' ? "Registrar" : "Actualizar"}
                    </ActionSlideButton>
                </>
            }
        />
    )

    return (
        <>
            {(mode === 'view' || mode === 'edit') && absence?.id && (
                <PrintableLayout ref={printRef} title="Inasistencia" displayId={`#${absence.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Empleado:</span>
                            <span>{absence?.employee_name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={width}
                icon={getEntityIcon('hr.absence')}
                title={<span>{drawerTitle}</span>}
                headerActions={(mode === 'view' || mode === 'edit') && absence?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle="Ingrese los detalles de la ausencia del empleado."
                mode={mode}
                footer={footer}
            >
                {absence ? (
                    <FormSplitLayout
                        showSidebar={true}
                        sidebar={<ActivitySidebar entityType="absence" entityId={absence.id} />}
                    >
                        <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-4 scrollbar-thin">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">

                                    <fieldset disabled={isView} className="contents">
                                        <div className="space-y-6">
                                            <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Empleado"
                                                    required
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    placeholder="Seleccione empleado"
                                                    options={employees.map(e => ({
                                                        value: e.id.toString(),
                                                        label: e.contact_detail?.name || ""
                                                    }))}
                                                />
                                            )} />
                                            <FormField control={form.control} name="absence_type" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Tipo de Inasistencia"
                                                    required
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "AUSENTISMO", label: "Ausentismo Injustificado" },
                                                        { value: "LICENCIA", label: "Licencia Médica" },
                                                        { value: "PERMISO_SIN_GOCE", label: "Permiso sin Goce de Sueldo" },
                                                        { value: "AUSENCIA_HORAS", label: "Ausencia de Horas" }
                                                    ]}
                                                />
                                            )} />
                                            <FormField control={form.control} name="days" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Días Totales"
                                                    required
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    hint="Para ausencia de horas, calcule su equivalente en días (ej. 0.5)."
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            )} />
                                            <FormField control={form.control} name="start_date" render={({ field, fieldState }) => (
                                                <PeriodValidationDateInput
                                                    label="Fecha Inicio"
                                                    required
                                                    date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                                    onDateChange={(d) => {
                                                        if (!d) {
                                                            field.onChange("")
                                                            return
                                                        }
                                                        field.onChange(d.toISOString().split('T')[0])
                                                    }}
                                                    error={fieldState.error?.message}
                                                    validationType="accounting"
                                                />
                                            )} />
                                            <FormField control={form.control} name="end_date" render={({ field, fieldState }) => (
                                                <PeriodValidationDateInput
                                                    label="Fecha Fin"
                                                    required
                                                    date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                                    onDateChange={(d) => {
                                                        if (!d) {
                                                            field.onChange("")
                                                            return
                                                        }
                                                        field.onChange(d.toISOString().split('T')[0])
                                                    }}
                                                    error={fieldState.error?.message}
                                                    validationType="accounting"
                                                />
                                            )} />
                                            <FormField control={form.control} name="notes" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Notas Adicionales"
                                                    placeholder="Opcional..."
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )} />
                                        </div>
                                    </fieldset>

                                </form>
                            </Form>
                        </div>
                    </FormSplitLayout>
                ) : (
                    <FormSplitLayout>
                        <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-4 scrollbar-thin">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                                    <fieldset disabled={isView} className="contents">
                                        <div className="space-y-6">
                                            <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Empleado"
                                                    required
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    placeholder="Seleccione empleado"
                                                    options={employees.map(e => ({
                                                        value: e.id.toString(),
                                                        label: e.contact_detail?.name || ""
                                                    }))}
                                                />
                                            )} />
                                            <FormField control={form.control} name="absence_type" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Tipo de Inasistencia"
                                                    required
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "AUSENTISMO", label: "Ausentismo Injustificado" },
                                                        { value: "LICENCIA", label: "Licencia Médica" },
                                                        { value: "PERMISO_SIN_GOCE", label: "Permiso sin Goce de Sueldo" },
                                                        { value: "AUSENCIA_HORAS", label: "Ausencia de Horas" }
                                                    ]}
                                                />
                                            )} />
                                            <FormField control={form.control} name="days" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Días Totales"
                                                    required
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    hint="Para ausencia de horas, calcule su equivalente en días (ej. 0.5)."
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            )} />
                                            <FormField control={form.control} name="start_date" render={({ field, fieldState }) => (
                                                <PeriodValidationDateInput
                                                    label="Fecha Inicio"
                                                    required
                                                    date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                                    onDateChange={(d) => {
                                                        if (!d) {
                                                            field.onChange("")
                                                            return
                                                        }
                                                        field.onChange(d.toISOString().split('T')[0])
                                                    }}
                                                    error={fieldState.error?.message}
                                                    validationType="accounting"
                                                />
                                            )} />
                                            <FormField control={form.control} name="end_date" render={({ field, fieldState }) => (
                                                <PeriodValidationDateInput
                                                    label="Fecha Fin"
                                                    required
                                                    date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                                    onDateChange={(d) => {
                                                        if (!d) {
                                                            field.onChange("")
                                                            return
                                                        }
                                                        field.onChange(d.toISOString().split('T')[0])
                                                    }}
                                                    error={fieldState.error?.message}
                                                    validationType="accounting"
                                                />
                                            )} />
                                            <FormField control={form.control} name="notes" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Notas Adicionales"
                                                    placeholder="Opcional..."
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )} />
                                        </div>
                                    </fieldset>
                                </form>
                            </Form>
                        </div>
                    </FormSplitLayout>
                )}
            </Drawer >
        </>
    )
}
