"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getEmployees, createEmployee, updateEmployee, getAFPs, getPayrollConcepts } from "@/lib/hr/api"
 import type { Employee, AFP, PayrollConcept, EmployeeConceptAmount } from "@/types/hr"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, UserCog, Search, Pencil, ShieldCheck, CalendarCheck2 } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

const employeeSchema = z.object({
    contact: z.string().min(1, "Contacto requerido"),
    position: z.string().optional(),
    department: z.string().optional(),
    start_date: z.string().optional(),
    base_salary: z.string().min(1, "Sueldo base requerido"),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    contract_type: z.enum(["INDEFINIDO", "PLAZO_FIJO"]),
    afp: z.string().nullable(),
    salud_type: z.enum(["FONASA", "ISAPRE"]),
    isapre_amount_uf: z.string(),
    jornada_type: z.enum(["ORDINARIA_22", "PARCIAL_40BIS", "EXENTA_22", "EXTRAORDINARIA_30"]),
    jornada_hours: z.string(),
    trabajo_pesado: z.boolean(),
    trabajo_agricola: z.boolean(),
    gratificacion: z.boolean(),
    dias_pactados: z.number().min(1).max(31),
    asignacion_familiar: z.enum(["A", "B", "C", "D"]),
    cargas_familiares: z.number().min(0),
})

type EmployeeFormValues = z.infer<typeof employeeSchema>

