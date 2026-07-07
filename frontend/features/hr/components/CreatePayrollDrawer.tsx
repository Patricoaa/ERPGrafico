"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createPayroll, getEmployees } from '@/features/hr/api/hrApi'
import type { Employee } from "@/types/hr"

import { Form, FormField } from "@/components/ui/form"
import { FileText } from "lucide-react"
import { useDrawerIdentity } from "@/features/_shared"
import { CancelButton, Drawer, FormFooter, LabeledInput, LabeledSelect, SkeletonShell, SubmitButton } from '@/components/shared'
import { useServerDate } from "@/hooks/useServerDate"
import { formDrawerWidth } from "@/lib/form-widths"

const MONTHS = [
    { value: 1, label: "Enero" }, { value: 2, label: "Febrero" },
    { value: 3, label: "Marzo" }, { value: 4, label: "Abril" },
    { value: 5, label: "Mayo" }, { value: 6, label: "Junio" },
    { value: 7, label: "Julio" }, { value: 8, label: "Agosto" },
    { value: 9, label: "Septiembre" }, { value: 10, label: "Octubre" },
    { value: 11, label: "Noviembre" }, { value: 12, label: "Diciembre" },
]

const createPayrollSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    period_year: z.string().min(1),
    period_month: z.string().min(1),
    notes: z.string().optional(),
})

export type CreatePayrollValues = z.infer<typeof createPayrollSchema>

export interface CreatePayrollDrawerProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    onSaved: (id: number) => void
    trigger?: React.ReactNode
}

export function CreatePayrollDrawer({ open, onOpenChange, onSaved, trigger }: CreatePayrollDrawerProps) {
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isFetchingEmployees, setIsFetchingEmployees] = useState(false)

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                setIsFetchingEmployees(true)
                getEmployees({ status: 'ACTIVE' })
                    .then(setEmployees)
                    .catch((e) => showApiError(e, "Error al cargar empleados"))
                    .finally(() => setIsFetchingEmployees(false))
            })
        }
    }, [open])

    const isFetchingInitialData = open && isFetchingEmployees

    const { year: serverYear, month: serverMonth } = useServerDate()
    const currentYear = serverYear ?? new Date().getFullYear()
    const currentMonth = serverMonth ?? new Date().getMonth() + 1

    const form = useForm<CreatePayrollValues>({
        resolver: zodResolver(createPayrollSchema),
        defaultValues: {
            employee: "",
            period_year: String(currentYear),
            period_month: String(currentMonth),
            notes: "",
        }
    })

    const onSubmit = async (data: CreatePayrollValues) => {
        setSaving(true)
        try {
            const created = await createPayroll({
                employee: parseInt(data.employee),
                period_year: parseInt(data.period_year),
                period_month: parseInt(data.period_month),
                notes: data.notes || "",
            })
            toast.success("Liquidación creada")
            onSaved(created.id)
        } catch (e: unknown) {
            showApiError(e, "Error al crear liquidación")
        } finally {
            setSaving(false)
        }
    }

    const identity = useDrawerIdentity('hr.payroll', 'create', undefined, {
        overrideTitle: "Nueva Liquidación",
        overrideSubtitle: "RRHH • Emisión Mensual",
    })

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            icon={identity.icon}
            title={identity.title}
            subtitle="RRHH • Emisión Mensual"
            defaultSize={formDrawerWidth("medium", false)}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <SubmitButton
                                form="create-payroll-form"
                                loading={saving}
                                icon={<FileText className="mr-2 h-3.5 w-3.5" />}
                                className="rounded-sm text-xs font-bold transition-all"
                            >
                                Crear Liquidación
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de liquidación">
                <Form {...form}>
                    <form
                        id="create-payroll-form"
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6 px-6 pb-6 pt-6">

                        <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Empleado"
                                required
                                value={field.value}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                                placeholder="Seleccionar empleado..."
                                options={employees.map(e => ({
                                    value: String(e.id),
                                    label: `${e.contact_detail?.name} — ${e.contact_detail?.tax_id}`
                                }))}
                            />
                        )} />

                        <FormField control={form.control} name="period_year" render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Año"
                                required
                                value={field.value}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                                options={[currentYear - 1, currentYear, currentYear + 1].map(y => ({
                                    value: String(y),
                                    label: String(y)
                                }))}
                            />
                        )} />
                        <FormField control={form.control} name="period_month" render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Mes"
                                required
                                value={field.value}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                                options={MONTHS.map(m => ({
                                    value: String(m.value),
                                    label: m.label
                                }))}
                            />
                        )} />

                        <FormField control={form.control} name="notes" render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Notas (Opcional)"
                                placeholder="Información adicional..."
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )} />
                    </form>
                </Form>
            </SkeletonShell>
        </Drawer>
    )
}
