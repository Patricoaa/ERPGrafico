"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getPayrolls, createPayroll, getEmployees, deletePayroll } from "@/lib/hr/api"
import type { Payroll, Employee } from "@/types/hr"
import { PageHeader } from "@/components/shared/PageHeader"
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

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PageHeader title="Liquidaciones" description="Gestión de pagos de remuneraciones mensuales.">
                <CreatePayrollDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onSaved={(id) => { setDialogOpen(false); router.push(`/hr/payrolls/${id}`) }}
                    trigger={
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" /> Nueva Liquidación
                        </Button>
                    }
                />
            </PageHeader>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : payrolls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                            <FileText className="h-10 w-10 opacity-20" />
                            <p className="text-sm font-medium">No hay liquidaciones registradas</p>
                            <p className="text-xs opacity-60">Crea la primera liquidación con el botón superior</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Número</TableHead>
                                    <TableHead>Empleado</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead className="text-right">Haberes</TableHead>
                                    <TableHead className="text-right">Descuentos</TableHead>
                                    <TableHead className="text-right">Líquido</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="w-[60px]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payrolls.map(p => (
                                    <TableRow
                                        key={p.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/hr/payrolls/${p.id}`)}
                                    >
                                        <TableCell className="font-mono text-xs text-muted-foreground">{p.display_id}</TableCell>
                                        <TableCell className="font-medium">{p.employee_name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{p.period_label}</TableCell>
                                        <TableCell className="text-right">
                                            <MoneyDisplay amount={parseFloat(p.total_haberes)} className="text-emerald-600" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <MoneyDisplay amount={parseFloat(p.total_descuentos)} className="text-rose-600" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <MoneyDisplay amount={parseFloat(p.net_salary)} className="font-bold" />
                                        </TableCell>
                                        <TableCell>
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
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); router.push(`/hr/payrolls/${p.id}`) }}>
                                                    <Eye className="h-3.5 w-3.5" />
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
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
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
