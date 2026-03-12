"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getAbsences, createAbsence, updateAbsence, deleteAbsence, getEmployees } from "@/lib/hr/api"
import type { Absence, Employee } from "@/types/hr"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, CalendarX2, Search, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"

const absenceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    absence_type: z.enum(["AUSENTISMO", "LICENCIA", "PERMISO_SIN_GOCE", "AUSENCIA_HORAS"]),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().min(1, "Fecha de fin requerida"),
    days: z.number().min(0.5, "Los días deben ser mayores a 0"),
    notes: z.string().optional(),
})

type AbsenceFormValues = z.infer<typeof absenceSchema>

export default function AbsencesPage() {
    const [absences, setAbsences] = useState<Absence[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null)

    const fetchAbsences = useCallback(async () => {
        try {
            const data = await getAbsences()
            setAbsences(data)
        } catch {
            toast.error("Error al cargar inasistencias")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAbsences() }, [fetchAbsences])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar esta inasistencia?")) return
        try {
            await deleteAbsence(id)
            toast.success("Inasistencia eliminada")
            fetchAbsences()
        } catch {
            toast.error("Error al eliminar inasistencia")
        }
    }

    const columns: ColumnDef<Absence>[] = [
        {
            accessorKey: "employee_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" />,
            cell: ({ row }) => <div className="font-medium text-sm">{row.getValue("employee_name")}</div>,
        },
        {
            accessorKey: "absence_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => <Badge variant="outline" className="text-[10px]">{row.getValue("absence_type_display")}</Badge>,
        },
        {
            accessorKey: "start_date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Inicio" />,
            cell: ({ row }) => <div className="text-sm">{row.getValue("start_date")}</div>,
        },
        {
            accessorKey: "end_date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fin" />,
            cell: ({ row }) => <div className="text-sm">{row.getValue("end_date")}</div>,
        },
        {
            accessorKey: "days",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Días" />,
            cell: ({ row }) => <div className="text-right font-mono text-sm">{row.getValue("days")}</div>,
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => { setEditingAbsence(row.original); setDialogOpen(true) }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Inasistencias"
                description="Registro de ausentismos, licencias y permisos."
                titleActions={
                    <AbsenceDialog
                        open={dialogOpen}
                        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingAbsence(null) }}
                        absence={editingAbsence}
                        onSaved={() => { setDialogOpen(false); setEditingAbsence(null); fetchAbsences() }}
                        trigger={
                            <PageHeaderButton
                                onClick={() => { setEditingAbsence(null); setDialogOpen(true); }}
                                icon={Plus}
                                circular
                                title="Registrar Inasistencia"
                            />
                        }
                    />
                }
            />

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={absences}
                    globalFilterFields={["employee_name", "absence_type_display"]}
                    searchPlaceholder="Buscar por empleado o tipo..."
                    facetedFilters={[
                        {
                            column: "absence_type_display",
                            title: "Tipo",
                            options: [
                                { label: "Ausentismo", value: "Ausentismo Injustificado" },
                                { label: "Licencia", value: "Licencia Médica" },
                                { label: "Permiso Sin Goce", value: "Permiso sin Goce de Sueldo" },
                                { label: "Ausencia de Horas", value: "Ausencia de Horas" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    defaultPageSize={20}
                    onRowClick={(row: Absence) => { setEditingAbsence(row); setDialogOpen(true) }}
                />
            )}
        </div>
    )
}

function AbsenceDialog({ open, onOpenChange, absence, onSaved, trigger }: {
    open: boolean, 
    onOpenChange: (open: boolean) => void, 
    absence: Absence | null, 
    onSaved: () => void, 
    trigger?: React.ReactNode 
}) {
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])

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
        if (open) {
            getEmployees().then(setEmployees).catch(e => console.error(e))
        }
    }, [open])

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
                await updateAbsence(absence.id, payload as any)
                toast.success("Inasistencia actualizada")
            } else {
                await createAbsence(payload as any)
                toast.success("Inasistencia registrada")
            }
            onSaved()
        } catch (e: any) {
            console.error(e)
            toast.error(e?.response?.data?.detail || "Error al guardar inasistencia")
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
                            <div className="p-2 bg-primary/10 rounded-lg">
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
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
                                <Plus className="h-8 w-8 opacity-20" />
                                <p className="text-xs">El historial estará disponible una vez registrada la inasistencia.</p>
                            </div>
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
