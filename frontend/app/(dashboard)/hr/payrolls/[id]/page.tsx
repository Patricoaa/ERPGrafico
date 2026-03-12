
"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    getPayroll, postPayroll, recalculatePayroll, deletePayroll,
    createPayrollItem, updatePayrollItem, deletePayrollItem,
    getPayrollConcepts, generateProformaPayroll, payPrevired, paySalary,
    getPayrollPayments
} from "@/lib/hr/api"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import type { Payroll, PayrollItem, PayrollConcept, PayrollPayment } from "@/types/hr"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
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
    Loader2, Plus, Trash2, Pencil, ArrowLeft, BookOpen,
    TrendingUp, TrendingDown, DollarSign, ShieldCheck, AlertCircle, Sparkles,
    CreditCard, CheckCircle2, Clock
} from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"
import { AccountSelector } from "@/components/selectors/AccountSelector"

const itemSchema = z.object({
    concept: z.string().min(1, "Concepto requerido"),
    description: z.string().optional(),
    amount: z.string().min(1).refine(v => parseFloat(v) >= 0, "El monto debe ser mayor o igual a 0"),
})
type ItemFormValues = z.infer<typeof itemSchema>

function ItemRow({ item, type, isPosted, onEdit, onDelete }: {
    item: PayrollItem, type: 'HABER' | 'DESCUENTO', isPosted: boolean, onEdit: (i: PayrollItem) => void, onDelete: (i: PayrollItem) => void
}) {
    return (
        <TableRow className="group border-none hover:bg-slate-50/50 transition-colors">
            <TableCell className="py-3 pl-6">
                <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{item.concept_detail?.name}</span>
                    {item.description && <span className="text-[10px] text-slate-400 leading-none mt-0.5">{item.description}</span>}
                </div>
            </TableCell>
            <TableCell className="text-right py-3 tabular-nums">
                {type === 'HABER' && <MoneyDisplay amount={parseFloat(item.amount)} className="text-[11px] font-black text-emerald-600" />}
            </TableCell>
            <TableCell className="text-right py-3 pr-6 tabular-nums">
                {type === 'DESCUENTO' && <MoneyDisplay amount={parseFloat(item.amount)} className="text-[11px] font-black text-rose-500" />}
            </TableCell>
            {!isPosted && (
                <TableCell className="w-[80px] p-0 pr-6">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-primary/5" onClick={() => onEdit(item)}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50" onClick={() => { if (confirm("¿Eliminar?")) onDelete(item) }}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </TableCell>
            )}
        </TableRow>
    )
}

function ItemsTable({ items, isPosted, onEdit, onDelete, accentColor }: {
    items: PayrollItem[], isPosted: boolean, onEdit: (i: PayrollItem) => void, onDelete: (i: PayrollItem) => void, accentColor: string
}) {
    if (items.length === 0) return <div className="px-4 py-8 text-center text-xs text-slate-400 italic">No hay registros</div>
    const type = accentColor.includes('emerald') ? 'HABER' : 'DESCUENTO'
    return (
        <Table>
            <TableBody>
                {items.map(item => (
                    <ItemRow key={item.id} item={item} type={type} isPosted={isPosted} onEdit={onEdit} onDelete={onDelete} />
                ))}
            </TableBody>
        </Table>
    )
}

interface Props {
    params: Promise<{ id: string }>
}