export default function EmployeesPage() {
    const router = useRouter()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

    const fetchEmployees = useCallback(async () => {
        try {
            const data = await getEmployees()
            setEmployees(data)
        } catch {
            toast.error("Error al cargar empleados")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchEmployees() }, [fetchEmployees])

    const columns: ColumnDef<Employee>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
            cell: ({ row }) => <DataCell.Code className="font-semibold">{row.getValue("display_id")}</DataCell.Code>,
        },
        {
            accessorFn: (row) => row.contact_detail?.name || "",
            id: "nombre",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col gap-0.5">
                        <div className="font-medium text-sm">{emp.contact_detail?.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{emp.contact_detail?.tax_id}</div>
                    </div>
                );
            },
        },
        {
            id: "prevision",
            header: "Previsión / Salud",
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col gap-1 items-start">
                        <Badge variant="outline" className="text-[9px]">
                            AFP: {emp.afp_detail?.name || 'No disp.'}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                            Salud: {emp.salud_type_display}
                        </Badge>
                    </div>
                );
            },
        },
        {
            accessorKey: "position",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cargo" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="text-sm">
                        <div>{emp.position || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{emp.department}</div>
                    </div>
                );
            },
        },
        {
            accessorKey: "base_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sueldo Base" />,
            cell: ({ row }) => (
                <div className="opacity-80 font-medium">
                    <MoneyDisplay amount={parseFloat((row.getValue("base_salary") as string) || "0")} />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <Badge
                        variant={emp.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className={cn(
                            "text-[10px] font-bold uppercase",
                            emp.status === 'ACTIVE' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        )}
                    >
                        {emp.status_display}
                    </Badge>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button
                    variant="ghost" size="icon"
                    onClick={() => { setEditingEmployee(row.original); setDialogOpen(true) }}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Personal"
                description="Gestión de empleados vinculados a contactos."
                titleActions={
                    <EmployeeDialog
                        open={dialogOpen}
                        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingEmployee(null) }}
                        employee={editingEmployee}
                        onSaved={() => { setDialogOpen(false); setEditingEmployee(null); fetchEmployees() }}
                        trigger={
                            <PageHeaderButton
                                onClick={() => { setEditingEmployee(null); setDialogOpen(true); }}
                                icon={Plus}
                                circular
                                title="Nuevo Empleado"
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
                    data={employees}
                    globalFilterFields={["display_id", "nombre", "position", "department"]}
                    searchPlaceholder="Buscar por nombre, RUT, o cargo..."
                    facetedFilters={[
                        {
                            column: "status",
                            title: "Estado",
                            options: [
                                { label: "Activo", value: "ACTIVE" },
                                { label: "Inactivo", value: "INACTIVE" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    defaultPageSize={20}
                />
            )}
        </div>
    )
}

interface EmployeeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employee: Employee | null
    onSaved: () => void
    trigger?: React.ReactNode
}

function EmployeeDialog({ open, onOpenChange, employee, onSaved, trigger }: EmployeeDialogProps) {
    const [saving, setSaving] = useState(false)
    const [afps, setAfps] = useState<AFP[]>([])

    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(employeeSchema),
        defaultValues: {
            contact: "",
            position: "",
            department: "",
            start_date: "",
            base_salary: "0",
            status: "ACTIVE",
            contract_type: "INDEFINIDO",
            afp: null,
            salud_type: "FONASA",
            isapre_amount_uf: "0",
            jornada_type: "ORDINARIA_22",
            jornada_hours: "44.0",
            trabajo_pesado: false,
            trabajo_agricola: false,
            gratificacion: true,
            dias_pactados: 30,
            asignacion_familiar: "D",
            cargas_familiares: 0,
            concept_amounts: {} as Record<number, string>,
         }
     })
 
     const [availableConcepts, setAvailableConcepts] = useState<PayrollConcept[]>([])
 
     useEffect(() => {
         if (open) {
             Promise.all([
                 getAFPs(),
                 getPayrollConcepts({ formula_type: 'EMPLOYEE_SPECIFIC' })
             ]).then(([afpsData, conceptsData]) => {
                 setAfps(afpsData)
                 setAvailableConcepts(conceptsData.filter((c: any) => c.formula_type === 'EMPLOYEE_SPECIFIC'))
             })
         }
     }, [open])

    useEffect(() => {
        if (employee) {
            form.reset({
                contact: String(employee.contact),
                position: employee.position,
                department: employee.department,
                start_date: employee.start_date || "",
                base_salary: employee.base_salary,
                status: employee.status,
                 contract_type: employee.contract_type,
                 afp: employee.afp?.toString() || null,
                 salud_type: employee.salud_type as "FONASA" | "ISAPRE",
                 isapre_amount_uf: employee.isapre_amount_uf,
                 jornada_type: (employee.jornada_type as any) || "ORDINARIA_22",
                 jornada_hours: String((employee as any).jornada_hours || "44.0"),
                 trabajo_pesado: (employee as any).trabajo_pesado || false,
                 trabajo_agricola: (employee as any).trabajo_agricola || false,
                 gratificacion: (employee as any).gratificacion ?? true,
                 dias_pactados: (employee as any).dias_pactados ?? 30,
                 asignacion_familiar: (employee as any).asignacion_familiar || "D",
                 cargas_familiares: (employee as any).cargas_familiares || 0,
                 concept_amounts: (employee.concept_amounts || []).reduce((acc, curr) => {
                     acc[curr.concept] = curr.amount
                     return acc
                 }, {} as Record<number, string>)
             })
         } else {
             form.reset({ 
                 contact: "", position: "", department: "", start_date: "", 
                 base_salary: "0", status: "ACTIVE", contract_type: "INDEFINIDO",
                 afp: null, salud_type: "FONASA", isapre_amount_uf: "0",
                 jornada_type: "ORDINARIA_22", jornada_hours: "44.0", trabajo_pesado: false,
                 trabajo_agricola: false, gratificacion: true, dias_pactados: 30,
                 asignacion_familiar: "D", cargas_familiares: 0,
                 concept_amounts: {}
             })
         }
     }, [employee, form, open])

     const onSubmit = async (data: any) => {
         setSaving(true)
         try {
             // Prepare concept_amounts for backend (list of objects)
             const conceptAmountsList = Object.entries(data.concept_amounts || {}).map(([conceptId, amount]) => ({
                 concept: parseInt(conceptId),
                 amount: amount
             })).filter(ca => ca.amount !== "" && ca.amount !== null)
 
             const payload = { 
                 ...data, 
                 contact: parseInt(data.contact),
                 afp: data.afp ? parseInt(data.afp) : null,
                 concept_amounts: conceptAmountsList
             }
             if (employee) {
                 await updateEmployee(employee.id, payload as any)
                 toast.success("Empleado actualizado")
             } else {
                 await createEmployee(payload as any)
                 toast.success("Empleado creado")
             }
             onSaved()
         } catch (e: any) {
             console.error(e)
             toast.error(e?.response?.data?.detail || "Error al guardar empleado")
         } finally {
             setSaving(false)
         }
     }

    const watchSalud = form.watch("salud_type")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{employee ? "Editar Ficha de Empleado" : "Nueva Ficha de Empleado"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-3 gap-6">
                            {/* Columna Izquierda: Datos Laborales */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold uppercase text-primary/70 flex items-center gap-2">
                                    <UserCog className="h-3 w-3" /> Datos Contractuales
                                </h4>
                                <FormField
                                    control={form.control} name="contact"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contacto</FormLabel>
                                            <FormControl>
                                                <AdvancedContactSelector
                                                    value={field.value || null}
                                                    onChange={(val) => field.onChange(val || "")}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="position" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cargo</FormLabel>
                                            <FormControl><Input {...field} placeholder="Ej: Vendedor" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="department" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Depto.</FormLabel>
                                            <FormControl><Input {...field} placeholder="Ventas" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="base_salary" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sueldo Base ($)</FormLabel>
                                        <FormControl><Input {...field} type="number" min="0" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="contract_type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Contrato</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                                                <SelectItem value="PLAZO_FIJO">Plazo Fijo / Obra</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="start_date" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha Ingreso</FormLabel>
                                        <FormControl><Input {...field} type="date" /></FormControl>
                                    </FormItem>
                                )} />
                            </div>
                            
                            {/* Columna Centro: Jornada */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold uppercase text-primary/70 flex items-center gap-2">
                                    <CalendarCheck2 className="h-3 w-3" /> Jornada y Atributos
                                </h4>
                                <FormField control={form.control} name="jornada_type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Jornada</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="ORDINARIA_22">Ordinaria Art. 22</SelectItem>
                                                <SelectItem value="PARCIAL_40BIS">Parcial Art 40 BIS</SelectItem>
                                                <SelectItem value="EXENTA_22">Exenta Art. 22</SelectItem>
                                                <SelectItem value="EXTRAORDINARIA_30">Extraordinaria Art. 30</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <FormField control={form.control} name="dias_pactados" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Días Pactados</FormLabel>
                                            <FormControl><Input {...field} type="number" min="1" max="31" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="jornada_hours" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Horas / Sem</FormLabel>
                                            <FormControl><Input {...field} type="number" step="0.5" /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="space-y-2 pt-2">
                                    <FormField control={form.control} name="gratificacion" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-md border px-3 py-2 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-xs">Gratificación Legal</FormLabel>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="trabajo_pesado" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-md border px-3 py-2 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-xs">Trabajo Pesado</FormLabel>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="trabajo_agricola" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-md border px-3 py-2 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-xs">Trabajo Agrícola</FormLabel>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            {/* Columna Derecha: Previsión */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold uppercase text-primary/70 flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3" /> Previsión y Salud (Chile)
                                </h4>
                                <FormField control={form.control} name="afp" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>AFP</FormLabel>
                                        <Select value={field.value || ""} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione AFP" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {afps.map(afp => (
                                                    <SelectItem key={afp.id} value={afp.id.toString()}>
                                                        {afp.name} ({afp.percentage}%)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <Separator />

                                <FormField control={form.control} name="salud_type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sistema de Salud</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="FONASA">Fonasa (7%)</SelectItem>
                                                <SelectItem value="ISAPRE">Isapre (Pactado)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />

                                {watchSalud === "ISAPRE" && (
                                    <FormField control={form.control} name="isapre_amount_uf" render={({ field }) => (
                                        <FormItem className="animate-in slide-in-from-top-2 duration-300">
                                            <FormLabel>Monto Pactado UF</FormLabel>
                                            <FormControl><Input {...field} type="number" step="0.0001" /></FormControl>
                                            <p className="text-[10px] text-muted-foreground italic">Se descontará el mayor entre el 7% y este monto.</p>
                                        </FormItem>
                                    )} />
                                )}

                                <Separator />
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <FormField control={form.control} name="asignacion_familiar" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Asignación Fam.</FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="A">Tramo A</SelectItem>
                                                    <SelectItem value="B">Tramo B</SelectItem>
                                                    <SelectItem value="C">Tramo C</SelectItem>
                                                    <SelectItem value="D">Tramo D</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="cargas_familiares" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cargas</FormLabel>
                                            <FormControl><Input {...field} type="number" min="0" onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                 <FormField control={form.control} name="status" render={({ field }) => (
                                     <FormItem>
                                         <FormLabel>Estado Ficha</FormLabel>
                                         <Select value={field.value} onValueChange={field.onChange}>
                                             <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                             <SelectContent>
                                                 <SelectItem value="ACTIVE">Activo</SelectItem>
                                                 <SelectItem value="INACTIVE">Inactivo</SelectItem>
                                             </SelectContent>
                                         </Select>
                                     </FormItem>
                                 )} />
                             </div>
                         </div>
 
                         {/* Sección: Haberes y Descuentos Específicos */}
                         {availableConcepts.length > 0 && (
                             <div className="space-y-4 pt-4 border-t">
                                 <h4 className="text-[10px] font-bold uppercase text-primary/70 flex items-center gap-2">
                                     <Plus className="h-3 w-3" /> Haberes y Descuentos Específicos (Pactados)
                                 </h4>
                                 <div className="grid grid-cols-2 gap-4">
                                     {availableConcepts.map(concept => (
                                         <FormItem key={concept.id}>
                                             <FormLabel className="text-xs">{concept.name}</FormLabel>
                                             <FormControl>
                                                 <Input 
                                                     type="number" 
                                                     step="1" 
                                                     placeholder="0"
                                                     className="h-8 text-sm"
                                                     value={(form.watch(`concept_amounts.${concept.id}` as any) as any) || ""}
                                                     onChange={(e) => {
                                                         form.setValue(`concept_amounts.${concept.id}` as any, e.target.value as any, { shouldDirty: true })
                                                     }}
                                                 />
                                             </FormControl>
                                         </FormItem>
                                     ))}
                                 </div>
                             </div>
                         )}

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {employee ? "Guardar Cambios" : "Contratar / Crear"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
