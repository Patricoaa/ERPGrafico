"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getPayrolls, createPayroll, getEmployees, deletePayroll, paySalary, payPrevired, createAdvance } from "@/lib/hr/api"
import type { Payroll, Employee } from "@/types/hr"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
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
import { PaymentDialog } from "@/components/shared/PaymentDialog"
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
type CreatePayrollValues = z.infer<typeof createPayrollSchema>

export default function PayrollsPage() {
    const router = useRouter()
    const [payrolls, setPayrolls] = useState<Payroll[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)

    // State for payment dialogs
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)
    const [paymentMode, setPaymentMode] = useState<'SALARY' | 'PREVIRED' | 'ADVANCE' | null>(null)

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
            header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
            cell: ({ row }) => <DataCell.Code>{row.getValue("display_id")}</DataCell.Code>,
        },
        {
            accessorFn: (row) => row.employee_name || "",
            id: "employee",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" />,
            cell: ({ row }) => <div className="font-medium text-sm">{row.original.employee_name}</div>,
        },
        {
            accessorKey: "period_label",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Período" />,
            cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue("period_label")}</div>,
        },
        {
            accessorKey: "total_haberes",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Haberes" />,
            cell: ({ row }) => (
                <div className="flex justify-end opacity-80 font-medium">
                    <MoneyDisplay amount={parseFloat(row.getValue("total_haberes"))} className="text-emerald-600" />
                </div>
            ),
        },
        {
            accessorKey: "legal_deductions_worker",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Desc. Legales" />,
            cell: ({ row }) => (
                <div className="flex justify-end opacity-70">
                    <MoneyDisplay amount={parseFloat((row.original as any).legal_deductions_worker || 0)} className="text-rose-600 text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "employer_contribution",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Aporte Patr." />,
            cell: ({ row }) => (
                <div className="flex justify-end opacity-70">
                    <MoneyDisplay amount={parseFloat((row.original as any).employer_contribution || 0)} className="text-amber-600 text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "other_deductions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Otros Desc." />,
            cell: ({ row }) => (
                <div className="flex justify-end opacity-70">
                    <MoneyDisplay amount={parseFloat((row.original as any).other_deductions || 0)} className="text-muted-foreground text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "advances_total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Anticipos" />,
            cell: ({ row }) => (
                <div className="flex justify-end opacity-70">
                    <MoneyDisplay amount={parseFloat((row.original as any).advances_total || 0)} className="text-blue-600 text-[11px]" />
                </div>
            ),
        },
        {
            accessorKey: "net_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Líquido" />,
            cell: ({ row }) => (
                <div className="flex justify-end font-bold text-sm">
                    <MoneyDisplay amount={parseFloat(row.getValue("net_salary"))} />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => {
                const s = row.getValue("status") as string;
                return (
                    <Badge variant="outline" className={cn(
                        "text-[9px] uppercase font-bold",
                        s === 'POSTED' ? "text-emerald-600 border-emerald-500/30 bg-emerald-50" : "text-amber-600 border-amber-500/30 bg-amber-50"
                    )}>
                        {s === 'POSTED' ? 'Contabilizado' : 'Borrador'}
                    </Badge>
                )
            }
        },
        {
            accessorKey: "remuneration_paid_status",
            header: "Remuneración",
            cell: ({ row }) => {
                const s = (row.original as any).remuneration_paid_status;
                return (
                    <Badge variant="outline" className={cn(
                        "text-[9px] uppercase font-bold",
                        s === 'PAID' ? "text-emerald-600 border-emerald-500/30 bg-emerald-50" : 
                        s === 'PARTIAL' ? "text-amber-600 border-amber-500/30 bg-amber-50" : "text-muted-foreground"
                    )}>
                        {s === 'PAID' ? 'Pagado' : s === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                    </Badge>
                )
            }
        },
        {
            accessorKey: "previred_paid_status",
            header: "Previred",
            cell: ({ row }) => {
                const s = (row.original as any).previred_paid_status;
                return (
                    <Badge variant="outline" className={cn(
                        "text-[9px] uppercase font-bold",
                        s === 'PAID' ? "text-emerald-600 border-emerald-500/30 bg-emerald-50" : 
                        s === 'PARTIAL' ? "text-amber-600 border-amber-500/30 bg-amber-50" : "text-muted-foreground"
                    )}>
                        {s === 'PAID' ? 'Pagado' : s === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                    </Badge>
                )
            }
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const p = row.original;
                return (
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); router.push(`/hr/payrolls/${p.id}`) }}>
                            <Eye className="h-3.5 w-3.5" />
                        </Button>

                        {p.status === 'DRAFT' && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Registrar Anticipo"
                                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
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
                                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
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
                                className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Liquidaciones"
                description="Gestión de pagos de remuneraciones mensuales."
                titleActions={
                    <div className="flex items-center gap-2">
                        <PageHeaderButton
                            onClick={async () => {
                                if (confirm("¿Generar automáticamente liquidaciones borrador para todos los empleados activos este mes?")) {
                                    try {
                                        const res = await (await import("@/lib/hr/api")).triggerDraftPayrolls()
                                        toast.success(res.detail)
                                        fetchPayrolls()
                                    } catch {
                                        toast.error("Error al iniciar tarea")
                                    }
                                }
                            }}
                            icon={FileText}
                            variant="outline"
                            label="Generar Borradores"
                        />
                        <CreatePayrollDialog
                            open={dialogOpen}
                            onOpenChange={setDialogOpen}
                            onSaved={(id) => { setDialogOpen(false); router.push(`/hr/payrolls/${id}`) }}
                            trigger={
                                <PageHeaderButton
                                    onClick={() => setDialogOpen(true)}
                                    icon={Plus}
                                    circular
                                    title="Nueva Liquidación"
                                />
                            }
                        />
                    </div>
                }
            />

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
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
                    onRowClick={(row: Payroll) => router.push(`/hr/payrolls/${row.id}`)}
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
