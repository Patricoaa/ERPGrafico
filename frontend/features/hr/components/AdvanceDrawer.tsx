"use client"

import {useEffect} from "react"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAdvanceMutations } from '../hooks/useAdvanceMutations'
import { useEmployees } from '@/features/hr/hooks/useEmployees'
import { usePayrolls } from '@/features/hr/hooks/usePayrolls'
import type { SalaryAdvance, Employee, Payroll } from "@/types/hr"
import { ActivitySidebar } from "@/features/audit"
import { CancelButton, ActionSlideButton } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { Drawer, LabeledInput, LabeledSelect, PeriodValidationDateInput, FormFooter, FormSplitLayout } from "@/components/shared"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { useServerDate } from "@/hooks/useServerDate"
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
    mode?: DrawerMode
}

export function AdvanceDrawer({ open, onOpenChange, advance, employees: employeesProp, payrolls: payrollsProp, onSaved, mode: modeProp }: AdvanceDrawerProps) {
    const { employees: fetchedEmployees } = useEmployees()
    const { payrolls: fetchedPayrolls } = usePayrolls()
    const employees = employeesProp ?? fetchedEmployees
    const payrolls = payrollsProp ?? fetchedPayrolls
    const mode: DrawerMode = modeProp ?? (advance ? 'edit' : 'create')
    const isView = mode === 'view'
    const { printRef, handlePrint } = usePrintableDrawer()
    const { saveAdvance, isSaving: saving } = useAdvanceMutations()
    const { dateString } = useServerDate()

    const width = formDrawerWidth("medium", !!advance)

    const form = useForm<AdvanceFormValues>({
        resolver: zodResolver(advanceSchema),
        defaultValues: {
            employee: "",
            amount: "",
            date: dateString,
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
                date: dateString,
                payroll: "",
                notes: "",
            })
        }
    }, [advance, open, form])

    const onSubmit = async (data: AdvanceFormValues) => {
        try {
            const payload = {
                employee: parseInt(data.employee),
                amount: data.amount,
                date: data.date,
                payroll: parseInt(data.payroll),
                notes: data.notes || "",
            }
            if (advance) {
                await saveAdvance({ id: advance.id, payload })
                onSaved()
            } else {
                // For NEW advances, we just pass the data to the next step (PaymentDialog)
                onSaved(payload)
            }
        } catch (e: unknown) {
            showApiError(e, "Error al guardar anticipo")
        }
    }

    const selectedEmployee = form.watch("employee")
    const employeePayrolls = payrolls.filter(p => p.employee.toString() === selectedEmployee && p.status === 'DRAFT')

    const identity = useDrawerIdentity('hr.salaryadvance', mode, advance, {
        overrideSubtitle: advance ? "Revise y modifique los datos del anticipo solicitado." : "Registre una entrega de dinero a cuenta de la próxima liquidación.",
        printable: (mode === 'view' || mode === 'edit') && !!advance?.id,
        onPrint: handlePrint,
    })

    return (
        <>
            {(mode === 'view' || mode === 'edit') && advance?.id && (
                <PrintableLayout ref={printRef} title="Anticipo" displayId={`#${advance.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Empleado:</span>
                            <span>{advance?.employee_name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                fillContent
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={width}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                mode={mode}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <ActionSlideButton type="submit" form="advance-form" loading={saving}>
                                    {mode === 'create' ? "Registrar" : "Actualizar"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                {advance ? (
                    <FormSplitLayout
                        showSidebar={true}
                        sidebar={<ActivitySidebar entityId={advance.id} entityType="salaryadvance" title="Historial" />}
                    >
                        <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2 scrollbar-thin">
                            <Form {...form}>
                                <form id="advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                                    <fieldset disabled={isView} className="contents">
                                        <div className="space-y-6">
                                            <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Empleado"
                                                    required
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
                                            <FormField control={form.control} name="date" render={({ field }) => (
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
                                                    label="Vincular a Liquidación"
                                                    required
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
                                        </div>
                                    </fieldset>

                                </form>
                            </Form>
                        </div>
                    </FormSplitLayout>
                ) : (
                    <FormSplitLayout>
                        <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2 scrollbar-thin">
                            <Form {...form}>
                                <form id="advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                                    <fieldset disabled={isView} className="contents">
                                        <div className="space-y-6">
                                            <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Empleado"
                                                    required
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
                                            <FormField control={form.control} name="date" render={({ field }) => (
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
                                                    label="Vincular a Liquidación"
                                                    required
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
