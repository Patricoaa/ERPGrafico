"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getPayrolls, createPayroll, getEmployees, deletePayroll } from "@/lib/hr/api"
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
import { Loader2, Plus, FileText, Eye, Trash2 } from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"

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
            accessorKey: "total_descuentos",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Descuentos" />,
            cell: ({ row }) => (
                <div className="flex justify-end opacity-80 font-medium">
                    <MoneyDisplay amount={parseFloat(row.getValue("total_descuentos"))} className="text-rose-600" />
                </div>
            ),
        },
        {
            accessorKey: "net_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Líquido" />,
            cell: ({ row }) => (
                <div className="flex justify-end font-bold text-base">
                    <MoneyDisplay amount={parseFloat(row.getValue("net_salary"))} />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => {
                const p = row.original;
                return (
                    <Badge
                        variant="secondary"
                        className={cn(
                            "text-[10px] font-bold uppercase",
                            p.status === 'POSTED'
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        )}
                    >
                        {p.status_display}
                    </Badge>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const p = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); router.push(`/hr/payrolls/${p.id}`) }}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        {p.status === 'DRAFT' && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
                                <Trash2 className="h-4 w-4" />
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
                <DataTable
                    columns={columns}
                    data={payrolls}
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Nueva Liquidación de Sueldo</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="employee" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Empleado</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                        <SelectTrigger>
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
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="period_year" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Año</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="period_month" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mes</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {MONTHS.map(m => (
                                                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear Liquidación
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
