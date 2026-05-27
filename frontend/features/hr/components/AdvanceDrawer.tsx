"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { updateAdvance } from '@/features/hr/api/hrApi'
import { useEmployees } from '@/features/hr/hooks/useEmployees'
import { usePayrolls } from '@/features/hr/hooks/usePayrolls'
import type { SalaryAdvance, Employee, Payroll } from "@/types/hr"
import { ActivitySidebar } from "@/features/audit/components"
import { Button } from "@/components/ui/button"
import { CancelButton, ActionSlideButton } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { Drawer, LabeledInput, LabeledSelect, PeriodValidationDateInput, FormFooter, FormSplitLayout } from "@/components/shared"
import { WalletCards } from "lucide-react"
import { formDrawerWidth } from "@/lib/form-widths"

export const advanceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    amount: z.string().min(1).refine(v => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    date: z.string().min(1, "Fecha requerida"),
    payroll: z.string().min(1, "Vincular a una liquidación es obligatorio"),
    notes: z.string().optional(),
})

export type AdvanceFormValues = z.infer<typeof advanceSchema>

export interface AdvanceDrawerProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    advance: SalaryAdvance | null
    employees?: Employee[]
    payrolls?: Payroll[]
    onSaved: (data?: Record<string, unknown>) => void
}

export function AdvanceDrawer({ open, onOpenChange, advance, employees: employeesProp, payrolls: payrollsProp, onSaved }: AdvanceDrawerProps) {
    const { employees: fetchedEmployees } = useEmployees()
    const { payrolls: fetchedPayrolls } = usePayrolls()
    const employees = employeesProp ?? fetchedEmployees
    const payrolls = payrollsProp ?? fetchedPayrolls
    const [saving, setSaving] = useState(false)
    
    const width = formDrawerWidth("medium", !!advance)

    const form = useForm<AdvanceFormValues>({
        resolver: zodResolver(advanceSchema),
        defaultValues: {
            employee: "",
            amount: "",
            date: new Date().toISOString().split('T')[0],
            payroll: "",
            notes: "",
        }
    })

    useEffect(() => {
        if (advance) {
            form.reset({
                employee: advance.employee.toString(),
                amount: advance.amount.toString(),
                date: advance.date,
                payroll: advance.payroll ? advance.payroll.toString() : "",
                notes: advance.notes || "",
            })
        } else if (open) {
            form.reset({
                employee: "",
                amount: "",
                date: new Date().toISOString().split('T')[0],
                payroll: "",
                notes: "",
            })
        }
    }, [advance, open, form])

    const onSubmit = async (data: AdvanceFormValues) => {
        setSaving(true)
        try {
            const payload = {
                employee: parseInt(data.employee),
                amount: data.amount,
                date: data.date,
                payroll: parseInt(data.payroll),
                notes: data.notes || "",
            }
            if (advance) {
                await updateAdvance(advance.id, payload)
                toast.success("Anticipo actualizado")
                onSaved()
            } else {
                // For NEW advances, we just pass the data to the next step (PaymentDialog)
                onSaved(payload)
            }
        } catch (e: unknown) {
            showApiError(e, "Error al guardar anticipo")
        } finally {
            setSaving(false)
        }
    }

    const selectedEmployee = form.watch("employee")
    const employeePayrolls = payrolls.filter(p => p.employee.toString() === selectedEmployee && p.status === 'DRAFT')

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={width}
            icon={WalletCards}
            title={advance ? "Ficha de Anticipo" : "Nuevo Anticipo"}
            subtitle={advance ? "Revise y modifique los datos del anticipo solicitado." : "Registre una entrega de dinero a cuenta de la próxima liquidación."}
            contentClassName="p-0"
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton type="submit" form="advance-form" loading={saving}>
                                {advance ? "Actualizar" : "Registrar"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            {advance ? (
                <FormSplitLayout>
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2 scrollbar-thin">
                        <Form {...form}>
                            <form id="advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-1">
                                <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Empleado"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={fieldState.error?.message}
                                        placeholder="Seleccionar empleado..."
                                        options={employees.map(e => ({
                                            value: e.id.toString(),
                                            label: e.contact_detail?.name || ""
                                        }))}
                                    />
                                )} />

                                <FormField control={form.control} name="amount" render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Monto ($)"
                                        required
                                        type="number"
                                        placeholder="0"
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )} />
                                <FormField control={form.control} name="date" render={({ field, fieldState }) => (
                                    <PeriodValidationDateInput
                                        label="Fecha Propuesta"
                                        required
                                        date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                        onDateChange={(d) => {
                                            if (!d) {
                                                field.onChange("")
                                                return
                                            }
                                            field.onChange(d.toISOString().split('T')[0])
                                        }}
                                        validationType="accounting"
                                    />
                                )} />

                                <FormField control={form.control} name="payroll" render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Vincular a Liquidación (Obligatorio)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={fieldState.error?.message}
                                        placeholder="Seleccionar liquidación..."
                                        options={employeePayrolls.map(p => ({
                                            value: p.id.toString(),
                                            label: `${p.display_id} – ${p.period_label} (${p.status_display})`
                                        }))}
                                    />
                                )} />

                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <LabeledInput
                                        as="textarea"
                                        label="Notas"
                                        rows={2}
                                        placeholder="Descripción opcional..."
                                        {...field}
                                    />
                                )} />
                            </form>
                        </Form>
                    </div>
                    <ActivitySidebar entityId={advance.id} entityType="salaryadvance" title="Historial" className="h-full border-none" />
                </FormSplitLayout>
            ) : (
                <div className="flex-1 flex overflow-hidden h-full">
                    {/* Left: Form */}
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2 scrollbar-thin">
                        <Form {...form}>
                            <form id="advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-1">
                                <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Empleado"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={fieldState.error?.message}
                                        placeholder="Seleccionar empleado..."
                                        options={employees.map(e => ({
                                            value: e.id.toString(),
                                            label: e.contact_detail?.name || ""
                                        }))}
                                    />
                                )} />

                                <FormField control={form.control} name="amount" render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Monto ($)"
                                        required
                                        type="number"
                                        placeholder="0"
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )} />
                                <FormField control={form.control} name="date" render={({ field, fieldState }) => (
                                    <PeriodValidationDateInput
                                        label="Fecha Propuesta"
                                        required
                                        date={field.value ? new Date(field.value + 'T12:00:00') : undefined}
                                        onDateChange={(d) => {
                                            if (!d) {
                                                field.onChange("")
                                                return
                                            }
                                            field.onChange(d.toISOString().split('T')[0])
                                        }}
                                        validationType="accounting"
                                    />
                                )} />

                                <FormField control={form.control} name="payroll" render={({ field, fieldState }) => (
                                    <LabeledSelect
                                        label="Vincular a Liquidación (Obligatorio)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={fieldState.error?.message}
                                        placeholder="Seleccionar liquidación..."
                                        options={employeePayrolls.map(p => ({
                                            value: p.id.toString(),
                                            label: `${p.display_id} – ${p.period_label} (${p.status_display})`
                                        }))}
                                    />
                                )} />

                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <LabeledInput
                                        as="textarea"
                                        label="Notas"
                                        rows={2}
                                        placeholder="Descripción opcional..."
                                        {...field}
                                    />
                                )} />
                            </form>
                        </Form>
                    </div>
                </div>
            )}
        </Drawer>
    )
}
