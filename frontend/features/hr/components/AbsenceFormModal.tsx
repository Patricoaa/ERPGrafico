"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createAbsence, updateAbsence } from '@/features/hr/api/hrApi'
import type { Absence, Employee } from "@/types/hr"
import { Button } from "@/components/ui/button"
import { CancelButton, SubmitButton } from "@/components/shared/ActionButtons"
import { Form, FormField } from "@/components/ui/form"
import { CalendarX2 } from "lucide-react"
import { FORM_STYLES } from "@/lib/styles"
import { BaseModal, EmptyState, LabeledInput, LabeledSelect } from "@/components/shared"

export const absenceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    absence_type: z.enum(["AUSENTISMO", "LICENCIA", "PERMISO_SIN_GOCE", "AUSENCIA_HORAS"]),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().min(1, "Fecha de fin requerida"),
    days: z.number().min(0.5, "Los días deben ser mayores a 0"),
    notes: z.string().optional(),
})

export type AbsenceFormValues = z.infer<typeof absenceSchema>

export interface AbsenceFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    absence: Absence | null
    employees: Employee[]
    onSaved: () => void
    trigger?: React.ReactNode
}

export function AbsenceFormModal({ open, onOpenChange, absence, employees, onSaved, trigger }: AbsenceFormModalProps) {
    const [saving, setSaving] = useState(false)

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

    const footer = (
        <div className="flex justify-end gap-2 w-full">
            <CancelButton onClick={() => onOpenChange(false)} />
            <SubmitButton disabled={saving} onClick={form.handleSubmit(onSubmit)} loading={saving}>
                {absence ? "Actualizar" : "Registrar"}
            </SubmitButton>
        </div>
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <CalendarX2 className="h-5 w-5 text-primary" />
                    </div>
                    <span>{absence ? "Editar Inasistencia" : "Registrar Inasistencia"}</span>
                </div>
            }
            size="xl"
            hideScrollArea
            footer={footer}
        >
            <div className="flex-1 flex overflow-hidden h-[75vh]">
                {/* Left: Form */}
                <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-4 scrollbar-thin">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-1">
                            <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Empleado"
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
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="absence_type" render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Tipo de Inasistencia"
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
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        hint="Para ausencia de horas, calcule su equivalente en días (ej. 0.5)."
                                        error={fieldState.error?.message}
                                        {...field}
                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                )} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="start_date" render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Fecha Inicio"
                                        type="date"
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )} />
                                <FormField control={form.control} name="end_date" render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Fecha Fin"
                                        type="date"
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )} />
                            </div>
                            <FormField control={form.control} name="notes" render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Notas Adicionales"
                                    placeholder="Opcional..."
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )} />
                        </form>
                    </Form>
                </div>

                {/* Right: Activity Sidebar */}
                <div className="w-72 border-l bg-muted/5 flex flex-col pt-4">
                    {absence?.id ? (
                        <div className="h-full flex flex-col px-4 text-xs text-muted-foreground italic">
                            <p className="mb-2">ID Auditoría: {absence.id}</p>
                            <p>Registro histórico disponible en el panel de auditoría general.</p>
                        </div>
                    ) : (
                        <EmptyState
                            variant="compact"
                            context="generic"
                            description="El historial estará disponible una vez registrada la inasistencia."
                        />
                    )}
                </div>
            </div>
        </BaseModal>
    )
}
