"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { updateAdvance } from '@/features/hr/api/hrApi'
import type { SalaryAdvance, Employee, Payroll } from "@/types/hr"
import { BaseModal } from "@/components/shared/BaseModal"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { Button } from "@/components/ui/button"
import { CancelButton, SubmitButton } from "@/components/shared/ActionButtons"
import { Form, FormField } from "@/components/ui/form"
import { LabeledInput, LabeledSelect } from "@/components/shared"
import {
    WalletCards, History
} from "lucide-react"
import { FORM_STYLES } from "@/lib/styles"

export const advanceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    amount: z.string().min(1).refine(v => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    date: z.string().min(1, "Fecha requerida"),
    payroll: z.string().min(1, "Vincular a una liquidación es obligatorio"),
    notes: z.string().optional(),
})

export type AdvanceFormValues = z.infer<typeof advanceSchema>

export interface AdvanceFormModalProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    advance: SalaryAdvance | null
    employees: Employee[]
    payrolls: Payroll[]
    onSaved: (data?: Record<string, unknown>) => void
}

export function AdvanceFormModal({ open, onOpenChange, advance, employees, payrolls, onSaved }: AdvanceFormModalProps) {
    const [saving, setSaving] = useState(false)

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
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={advance ? "xl" : "md"}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <WalletCards className="h-5 w-5 text-primary" />
                    </div>
                    <span>{advance ? "Ficha de Anticipo" : "Nuevo Anticipo"}</span>
                </div>
            }
            description={advance ? "Revise y modifique los datos del anticipo solicitado." : "Registre una entrega de dinero a cuenta de la próxima liquidación."}
            hideScrollArea={true}
            className="h-[80vh]"
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <SubmitButton form="advance-form" loading={saving}>
                        {advance ? "Actualizar" : "Registrar"}
                    </SubmitButton>
                </div>
            }
        >
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

                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="amount" render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormControl>
                                            <LabeledInput
                                                label="Monto ($)"
                                                required
                                                type="number"
                                                placeholder="0"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="date" render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormControl>
                                            <LabeledInput
                                                label="Fecha Propuesta"
                                                required
                                                type="date"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </div>

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
                                <FormItem>
                                    <FormControl>
                                        <LabeledInput
                                            as="textarea"
                                            label="Notas"
                                            rows={2}
                                            placeholder="Descripción opcional..."
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )} />
                        </form>
                    </Form>
                </div>

                {/* Right: Activity Sidebar */}
                {advance?.id && (
                    <div className="w-72 border-l bg-muted/5 flex flex-col pt-0 hidden lg:flex">
                        <ActivitySidebar
                            entityId={advance.id}
                            entityType="salaryadvance"
                            title="Historial"
                            className="h-full border-none"
                        />
                    </div>
                )}
                {!advance?.id && (
                    <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
                            <History className="h-8 w-8 opacity-20" />
                            <p className="text-xs">El historial estará disponible una vez registrado el anticipo.</p>
                        </div>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
