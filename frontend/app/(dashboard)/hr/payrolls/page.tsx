"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getPayrolls, createPayroll, getEmployees, deletePayroll, paySalary, payPrevired, createAdvance } from "@/lib/hr/api"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import type { Payroll, Employee } from "@/types/hr"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Loader2, Plus, FileText, Eye, Trash2, Coins, CreditCard, Wallet } from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"
import { PaymentDialog } from "@/features/treasury/components/PaymentDialog"
import { FORM_STYLES } from "@/lib/styles"
import { PayrollDetailSheet } from "@/features/hr/components/payrolls/PayrollDetailSheet"
import { LAYOUT_TOKENS } from "@/lib/styles"

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
type CreatePayrollValues = z.infer<typeof createPayrollSchema>

export default function PayrollsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [payrolls, setPayrolls] = useState<Payroll[]>([])
    const [loading, setLoading] = useState(true)
    const isNewModalOpen = searchParams.get("modal") === "new"
    const [dialogOpen, setDialogOpen] = useState(isNewModalOpen)

    useEffect(() => {
        setDialogOpen(isNewModalOpen)
    }, [isNewModalOpen])

    const fetchPayrolls = useCallback(async () => {
        try {
            const data = await getPayrolls()
            setPayrolls(data)
        } catch {
            toast.error("Error al cargar liquidaciones")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchPayrolls() }, [fetchPayrolls])

    useEffect(() => {
        const action = searchParams.get("action")
        if (action === "generate_drafts") {
            const executeAction = async () => {
                if (confirm("¿Generar automáticamente liquidaciones borrador para todos los empleados activos este mes?")) {
                    try {
                        const { triggerDraftPayrolls } = await import("@/lib/hr/api")
                        const res = await triggerDraftPayrolls()
                        toast.success(res.detail)
                        fetchPayrolls()
                    } catch {
                        toast.error("Error al iniciar tarea")
                    } finally {
                        // Limpiar la URL de la acción
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete("action")
                        router.push(`?${params.toString()}`, { scroll: false })
                    }
                } else {
                    // Limpiar la URL si el usuario cancela
                    const params = new URLSearchParams(searchParams.toString())
                    params.delete("action")
                    router.push(`?${params.toString()}`, { scroll: false })
                }
            }
            executeAction()
        }
    }, [searchParams, router, fetchPayrolls])

    const handleOpenChange = (open: boolean) => {
        if (!open && isNewModalOpen) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
        setDialogOpen(open)
    }

    // State for payment dialogs
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)
    const [paymentMode, setPaymentMode] = useState<'SALARY' | 'PREVIRED' | 'ADVANCE' | null>(null)

    // State for Detail Sheet
    const [detailSheetOpen, setDetailSheetOpen] = useState(false)
    const [activePayrollId, setActivePayrollId] = useState<number | null>(null)

    const openDetail = (id: number) => {
        setActivePayrollId(id)
        setDetailSheetOpen(true)
    }

    const handleConfirmPayment = async (data: any) => {
        if (!selectedPayroll || !paymentMode) return

        try {
            if (paymentMode === 'SALARY') {
                await paySalary(selectedPayroll.id, data)
                toast.success("Pago de remuneración registrado")
            } else if (paymentMode === 'PREVIRED') {
                await payPrevired(selectedPayroll.id, data)
                toast.success("Pago Previred registrado")
            } else if (paymentMode === 'ADVANCE') {
                await createAdvance({
                    employee: selectedPayroll.employee,
                    payroll: selectedPayroll.id,
                    amount: data.amount,
                    date: data.documentDate || new Date().toISOString().split('T')[0],
                    notes: "Anticipo de sueldo",
                    ...data
                })
                toast.success("Anticipo registrado")
            }
            setPaymentMode(null)
            setSelectedPayroll(null)
            fetchPayrolls()
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Error al procesar")
        }
    }

    const columns: ColumnDef<Payroll>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Code>{row.getValue("display_id")}</DataCell.Code></div>,
        },
        {
            accessorFn: (row) => row.employee_name || "",
            id: "employee",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text className="font-bold">{row.original.employee_name}</DataCell.Text></div>,
        },
        {
            accessorKey: "period_label",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Período" className="justify-center" />,
            cell: ({ row }) => <div className="text-sm text-muted-foreground text-center w-full">{row.getValue("period_label")}</div>,
        },
        {
            accessorKey: "total_haberes",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Haberes" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat(row.getValue("total_haberes"))} className="text-success font-medium" />
                </div>
            ),
        },
        {
            accessorKey: "legal_deductions_worker",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Desc. Legales" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as any).legal_deductions_worker || 0)} className="text-rose-600 text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "employer_contribution",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Aporte Patr." className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as any).employer_contribution || 0)} className="text-warning text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "other_deductions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Otros Desc." className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as any).other_deductions || 0)} className="text-muted-foreground text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "advances_total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Anticipos" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat((row.original as any).advances_total || 0)} className="text-primary text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "net_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Líquido" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={parseFloat(row.getValue("net_salary"))} className="font-bold" />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.getValue("status") as string} />
                </div>
            )
        },
        {
            accessorKey: "remuneration_paid_status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Remuneración" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={(row.original as any).remuneration_paid_status} />
                </div>
            )
        },
        {
            accessorKey: "previred_paid_status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Previred" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={(row.original as any).previred_paid_status} />
                </div>
            )
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Acciones" className="justify-center" />,
            cell: ({ row }) => {
                const p = row.original;
                return (
                    <div className="flex items-center gap-1 justify-center w-full">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); openDetail(p.id) }}>
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
 
                        {p.status === 'DRAFT' && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Registrar Anticipo"
                                className="h-8 w-8 rounded-md text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPayroll(p);
                                    setPaymentMode('ADVANCE');
                                }}
                            >
                                <Wallet className="h-3.5 w-3.5" />
                            </Button>
                        )}
 
                        {p.status === 'POSTED' && (row.original as any).remuneration_paid_status !== 'PAID' && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Registrar Pago Sueldo"
                                className="h-8 w-8 rounded-md text-success hover:text-success hover:bg-success/10 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPayroll(p);
                                    setPaymentMode('SALARY');
                                }}
                            >
                                <Coins className="h-3.5 w-3.5" />
                            </Button>
                        )}
 
                        {p.status === 'POSTED' && (row.original as any).previred_paid_status !== 'PAID' && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Pagar Previred"
                                className="h-8 w-8 rounded-md text-warning hover:text-warning hover:bg-warning/10 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPayroll(p);
                                    setPaymentMode('PREVIRED');
                                }}
                            >
                                <CreditCard className="h-3.5 w-3.5" />
                            </Button>
                        )}
 
                        {p.status === 'DRAFT' && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm("¿Eliminar borrador?")) {
                                        try {
                                            await deletePayroll(p.id);
                                            toast.success("Borrador eliminado");
                                            fetchPayrolls();
                                        } catch {
                                            toast.error("Error al eliminar");
                                        }
                                    }
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ]

    return (
        <div className="space-y-4">
            <CreatePayrollDialog
                open={dialogOpen}
                onOpenChange={handleOpenChange}
                onSaved={(id) => { handleOpenChange(false); openDetail(id) }}
            />

            {loading ? (
                <TableSkeleton columns={10} rows={12} />
            ) : (
                <>
                <DataTable
                    columns={columns}
                    data={payrolls}
                    cardMode
                    filterColumn="employee"
                    globalFilterFields={["display_id", "employee"]}
                    searchPlaceholder="Buscar liquidación o empleado..."
                    facetedFilters={[
                        {
                            column: "status",
                            title: "Estado",
                            options: [
                                { label: "Borrador", value: "DRAFT" },
                                { label: "Contabilizado", value: "POSTED" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    defaultPageSize={20}
                    onRowClick={(row: Payroll) => openDetail(row.id)}
                />

                <PayrollDetailSheet 
                    payrollId={activePayrollId}
                    open={detailSheetOpen}
                    onOpenChange={setDetailSheetOpen}
                    onUpdate={fetchPayrolls}
                />

                <PaymentDialog
                    open={!!paymentMode}
                    onOpenChange={(o) => !o && setPaymentMode(null)}
                    isPurchase={true}
                    title={
                        paymentMode === 'SALARY' ? `Pagar Remuneración: ${selectedPayroll?.employee_name}` :
                        paymentMode === 'PREVIRED' ? `Pagar Previred: ${selectedPayroll?.employee_name}` :
                        `Registrar Anticipo: ${selectedPayroll?.employee_name}`
                    }
                    total={
                        paymentMode === 'SALARY' ? (selectedPayroll ? ((selectedPayroll as any).net_salary - ((selectedPayroll as any).advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? ((selectedPayroll as any)?.total_previred || 0) :
                        ((selectedPayroll as any)?.net_salary || 0)
                    }
                    pendingAmount={
                        paymentMode === 'SALARY' ? (selectedPayroll ? ((selectedPayroll as any).net_salary - ((selectedPayroll as any).advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? ((selectedPayroll as any)?.total_previred || 0) :
                        ((selectedPayroll as any)?.net_salary || 0)
                    }
                    onConfirm={handleConfirmPayment}
                />
                </>
            )}
        </div>
    )
}
interface CreatePayrollDialogProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    onSaved: (id: number) => void
    trigger?: React.ReactNode
}

function CreatePayrollDialog({ open, onOpenChange, onSaved, trigger }: CreatePayrollDialogProps) {
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])

    useEffect(() => {
        if (open) {
            getEmployees({ status: 'ACTIVE' }).then(setEmployees).catch(() => toast.error("Error al cargar empleados"))
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
                employee: parseInt(data.employee) as any,
                period_year: parseInt(data.period_year),
                period_month: parseInt(data.period_month),
                notes: data.notes || "",
            })
            toast.success("Liquidación creada")
            onSaved(created.id)
        } catch (e: any) {
            const err = e?.response?.data
            const msg = err?.non_field_errors?.[0] || err?.detail || "Error al crear liquidación"
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-base font-bold tracking-tight">Nueva Liquidación</span>
                            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                                RRHH <span className="opacity-30">|</span> Emisión Mensual
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0 text-left">
                        <div className="p-6 space-y-5">
                            <FormField control={form.control} name="employee" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Empleado</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger className="rounded-xl h-11">
                                                <SelectValue placeholder="Seleccionar empleado..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            {employees.map(e => (
                                                <SelectItem key={e.id} value={String(e.id)} className="rounded-lg">
                                                    {e.contact_detail?.name} — {e.contact_detail?.tax_id}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="period_year" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Año</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl">
                                                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                                    <SelectItem key={y} value={String(y)} className="rounded-lg">{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="period_month" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Mes</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl">
                                                {MONTHS.map(m => (
                                                    <SelectItem key={m.value} value={String(m.value)} className="rounded-lg">{m.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 w-full px-6 py-4 border-t border-border/40 bg-muted/10">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="rounded-xl text-xs font-bold border-primary/20 hover:bg-primary/5"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving}
                                className="rounded-xl text-xs font-bold"
                            >
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <FileText className="mr-2 h-3.5 w-3.5" />
                                Crear Liquidación
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