export default function PayrollDetailPage({ params }: Props) {
    const resolvedParams = use(params)
    const router = useRouter()
    const payrollId = parseInt(resolvedParams.id)

    const [payroll, setPayroll] = useState<Payroll | null>(null)
    const [concepts, setConcepts] = useState<PayrollConcept[]>([])
    const [payments, setPayments] = useState<PayrollPayment[]>([])
    const [loading, setLoading] = useState(true)
    const [posting, setPosting] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [editingItem, setEditingItem] = useState<PayrollItem | null>(null)
    const [previredDialog, setPreviredDialog] = useState(false)
    const [salaryDialog, setSalaryDialog] = useState(false)

    const fetchPayroll = useCallback(async () => {
        try {
            const [payrollData, conceptsData, paymentsData] = await Promise.all([
                getPayroll(payrollId),
                getPayrollConcepts(),
                getPayrollPayments({ payroll: String(payrollId) })
            ])
            setPayroll(payrollData)
            setConcepts(conceptsData)
            setPayments(paymentsData)
        } catch {
            toast.error("Error al cargar liquidación")
        } finally {
            setLoading(false)
        }
    }, [payrollId])

    useEffect(() => { fetchPayroll() }, [fetchPayroll])

    const handlePost = async () => {
        setPosting(true)
        try {
            const updated = await postPayroll(payrollId)
            setPayroll(updated)
            toast.success("Liquidación contabilizada")
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Error al contabilizar")
        } finally {
            setPosting(false)
        }
    }

    const handleGenerateProforma = async () => {
        if (!payroll) return
        setGenerating(true)
        try {
            const updated = await generateProformaPayroll({
                employee: payroll.employee,
                period_year: payroll.period_year,
                period_month: payroll.period_month
            })
            setPayroll(updated)
            toast.success("Propuesta generada exitosamente")
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Error al generar propuesta")
        } finally {
            setGenerating(false)
        }
    }

    const handleDeletePayroll = async () => {
        if (!confirm("¿Eliminar esta liquidación? Esta acción no se puede deshacer.")) return
        try {
            await deletePayroll(payrollId)
            toast.success("Liquidación eliminada")
            router.push('/hr/payrolls')
        } catch {
            toast.error("Error al eliminar liquidación")
        }
    }

    const handleDeleteItem = async (item: PayrollItem) => {
        try {
            await deletePayrollItem(payrollId, item.id)
            toast.success("Línea eliminada")
            fetchPayroll()
        } catch {
            toast.error("Error al eliminar")
        }
    }

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!payroll) return null

    const haberes = payroll.items?.filter(i =>
        i.concept_detail?.category === 'HABER_IMPONIBLE' ||
        i.concept_detail?.category === 'HABER_NO_IMPONIBLE'
    ) || []

    const workerLegalDiscounts = payroll.items?.filter(i =>
        i.concept_detail?.category === 'DESCUENTO_LEGAL_TRABAJADOR'
    ) || []

    const employerContributions = payroll.items?.filter(i =>
        i.concept_detail?.category === 'DESCUENTO_LEGAL_EMPLEADOR'
    ) || []

    const otherDiscounts = payroll.items?.filter(i =>
        i.concept_detail?.category === 'OTRO_DESCUENTO'
    ) || []

    const isPosted = payroll.status === 'POSTED'
    const salaroPaid = payments.some(p => p.payment_type === 'SALARIO')
    const previredPaid = payments.some(p => p.payment_type === 'PREVIRED')

    const workerDiscountsTotal = workerLegalDiscounts.reduce((s, i) => s + parseFloat(i.amount), 0)
    const otherDiscountsTotal = otherDiscounts.reduce((s, i) => s + parseFloat(i.amount), 0)
    const netSalary = parseFloat(payroll.net_salary || "0")

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.push('/hr/payrolls')} className="text-muted-foreground">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Liquidaciones
                </Button>
                <div className="flex gap-2">
                    {!isPosted && (
                        <>
                            <Button
                                variant="outline" size="sm"
                                className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
                                onClick={handleGenerateProforma}
                                disabled={generating}
                            >
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Propuesta Inicial
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" className="gap-2" disabled={posting}>
                                        {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                                        Contabilizar
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Contabilizar liquidación?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Se generarán los asientos contables asociados a los haberes y retenciones legales.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handlePost}>Contabilizar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                    {isPosted && (
                        <>
                            <Button
                                variant="outline" size="sm"
                                className={cn(
                                    "gap-2",
                                    salaroPaid
                                        ? "border-emerald-500/30 text-emerald-600"
                                        : "border-amber-500/30 text-amber-600 hover:bg-amber-50"
                                )}
                                onClick={() => !salaroPaid && setSalaryDialog(true)}
                                disabled={salaroPaid}
                            >
                                {salaroPaid ? <CheckCircle2 className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                                {salaroPaid ? "Sueldo Pagado" : "Pagar Sueldo"}
                            </Button>
                            <Button
                                variant="outline" size="sm"
                                className={cn(
                                    "gap-2",
                                    previredPaid
                                        ? "border-emerald-500/30 text-emerald-600"
                                        : "border-rose-500/30 text-rose-600 hover:bg-rose-50"
                                )}
                                onClick={() => !previredPaid && setPreviredDialog(true)}
                                disabled={previredPaid}
                            >
                                {previredPaid ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                {previredPaid ? "Previred Pagado" : "Pagar Previred"}
                            </Button>
                        </>
                    )}
                    {payroll.status === 'DRAFT' && (
                        <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={handleDeletePayroll}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <Card className="max-w-4xl mx-auto shadow-xl border-t-4 border-t-primary overflow-hidden bg-white">
                {/* 1. DOCUMENT HEADER (RECOGNIZABLE) */}
                <CardHeader className="border-b pb-8 pt-10 px-10">
                    <div className="flex justify-between items-start gap-8">
                        <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/5 rounded-2xl">
                                    <Sparkles className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">
                                        Liquidación de Sueldo
                                    </h1>
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">
                                        Documento de Pago de Remuneraciones
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-4">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empleado</p>
                                    <p className="text-sm font-bold text-slate-900 leading-tight">
                                        {payroll.employee_detail?.contact_detail?.name}
                                    </p>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                        RUT: {payroll.employee_detail?.contact_detail?.tax_id}
                                    </p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periodo</p>
                                    <p className="text-sm font-bold text-slate-900">
                                        {payroll.period_label}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        Folio: <span className="font-mono">{payroll.display_id}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                            <Badge variant="outline" className={cn(
                                "px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                                isPosted ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
                            )}>
                                {payroll.status_display}
                            </Badge>
                            <div className="text-right pt-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Información Contractual</p>
                                <p className="text-[11px] text-slate-600 font-medium">{payroll.employee_detail?.position || "Personal"}</p>
                                <p className="text-[11px] text-slate-500 italic">{payroll.employee_detail?.department || "General"}</p>
                            </div>
                        </div>
                    </div>

                    {/* STATS BAR */}
                    <div className="mt-8 flex items-stretch divide-x border rounded-xl overflow-hidden bg-slate-50/50">
                        <div className="flex-1 p-3 text-center space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Días Pactados</p>
                            <p className="text-sm font-bold text-slate-900">{payroll.agreed_days || 0}</p>
                        </div>
                        <div className="flex-1 p-3 text-center space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Ausencias</p>
                            <p className="text-sm font-black text-rose-600">{payroll.absent_days || 0}</p>
                        </div>
                        <div className="flex-1 p-3 text-center space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Días Trabajados</p>
                            <p className="text-sm font-bold text-slate-900">{payroll.worked_days || 0}</p>
                        </div>
                        <div className="flex-1 p-3 text-center space-y-0.5 bg-primary/[0.02]">
                            <p className="text-[10px] font-bold text-primary/70 uppercase">Sueldo Base Liq.</p>
                            <MoneyDisplay amount={parseFloat(payroll.base_salary || "0")} className="text-sm font-black text-primary" />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="px-10 py-8">
                    {/* 2. CONSOLIDATED DETAIL TABLE */}
                    <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50 border-b">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-500 pl-6">Detalle de Conceptos</TableHead>
                                    <TableHead className="h-10 text-[10px] font-black uppercase tracking-widest text-emerald-600 text-right">Haberes (+)</TableHead>
                                    <TableHead className="h-10 text-[10px] font-black uppercase tracking-widest text-rose-500 text-right pr-6">Descuentos (-)</TableHead>
                                    {!isPosted && <TableHead className="h-10 w-[80px]"></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* HABERES SECTION */}
                                {haberes.map(item => (
                                    <ItemRow key={item.id} item={item} type="HABER" isPosted={isPosted} onEdit={setEditingItem} onDelete={handleDeleteItem} />
                                ))}
                                
                                <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-y">
                                    <TableCell className="py-2 pl-6 text-[11px] font-black text-slate-500 uppercase tracking-wider">Subtotal Haberes</TableCell>
                                    <TableCell className="py-2 text-right">
                                        <MoneyDisplay amount={parseFloat(payroll.total_haberes || "0")} className="text-sm font-black text-emerald-600" />
                                    </TableCell>
                                    <TableCell colSpan={isPosted ? 1 : 2}></TableCell>
                                </TableRow>

                                {/* DESCUENTOS SECTION */}
                                {workerLegalDiscounts.map(item => (
                                    <ItemRow key={item.id} item={item} type="DESCUENTO" isPosted={isPosted} onEdit={setEditingItem} onDelete={handleDeleteItem} />
                                ))}
                                {otherDiscounts.map(item => (
                                    <ItemRow key={item.id} item={item} type="DESCUENTO" isPosted={isPosted} onEdit={setEditingItem} onDelete={handleDeleteItem} />
                                ))}

                                <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-y">
                                    <TableCell className="py-2 pl-6 text-[11px] font-black text-slate-500 uppercase tracking-wider">Subtotal Descuentos</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="py-2 text-right pr-6">
                                        <MoneyDisplay amount={parseFloat(payroll.total_descuentos || "0")} className="text-sm font-black text-rose-500" />
                                    </TableCell>
                                    {!isPosted && <TableCell></TableCell>}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    {!isPosted && (
                        <div className="mt-4 flex justify-end">
                            <PayrollItemDialog
                                payrollId={payrollId}
                                concepts={concepts}
                                item={editingItem}
                                onSaved={fetchPayroll}
                                onEditCleared={() => setEditingItem(null)}
                                trigger={
                                    <Button variant="outline" size="sm" className="h-8 gap-2 border-dashed bg-primary/5 border-primary/30 text-primary hover:bg-primary/10">
                                        <Plus className="h-3.5 w-3.5" /> Agregar Concepto Manual
                                    </Button>
                                }
                            />
                        </div>
                    )}

                    {/* 3. TOTALS & FINAL CALCULATION */}
                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div className="space-y-4 pt-2">
                             {/* APORTES PATRONALES (INFORMATIVO PERO LIMPIO) */}
                             {employerContributions.length > 0 && (
                                <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                        <AlertCircle className="h-3 w-3" /> Costo Empresa / Aportes Patronales
                                    </h3>
                                    <div className="space-y-1.5 pt-1">
                                        {employerContributions.map(c => (
                                            <div key={c.id} className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-600">{c.concept_detail?.name}</span>
                                                <MoneyDisplay amount={parseFloat(c.amount)} className="font-bold text-slate-900" />
                                            </div>
                                        ))}
                                    </div>
                                    {previredPaid && (
                                        <div className="pt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold uppercase tracking-tight">
                                            <CheckCircle2 className="h-3 w-3" /> Pagado vía Previred
                                        </div>
                                    )}
                                </div>
                             )}

                             {/* NOTES SECTION */}
                             {payroll.notes && (
                                <div className="p-4 space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Observaciones</span>
                                    <p className="text-xs text-slate-600 italic">"{payroll.notes}"</p>
                                </div>
                             )}
                        </div>

                        <div className="space-y-4">
                            {/* THE LIQUID CARD */}
                            <div className="p-6 rounded-2xl bg-primary shadow-[0_10px_40px_-15px_rgba(var(--primary),0.3)] border border-primary text-white space-y-1 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                    <DollarSign className="h-16 w-16" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Líquido de Remuneración</p>
                                <MoneyDisplay amount={netSalary} className="text-4xl font-black tracking-tight" />
                                <div className="pt-2 flex items-center gap-2 text-[10px] font-medium opacity-80">
                                    <Clock className="h-3 w-3" /> Generado para el {payroll.period_label}
                                </div>
                            </div>

                            {/* ADVANCES HISTORY (AS REQUESTED: SUBTLE AUDIT TRAIL) */}
                            {payroll.advances && payroll.advances.length > 0 && (
                                <div className="bg-rose-50/50 rounded-xl border border-rose-100 p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Anticipos Entregados</h4>
                                        <span className="text-[10px] font-bold text-rose-400">(-) Descuento</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {payroll.advances.map(adv => (
                                            <div key={adv.id} className="flex justify-between items-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-slate-700">Anticipo de Sueldo</span>
                                                    <span className="text-[9px] text-slate-400 uppercase font-medium">
                                                        {new Date(adv.date).toLocaleDateString('es-CL')} • {adv.payment_method_name || "Manual"}
                                                    </span>
                                                </div>
                                                <MoneyDisplay amount={parseFloat(adv.amount)} className="text-xs font-black text-rose-600" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-3 border-t border-rose-100 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-rose-600">Saldo Final a Pagar</span>
                                        <MoneyDisplay 
                                            amount={netSalary - (payroll.advances?.reduce((s, a) => s + parseFloat(a.amount), 0) || 0)} 
                                            className="text-xl font-black text-rose-700 tracking-tight" 
                                        />
                                    </div>
                                </div>
                            )}

                            {/* PAYMENT STATUS FOOTER */}
                            {isPosted && (
                                <div className={cn(
                                    "p-4 rounded-xl border flex items-center justify-between",
                                    salaroPaid ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-200"
                                )}>
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("p-1.5 rounded-full", salaroPaid ? "bg-emerald-100" : "bg-slate-200")}>
                                            {salaroPaid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Clock className="h-3.5 w-3.5 text-slate-500" />}
                                        </div>
                                        <span className={cn("text-[10px] font-black uppercase tracking-wider", salaroPaid ? "text-emerald-700" : "text-slate-500")}>
                                            {salaroPaid ? "Pago Completado" : "Pendiente de Pago"}
                                        </span>
                                    </div>
                                    {salaroPaid && <p className="text-[10px] font-bold text-emerald-600">100% Salido de Tesorería</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. LEGAL FOOTER (PROFESSIONAL TOUCH) */}
                    <div className="mt-16 pt-8 border-t grid grid-cols-2 gap-20">
                        <div className="space-y-4">
                            <div className="h-px w-full bg-slate-300 mb-2"></div>
                            <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Firma del Empleador</p>
                        </div>
                        <div className="space-y-4">
                            <div className="h-px w-full bg-slate-300 mb-2"></div>
                            <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Firma del Trabajador</p>
                        </div>
                    </div>
                    <div className="mt-12 text-center">
                        <p className="text-[9px] text-slate-400 font-medium">
                            Este documento sirve como comprobante de pago de remuneraciones según lo estipulado en el Código del Trabajo.
                        </p>
                        <p className="text-[9px] text-slate-300 mt-1">
                            Generado por ERPGrafico • {new Date().toLocaleString()}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Dialogs */}
            <PaymentDialog
                open={salaryDialog}
                onOpenChange={setSalaryDialog}
                title="Registrar Pago de Sueldo"
                total={netSalary}
                pendingAmount={netSalary}
                isPurchase={true} 
                hideDteFields={true}
                onConfirm={async (data) => {
                    await paySalary(payrollId, data)
                    toast.success("Pago de sueldo registrado")
                    fetchPayroll()
                    setSalaryDialog(false)
                }}
            />
            <PaymentDialog
                open={previredDialog}
                onOpenChange={setPreviredDialog}
                title="Registrar Pago de Previred"
                total={workerDiscountsTotal + employerContributions.reduce((s, i) => s + parseFloat(i.amount), 0)}
                pendingAmount={workerDiscountsTotal + employerContributions.reduce((s, i) => s + parseFloat(i.amount), 0)}
                isPurchase={true}
                hideDteFields={true}
                onConfirm={async (data) => {
                    await payPrevired(payrollId, data)
                    toast.success("Pago de Previred registrado")
                    fetchPayroll()
                    setPreviredDialog(false)
                }}
            />
        </div>
    )
}


function PayrollItemDialog({ payrollId, item, concepts, onSaved, onEditCleared, trigger }: {
    payrollId: number, item: PayrollItem | null, concepts: PayrollConcept[], onSaved: () => void, onEditCleared: () => void, trigger?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => { if (item) setOpen(true) }, [item])

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: { concept: "", description: "", amount: "0" }
    })

    useEffect(() => {
        if (item) {
            form.reset({
                concept: item.concept.toString(),
                description: item.description,
                amount: item.amount,
            })
        } else if (open) {
            form.reset({ concept: concepts[0]?.id.toString() || "", description: "", amount: "0" })
        }
    }, [item, open, concepts, form])

    const onSubmit = async (data: ItemFormValues) => {
        setSaving(true)
        try {
            const payload = { ...data, concept: parseInt(data.concept), payroll: payrollId }
            if (item) {
                await updatePayrollItem(payrollId, item.id, payload as any)
            } else {
                await createPayrollItem(payrollId, payload as any)
            }
            onSaved()
            setOpen(false)
            onEditCleared()
        } catch {
            toast.error("Error al guardar ítem")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onEditCleared() }}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{item ? "Editar Línea" : "Agregar Línea"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="concept" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Concepto</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {concepts.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Monto ($)</FormLabel>
                                <FormControl><Input {...field} type="number" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Descripción Opcional</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
