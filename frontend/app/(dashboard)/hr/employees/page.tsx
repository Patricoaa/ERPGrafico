"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getEmployees, createEmployee, updateEmployee, getAFPs, getPayrollConcepts } from "@/lib/hr/api"
 import type { Employee, AFP, PayrollConcept, EmployeeConceptAmount } from "@/types/hr"
import { PageHeader } from "@/components/shared/PageHeader"
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
import { Loader2, Plus, UserCog, Search, Pencil, ShieldCheck } from "lucide-react"
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

    const filtered = employees.filter(e =>
        e.contact_detail?.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.contact_detail?.tax_id?.includes(search) ||
        e.position?.toLowerCase().includes(search.toLowerCase()) ||
        e.department?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PageHeader title="Personal" description="Gestión de empleados vinculados a contactos.">
                <EmployeeDialog
                    open={dialogOpen}
                    onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingEmployee(null) }}
                    employee={editingEmployee}
                    onSaved={() => { setDialogOpen(false); setEditingEmployee(null); fetchEmployees() }}
                    trigger={
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" /> Nuevo Empleado
                        </Button>
                    }
                />
            </PageHeader>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, RUT, cargo..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>
                <Badge variant="secondary" className="font-mono">{filtered.length} empleados</Badge>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                            <UserCog className="h-10 w-10 opacity-20" />
                            <p className="text-sm font-medium">No hay empleados registrados</p>
                            <p className="text-xs opacity-60">Crea el primer empleado con el botón superior</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Código</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Previsión / Salud</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead className="text-right">Sueldo Base</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="w-[80px]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(emp => (
                                    <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell className="font-mono text-xs text-muted-foreground">{emp.display_id}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{emp.contact_detail?.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">{emp.contact_detail?.tax_id}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="outline" className="text-[9px] w-fit">
                                                    AFP: {emp.afp_detail?.name || 'No disp.'}
                                                </Badge>
                                                <Badge variant="outline" className="text-[9px] w-fit">
                                                    Salud: {emp.salud_type_display}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <div>{emp.position || '—'}</div>
                                            <div className="text-[10px] text-muted-foreground">{emp.department}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <MoneyDisplay amount={parseFloat(emp.base_salary)} />
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={emp.status === 'ACTIVE' ? 'default' : 'secondary'}
                                                className={cn(
                                                    "text-[10px] font-bold uppercase",
                                                    emp.status === 'ACTIVE' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                                )}
                                            >
                                                {emp.status_display}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost" size="icon"
                                                onClick={() => { setEditingEmployee(emp); setDialogOpen(true) }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
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
                 setAvailableConcepts(conceptsData)
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
                 salud_type: employee.salud_type,
                 isapre_amount_uf: employee.isapre_amount_uf,
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
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>{employee ? "Editar Ficha de Empleado" : "Nueva Ficha de Empleado"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-6">
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
