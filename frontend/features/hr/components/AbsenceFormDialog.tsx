"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createAbsence, updateAbsence } from "@/lib/hr/api"
import type { Absence, Employee } from "@/types/hr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CalendarX2 } from "lucide-react"
import { FORM_STYLES } from "@/lib/styles"
import { EmptyState } from "@/components/shared/EmptyState"

export const absenceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    absence_type: z.enum(["AUSENTISMO", "LICENCIA", "PERMISO_SIN_GOCE", "AUSENCIA_HORAS"]),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().min(1, "Fecha de fin requerida"),
    days: z.number().min(0.5, "Los días deben ser mayores a 0"),
    notes: z.string().optional(),
})

export type AbsenceFormValues = z.infer<typeof absenceSchema>

export interface AbsenceFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    absence: Absence | null
    employees: Employee[]
    onSaved: () => void
    trigger?: React.ReactNode
}

export function AbsenceFormDialog({ open, onOpenChange, absence, employees, onSaved, trigger }: AbsenceFormDialogProps) {
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-md">
                                <CalendarX2 className="h-5 w-5 text-primary" />
                            </div>
                            <span>{absence ? "Editar Inasistencia" : "Registrar Inasistencia"}</span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Form */}
                    <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2 scrollbar-thin">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-1">
                                <FormField control={form.control} name="employee" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Empleado</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger className={FORM_STYLES.input}>
                                                    <SelectValue placeholder="Seleccione empleado" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {employees.map(e => (
                                                    <SelectItem key={e.id} value={e.id.toString()}>
                                                        {e.contact_detail?.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="absence_type" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Tipo de Inasistencia</FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger className={FORM_STYLES.input}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="AUSENTISMO">Ausentismo Injustificado</SelectItem>
                                                    <SelectItem value="LICENCIA">Licencia Médica</SelectItem>
                                                    <SelectItem value="PERMISO_SIN_GOCE">Permiso sin Goce de Sueldo</SelectItem>
                                                    <SelectItem value="AUSENCIA_HORAS">Ausencia de Horas</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="days" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Días Totales</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    {...field} 
                                                    type="number" 
                                                    step="0.5" 
                                                    min="0" 
                                                    className={FORM_STYLES.input}
                                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                                                />
                                            </FormControl>
                                            <p className="text-[10px] text-muted-foreground italic">Para ausencia de horas, calcule su equivalente en días (ej. 0.5).</p>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="start_date" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Fecha Inicio</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="date" className={FORM_STYLES.input} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="end_date" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Fecha Fin</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="date" className={FORM_STYLES.input} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Notas Adicionales</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Opcional..." className={FORM_STYLES.input} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </form>
                        </Form>
                    </div>

                    {/* Right: Activity Sidebar (Placeholder or actual if available) */}
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

                <div className="p-6 border-t flex justify-end gap-2 bg-muted/10">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={saving} onClick={form.handleSubmit(onSubmit)}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {absence ? "Actualizar" : "Registrar"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
