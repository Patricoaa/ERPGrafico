"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createPayroll, getEmployees } from "@/lib/hr/api"
import type { Employee } from "@/types/hr"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Loader2, Plus, FileText } from "lucide-react"
import { FORM_STYLES } from "@/lib/styles"

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

export interface CreatePayrollDialogProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    onSaved: (id: number) => void
    trigger?: React.ReactNode
}

export function CreatePayrollDialog({ open, onOpenChange, onSaved, trigger }: CreatePayrollDialogProps) {
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])

    useEffect(() => {
        if (open) {
            getEmployees({ status: 'ACTIVE' }).then(setEmployees).catch((e) => showApiError(e, "Error al cargar empleados"))
        }
    }, [open])

    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

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

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Plus className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-lg font-bold tracking-tight">Nueva Liquidación</span>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                            RRHH <span className="opacity-30">|</span> Emisión Mensual
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="rounded-sm text-xs font-bold border-primary/20 hover:bg-primary/5"
                    >
                        Cancelar
                    </Button>
                    <Button
                        form="create-payroll-form"
                        type="submit"
                        disabled={saving}
                        className="rounded-sm text-xs font-bold transition-all shadow-lg shadow-primary/20"
                    >
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <FileText className="mr-2 h-3.5 w-3.5" />
                        Crear Liquidación
                    </Button>
                </div>
            }
        >
            <Form {...form}>
                <form
                    id="create-payroll-form"
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4 py-2 text-left"
                >
                    <FormField control={form.control} name="employee" render={({ field }) => (
                        <FormItem>
                            <FormLabel className={FORM_STYLES.label}>Empleado</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                    <SelectTrigger className={FORM_STYLES.input}>
                                        <SelectValue placeholder="Seleccionar empleado..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={String(e.id)}>
                                            {e.contact_detail?.name} — {e.contact_detail?.tax_id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="period_year" render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Año</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                        <SelectTrigger className={FORM_STYLES.input}>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="period_month" render={({ field }) => (
                            <FormItem>
                                <FormLabel className={FORM_STYLES.label}>Mes</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                        <SelectTrigger className={FORM_STYLES.input}>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {MONTHS.map(m => (
                                            <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="text-[10px]" />
                            </FormItem>
                        )} />
                    </div>

                    <FormField control={form.control} name="notes" render={({ field }) => (
                        <FormItem>
                            <FormLabel className={FORM_STYLES.label}>Notas (Opcional)</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    className={FORM_STYLES.input}
                                    placeholder="Información adicional..."
                                />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                </form>
            </Form>
        </BaseModal>
    )
}
