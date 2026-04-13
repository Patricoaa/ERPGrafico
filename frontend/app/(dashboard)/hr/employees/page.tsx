"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { getEmployees, createEmployee, updateEmployee, getAFPs, getPayrollConcepts } from "@/lib/hr/api"
import type { Employee, AFP, PayrollConcept, EmployeeConceptAmount } from "@/types/hr"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
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
import {
    Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { FORM_STYLES } from "@/lib/styles"
import {
    Loader2, Plus, UserCog, Search, Pencil, ShieldCheck,
    CalendarCheck2, LayoutDashboard, Filter, Download, ArrowRight,
    Users2
} from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"

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
    concept_amounts: z.record(z.string(), z.string()).optional(),
})

type EmployeeFormValues = z.infer<typeof employeeSchema>

export default function EmployeesPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    
    // Dialog state synchronized with URL or local edit
    const isNewModalOpen = searchParams.get("modal") === "new"
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
    const dialogOpen = isNewModalOpen || !!editingEmployee

    const setDialogOpen = (open: boolean) => {
        if (!open) {
            setEditingEmployee(null)
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`, { scroll: false })
            }
        }
    }

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
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Code className="font-semibold">{row.getValue("display_id")}</DataCell.Code></div>,
        },
        {
            accessorFn: (row) => row.contact_detail?.name || "",
            id: "nombre",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col items-center justify-center w-full">
                        <DataCell.Text className="font-bold">{emp.contact_detail?.name}</DataCell.Text>
                        <DataCell.Secondary>{emp.contact_detail?.tax_id}</DataCell.Secondary>
                    </div>
                );
            },
        },
        {
            id: "prevision",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Previsión / Salud" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col gap-1 items-center justify-center w-full">
                        <DataCell.Secondary className="text-[9px] uppercase font-bold">
                            AFP: {emp.afp_detail?.name || 'No disp.'}
                        </DataCell.Secondary>
                        <DataCell.Secondary className="text-[9px] uppercase font-bold">
                            Salud: {emp.salud_type_display}
                        </DataCell.Secondary>
                    </div>
                );
            },
        },
        {
            accessorKey: "position",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cargo" className="justify-center" />,
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex flex-col items-center justify-center w-full">
                        <DataCell.Text>{emp.position || '—'}</DataCell.Text>
                        <DataCell.Secondary>{emp.department}</DataCell.Secondary>
                    </div>
                );
            },
        },
        {
            accessorKey: "base_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sueldo Base" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.getValue("base_salary") as string) || "0")} />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.getValue("status") as string} label={row.original.status_display} />
                </div>
            ),
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Acciones" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={() => { setEditingEmployee(row.original); setDialogOpen(true) }}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            {loading ? (
                <TableSkeleton columns={6} rows={10} />
            ) : (
                <DataTable
                    columns={columns}
                    data={employees}
                    cardMode
                    globalFilterFields={["name", "identity_document", "code", "position", "department"]}
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
            concept_amounts: {},
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
                position: employee.position || "",
                department: employee.department || "",
                start_date: (employee.start_date || "").split("T")[0] || "",
                base_salary: String(employee.base_salary),
                status: employee.status,
                contract_type: employee.contract_type,
                afp: employee.afp ? String(employee.afp) : null,
                salud_type: employee.salud_type,
                isapre_amount_uf: String(employee.isapre_amount_uf || "0"),
                jornada_type: (employee.jornada_type as any) || "ORDINARIA_22",
                jornada_hours: String(employee.jornada_hours || "44.0"),
                trabajo_pesado: !!employee.trabajo_pesado,
                trabajo_agricola: !!employee.trabajo_agricola,
                gratificacion: !!employee.gratificacion,
                dias_pactados: employee.dias_pactados || 30,
                asignacion_familiar: (employee.asignacion_familiar as any) || "D",
                cargas_familiares: employee.cargas_familiares || 0,
                concept_amounts: (employee.concept_amounts || []).reduce((acc: any, curr: any) => {
                    acc[String(curr.concept)] = String(curr.amount)
                    return acc
                }, {}) || {},
            })
        } else {
            form.reset({
                contact: "",
                position: "",
                department: "",
                start_date: new Date().toISOString().split("T")[0],
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
                concept_amounts: {},
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
            <DialogContent className={cn("max-w-6xl p-0 overflow-hidden border-none transition-all duration-300", employee && "max-w-[95vw] 2xl:max-w-[85vw]")}>
                <div className="flex h-[85vh] overflow-hidden">
                    <div className="flex-1 flex flex-col overflow-hidden bg-background">
                        <div className="px-8 py-5 border-b bg-muted/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <UserCog className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-bold tracking-tight">
                                        {employee ? "Editar Ficha de Empleado" : "Nueva Ficha de Empleado"}
                                    </DialogTitle>
                                    {employee && (
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                                            {employee.display_id} • {employee.contact_detail?.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
                                    <Tabs defaultValue="contratacion" className="flex-1 flex flex-col overflow-hidden">
                                        <div className="px-8 border-b bg-muted/5">
                                            <TabsList className="h-12 bg-transparent gap-8 p-0">
                                                <TabsTrigger value="contratacion" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 text-xs font-bold uppercase tracking-wider transition-all">
                                                    Contratación
                                                </TabsTrigger>
                                                <TabsTrigger value="jornada" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 text-xs font-bold uppercase tracking-wider transition-all">
                                                    Jornada y Previsión
                                                </TabsTrigger>
                                                <TabsTrigger value="haberes" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 text-xs font-bold uppercase tracking-wider transition-all">
                                                    Haberes Específicos
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>

                                        <div className="flex-1 min-h-0">
                                            <TabsContent value="contratacion" className="h-full m-0 p-8 lg:p-10 overflow-y-auto scrollbar-thin animate-in fade-in-50 duration-300">
                                                <div className="max-w-4xl mx-auto space-y-10">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-px bg-border/60" />
                                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2 px-3">
                                                            <UserCog className="h-3.5 w-3.5" />
                                                            Datos de Contrato
                                                        </span>
                                                        <div className="flex-1 h-px bg-border/60" />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                                        <FormField
                                                            control={form.control} name="contact"
                                                            render={({ field }) => (
                                                                <FormItem className="col-span-full">
                                                                    <FormLabel className={FORM_STYLES.label}>Contacto</FormLabel>
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
                                                        <FormField control={form.control} name="position" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className={FORM_STYLES.label}>Cargo</FormLabel>
                                                                <FormControl><Input {...field} placeholder="Ej: Vendedor" className={FORM_STYLES.input} /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={form.control} name="department" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className={FORM_STYLES.label}>Departamento</FormLabel>
                                                                <FormControl><Input {...field} placeholder="Ventas" className={FORM_STYLES.input} /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={form.control} name="base_salary" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className={FORM_STYLES.label}>Sueldo Base ($)</FormLabel>
                                                                <FormControl><Input {...field} type="number" min="0" className={FORM_STYLES.input} /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={form.control} name="contract_type" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className={FORM_STYLES.label}>Tipo de Contrato</FormLabel>
                                                                <Select value={field.value} onValueChange={field.onChange}>
                                                                    <FormControl>
                                                                        <SelectTrigger className={FORM_STYLES.input}>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                                                                        <SelectItem value="PLAZO_FIJO">Plazo Fijo / Obra</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={form.control} name="start_date" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className={FORM_STYLES.label}>Fecha Ingreso</FormLabel>
                                                                <FormControl><Input {...field} type="date" className={FORM_STYLES.input} /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={form.control} name="status" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className={FORM_STYLES.label}>Estado Ficha</FormLabel>
                                                                <Select value={field.value} onValueChange={field.onChange}>
                                                                    <FormControl>
                                                                        <SelectTrigger className={FORM_STYLES.input}>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="ACTIVE">Activo</SelectItem>
                                                                        <SelectItem value="INACTIVE">Inactivo</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="jornada" className="h-full m-0 p-8 lg:p-10 overflow-y-auto scrollbar-thin animate-in fade-in-50 duration-300">
                                                <div className="max-w-6xl mx-auto space-y-16">
                                                    {/* Sección 1: Detalles Jornada */}
                                                    <div className="space-y-10">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-px bg-border/60" />
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2 px-3">
                                                                <CalendarCheck2 className="h-3.5 w-3.5" />
                                                                Detalles Jornada
                                                            </span>
                                                            <div className="flex-1 h-px bg-border/60" />
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-10">
                                                            <FormField control={form.control} name="jornada_type" render={({ field }) => (
                                                                <FormItem className="md:col-span-2">
                                                                    <FormLabel className={FORM_STYLES.label}>Tipo de Jornada</FormLabel>
                                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                                        <FormControl>
                                                                            <SelectTrigger className={FORM_STYLES.input}>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="ORDINARIA_22">Ordinaria Art. 22</SelectItem>
                                                                            <SelectItem value="PARCIAL_40BIS">Parcial Art 40 BIS</SelectItem>
                                                                            <SelectItem value="EXENTA_22">Exenta Art. 22</SelectItem>
                                                                            <SelectItem value="EXTRAORDINARIA_30">Extraordinaria Art. 30</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )} />

                                                            <FormField control={form.control} name="dias_pactados" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className={FORM_STYLES.label}>Días Pactados</FormLabel>
                                                                    <FormControl><Input {...field} type="number" min="1" max="31" className={FORM_STYLES.input} onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                                                                </FormItem>
                                                            )} />

                                                            <FormField control={form.control} name="jornada_hours" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className={FORM_STYLES.label}>Horas / Sem</FormLabel>
                                                                    <FormControl><Input {...field} type="number" step="0.5" className={FORM_STYLES.input} /></FormControl>
                                                                </FormItem>
                                                            )} />

                                                            {/* Switches en fila horizontal */}
                                                            <div className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                                                                <FormField control={form.control} name="gratificacion" render={({ field }) => (
                                                                    <FormItem className="flex flex-row items-center justify-between rounded-xl bg-muted/5 p-4 border border-transparent hover:border-primary/10 transition-all">
                                                                        <div className="space-y-0.5">
                                                                            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gratificación Legal</FormLabel>
                                                                        </div>
                                                                        <FormControl>
                                                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )} />
                                                                <FormField control={form.control} name="trabajo_pesado" render={({ field }) => (
                                                                    <FormItem className="flex flex-row items-center justify-between rounded-xl bg-muted/5 p-4 border border-transparent hover:border-primary/10 transition-all">
                                                                        <div className="space-y-0.5">
                                                                            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Trabajo Pesado</FormLabel>
                                                                        </div>
                                                                        <FormControl>
                                                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )} />
                                                                <FormField control={form.control} name="trabajo_agricola" render={({ field }) => (
                                                                    <FormItem className="flex flex-row items-center justify-between rounded-xl bg-muted/5 p-4 border border-transparent hover:border-primary/10 transition-all">
                                                                        <div className="space-y-0.5">
                                                                            <FormLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Trabajo Agrícola</FormLabel>
                                                                        </div>
                                                                        <FormControl>
                                                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Sección 2: Previsión y Salud */}
                                                    <div className="space-y-10">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-px bg-border/60" />
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2 px-3">
                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                Previsión y Salud
                                                            </span>
                                                            <div className="flex-1 h-px bg-border/60" />
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
                                                            <FormField control={form.control} name="afp" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className={FORM_STYLES.label}>AFP</FormLabel>
                                                                    <Select value={field.value || ""} onValueChange={field.onChange}>
                                                                        <FormControl>
                                                                            <SelectTrigger className={FORM_STYLES.input}>
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

                                                            <FormField control={form.control} name="salud_type" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className={FORM_STYLES.label}>Sistema de Salud</FormLabel>
                                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                                        <FormControl>
                                                                            <SelectTrigger className={FORM_STYLES.input}>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="FONASA">Fonasa (7%)</SelectItem>
                                                                            <SelectItem value="ISAPRE">Isapre (Pactado)</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )} />

                                                            {watchSalud === "ISAPRE" ? (
                                                                <FormField control={form.control} name="isapre_amount_uf" render={({ field }) => (
                                                                    <FormItem className="animate-in slide-in-from-top-2 duration-300">
                                                                        <FormLabel className={FORM_STYLES.label}>Monto Pactado UF</FormLabel>
                                                                        <FormControl><Input {...field} type="number" step="0.0001" className={FORM_STYLES.input} /></FormControl>
                                                                        <p className="text-[10px] text-muted-foreground italic mt-1">Se descontará el mayor entre el 7% y este monto.</p>
                                                                    </FormItem>
                                                                )} />
                                                            ) : <div className="hidden md:block" />}

                                                            <FormField control={form.control} name="asignacion_familiar" render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className={FORM_STYLES.label}>Asignación Familiar</FormLabel>
                                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                                        <FormControl>
                                                                            <SelectTrigger className={FORM_STYLES.input}>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                        </FormControl>
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
                                                                    <FormLabel className={FORM_STYLES.label}>Nº de Cargas</FormLabel>
                                                                    <FormControl><Input {...field} type="number" min="0" className={FORM_STYLES.input} onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="haberes" className="h-full m-0 p-8 lg:p-10 overflow-y-auto scrollbar-thin animate-in fade-in-50 duration-300">
                                                <div className="max-w-6xl mx-auto space-y-10">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-px bg-border/60" />
                                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center gap-2 px-3">
                                                            <Plus className="h-3.5 w-3.5" />
                                                            Conceptos Específicos Pactados
                                                        </span>
                                                        <div className="flex-1 h-px bg-border/60" />
                                                    </div>

                                                    {availableConcepts.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                                            {availableConcepts.map(concept => (
                                                                <FormItem key={concept.id} className="space-y-3 p-4 rounded-lg bg-muted/5 border border-transparent hover:border-primary/10 transition-all group">
                                                                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{concept.name}</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            step="1"
                                                                            placeholder="0"
                                                                            className={cn("h-10 text-sm bg-background/50", FORM_STYLES.input)}
                                                                            value={(form.watch(`concept_amounts.${concept.id}` as any) as any) || ""}
                                                                            onChange={(e) => {
                                                                                form.setValue(`concept_amounts.${concept.id}` as any, e.target.value as any, { shouldDirty: true })
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                </FormItem>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed rounded-lg gap-3">
                                                            <p className="text-sm text-muted-foreground font-medium">No hay conceptos de haberes específicos configurados.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </form>
                            </Form>
                        </div>

                        <div className="px-8 py-5 border-t bg-muted/5 flex justify-end gap-4 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs font-bold border-primary/20 h-11 px-8 hover:bg-primary/5 transition-all">
                                Cancelar
                            </Button>
                            <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={saving} className="rounded-xl text-xs font-bold min-w-[180px] h-11 transition-all shadow-md hover:shadow-lg active:scale-95">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (employee ? "Guardar Cambios" : "Contratar / Registrar")}
                            </Button>
                        </div>
                    </div>

                    {employee?.id && (
                        <div className="w-72 flex flex-col bg-muted/5 border-l overflow-hidden hidden xl:flex">
                            <ActivitySidebar entityId={employee.id} entityType="employee" />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

