"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getAdvances, createAdvance, updateAdvance, deleteAdvance, getEmployees, getPayrolls } from "@/lib/hr/api"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { PaymentDialog } from "@/features/treasury/components/PaymentDialog"
import type { SalaryAdvance, Employee, Payroll } from "@/types/hr"
import { PageHeader } from "@/components/shared/PageHeader"
import { BaseModal } from "@/components/shared/BaseModal"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
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
    Plus, Pencil, Trash2, Loader2, WalletCards, CheckCircle2, Clock, History
} from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { FORM_STYLES, LAYOUT_TOKENS } from "@/lib/styles"
import { useSearchParams } from "next/navigation"

const advanceSchema = z.object({
    employee: z.string().min(1, "Empleado requerido"),
    amount: z.string().min(1).refine(v => parseFloat(v) > 0, "El monto debe ser mayor a 0"),
    date: z.string().min(1, "Fecha requerida"),
    payroll: z.string().min(1, "Vincular a una liquidación es obligatorio"),
    notes: z.string().optional(),
})
type AdvanceFormValues = z.infer<typeof advanceSchema>

export default function AdvancesPage() {
    const searchParams = useSearchParams()
    const [advances, setAdvances] = useState<SalaryAdvance[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [payrolls, setPayrolls] = useState<Payroll[]>([])
    const [loading, setLoading] = useState(true)
    
    // Dialog state synchronized with URL or local edit
    const isNewModalOpen = searchParams.get("modal") === "new"
    const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null)
    const dialogOpen = isNewModalOpen || !!editingAdvance

    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
    const [tempAdvanceData, setTempAdvanceData] = useState<any>(null)

    const setDialogOpen = (open: boolean) => {
        if (!open) {
            setEditingAdvance(null)
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                window.history.replaceState(null, "", `?${params.toString()}`)
            }
        }
    }

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
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center justify-center w-full">
                    <DataCell.Text className="font-bold">{row.original.employee_name}</DataCell.Text>
                    <DataCell.Secondary>{row.original.employee_display_id}</DataCell.Secondary>
                </div>
            )
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.original.date} />
                </div>
            )
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat(row.original.amount)} className="text-warning font-bold" />
                </div>
            )
        },
        {
            accessorKey: "is_discounted",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge 
                        status={row.original.is_discounted ? "DISCOUNTED" : "PENDING"} 
                        label={row.original.is_discounted ? "Descontado" : "Pendiente"} 
                    />
                </div>
            )
        },
        {
            accessorKey: "payroll_display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Liquidación" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    {row.original.payroll_display_id
                        ? <DataCell.Code>{row.original.payroll_display_id}</DataCell.Code>
                        : <span className="text-xs text-muted-foreground italic">—</span>
                    }
                </div>
            )
        },
        createActionsColumn<SalaryAdvance>({
            renderActions: (advance) => (
                <>
                    {!advance.is_discounted && (
                        <DataCell.Action
                            icon={Pencil}
                            title="Editar"
                            onClick={() => { setEditingAdvance(advance); setDialogOpen(true) }}
                        />
                    )}
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                            if (confirm("¿Eliminar anticipo? Esta acción no se puede deshacer.")) {
                                handleDelete(advance.id)
                            }
                        }}
                    />
                </>
            )
        })
    ]

    return (
        <div className="space-y-4">

            {loading ? (
                <TableSkeleton columns={5} rows={10} />
            ) : (
                <DataTable
                    columns={columns}
                    data={advances}
                    cardMode
                    filterColumn="employee_name"
                    defaultPageSize={20}
                    useAdvancedFilter={true}
                />
            )}

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
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="advance-form" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {advance ? "Actualizar" : "Registrar"}
                    </Button>
                </div>
            }
        >
            <div className="flex-1 flex overflow-hidden h-full">
                {/* Left: Form */}
                <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2 scrollbar-thin">
                    <Form {...form}>
                        <form id="advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-1">
                            <FormField control={form.control} name="employee" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Empleado</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className={FORM_STYLES.input}>
                                                <SelectValue placeholder="Seleccionar empleado..." />
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
                                <FormField control={form.control} name="amount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Monto ($)</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="number" placeholder="0" className={FORM_STYLES.input} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Fecha Propuesta</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="date" className={FORM_STYLES.input} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="payroll" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Vincular a Liquidación (Obligatorio)</FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className={FORM_STYLES.input}>
                                                <SelectValue placeholder="Seleccionar liquidación..." />
                                            </SelectTrigger>
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
                                    <FormLabel className={FORM_STYLES.label}>Notas</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={2} placeholder="Descripción opcional..." className={FORM_STYLES.input} />
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
                            entityType={"salaryadvance" as any}
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

