"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getAdvances, createAdvance, updateAdvance, deleteAdvance, getEmployees, getPayrolls } from "@/lib/hr/api"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import type { SalaryAdvance, Employee, Payroll } from "@/types/hr"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
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
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import {
    Plus, Pencil, Trash2, Loader2, WalletCards, CheckCircle2, Clock
} from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

const advanceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    amount: z.string().min(1).refine(v => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    date: z.string().min(1, "Fecha requerida"),
    payroll: z.string().min(1, "Vincular a una liquidación es obligatorio"),
    notes: z.string().optional(),
})
type AdvanceFormValues = z.infer<typeof advanceSchema>

export default function AdvancesPage() {
    const [advances, setAdvances] = useState<SalaryAdvance[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [payrolls, setPayrolls] = useState<Payroll[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null)
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
    const [tempAdvanceData, setTempAdvanceData] = useState<any>(null)

    const fetchAll = useCallback(async () => {
        try {
            const [adv, emps, pays] = await Promise.all([
                getAdvances(),
                getEmployees(),
                getPayrolls() // Fetch all payrolls to support drafts
            ])
            setAdvances(adv)
            setEmployees(emps)
            setPayrolls(pays)
        } catch {
            toast.error("Error al cargar anticipos")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleDelete = async (id: number) => {
        try {
            await deleteAdvance(id)
            toast.success("Anticipo eliminado")
            fetchAll()
        } catch {
            toast.error("Error al eliminar anticipo")
        }
    }

    const columns: ColumnDef<SalaryAdvance>[] = [
        {
            accessorKey: "employee_name",
            header: "Empleado",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-sm">{row.original.employee_name}</span>
                    <span className="text-[10px] text-muted-foreground">{row.original.employee_display_id}</span>
                </div>
            )
        },
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => (
                <span className="font-mono text-xs">
                    {format(new Date(row.original.date), "dd/MM/yyyy")}
                </span>
            )
        },
        {
            accessorKey: "amount",
            header: "Monto",
            cell: ({ row }) => (
                <MoneyDisplay amount={parseFloat(row.original.amount)} className="font-mono text-sm font-bold text-amber-600" />
            )
        },
        {
            accessorKey: "is_discounted",
            header: "Estado",
            cell: ({ row }) => row.original.is_discounted ? (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Descontado
                </Badge>
            ) : (
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-50">
                    <Clock className="h-3 w-3 mr-1" /> Pendiente
                </Badge>
            )
        },
        {
            accessorKey: "payroll_display_id",
            header: "Liquidación",
            cell: ({ row }) => row.original.payroll_display_id
                ? <span className="font-mono text-xs text-muted-foreground">{row.original.payroll_display_id}</span>
                : <span className="text-xs text-muted-foreground italic">—</span>
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-1 justify-end">
                    {!row.original.is_discounted && (
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditingAdvance(row.original); setDialogOpen(true) }}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                    )}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500">
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar anticipo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(row.original.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )
        }
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Anticipos de Sueldo"
                    description="Registro de anticipos entregados a trabajadores"
                    icon={WalletCards}
                />
                <Button onClick={() => { setEditingAdvance(null); setDialogOpen(true) }} className="gap-2">
                    <Plus className="h-4 w-4" /> Nuevo Anticipo
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={advances}
                defaultPageSize={20}
                useAdvancedFilter={true}
            />

            <AdvanceDialog
                open={dialogOpen}
                onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingAdvance(null) }}
                advance={editingAdvance}
                employees={employees}
                payrolls={payrolls}
                onSaved={(data) => {
                    if (editingAdvance) {
                        fetchAll()
                        setDialogOpen(false)
                        setEditingAdvance(null)
                    } else {
                        setTempAdvanceData(data)
                        setDialogOpen(false)
                        setPaymentDialogOpen(true)
                    }
                }}
            />

            <PaymentDialog
                open={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
                title="Registrar Pago de Anticipo"
                total={tempAdvanceData ? parseFloat(tempAdvanceData.amount) : 0}
                pendingAmount={tempAdvanceData ? parseFloat(tempAdvanceData.amount) : 0}
                isPurchase={true}
                hideDteFields={true}
                onConfirm={async (paymentData) => {
                    try {
                        await createAdvance({ 
                            ...tempAdvanceData, 
                            ...paymentData,
                            amount: String(paymentData.amount || tempAdvanceData.amount),
                            date: paymentData.documentDate || tempAdvanceData.date, // Respect payment date
                        } as any)
                        toast.success("Anticipo registrado y pago contabilizado")
                        fetchAll()
                        setPaymentDialogOpen(false)
                        setTempAdvanceData(null)
                    } catch (e: any) {
                        toast.error(e?.response?.data?.detail || "Error al registrar anticipo")
                    }
                }}
            />
        </div>
    )
}

function AdvanceDialog({ open, onOpenChange, advance, employees, payrolls, onSaved }: {
    open: boolean
    onOpenChange: (o: boolean) => void
    advance: SalaryAdvance | null
    employees: Employee[]
    payrolls: Payroll[]
    onSaved: (data?: any) => void
}) {
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
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Error al guardar anticipo")
        } finally {
            setSaving(false)
        }
    }

    const selectedEmployee = form.watch("employee")
    const employeePayrolls = payrolls.filter(p => p.employee.toString() === selectedEmployee && p.status === 'DRAFT')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <WalletCards className="h-4 w-4 text-primary" />
                        {advance ? "Editar Anticipo" : "Registrar Anticipo"}
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="employee" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Empleado</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
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

                        <div className="grid grid-cols-2 gap-3">
                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Monto ($)</FormLabel>
                                    <FormControl><Input {...field} type="number" placeholder="0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="date" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fecha Propuesta</FormLabel>
                                    <FormControl><Input {...field} type="date" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="payroll" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Vincular a Liquidación (Obligatorio)</FormLabel>
                                <Select 
                                    onValueChange={field.onChange} 
                                    value={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar liquidación..." /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {employeePayrolls.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.display_id} – {p.period_label} ({p.status_display})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notas</FormLabel>
                                <FormControl>
                                    <Textarea {...field} rows={2} placeholder="Descripción opcional..." />
                                </FormControl>
                            </FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {advance ? "Actualizar" : "Registrar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
