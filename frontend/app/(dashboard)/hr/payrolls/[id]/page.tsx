
"use client"

import React, { useState, useEffect, useCallback, use } from "react"
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
    CreditCard, CheckCircle2, Clock, FileText
} from "lucide-react"
import { PayrollCard } from "@/components/hr/PayrollCard"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { FORM_STYLES } from "@/lib/styles"

const itemSchema = z.object({
    concept: z.string().min(1, "Concepto requerido"),
    description: z.string().optional(),
    amount: z.string().min(1).refine(v => parseFloat(v) >= 0, "El monto debe ser mayor o igual a 0"),
})
type ItemFormValues = z.infer<typeof itemSchema>


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
    
    // Calculate REAL pending amounts
    const totalAdvances = payroll.advances?.reduce((s, a) => s + parseFloat(a.amount), 0) || 0
    const totalSalaryPaid = payments.filter(p => p.payment_type === 'SALARIO').reduce((s, p) => s + parseFloat(p.amount), 0)
    const pendingSalary = Math.max(0, netSalary - totalAdvances - totalSalaryPaid)
    
    const totalPreviredRequired = (workerLegalDiscounts.reduce((s, i) => s + parseFloat(i.amount), 0)) + employerContributions.reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalPreviredPaid = payments.filter(p => p.payment_type === 'PREVIRED').reduce((s, p) => s + parseFloat(p.amount), 0)
    const pendingPrevired = Math.max(0, totalPreviredRequired - totalPreviredPaid)

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => router.push('/hr/payrolls')} 
                        className="rounded-xl h-10 w-10 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm border border-primary/5">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    {isPosted ? "Liquidación" : "Borrador de Liquidación"}
                                </h1>
                                <Badge variant={isPosted ? "success" : "warning"} className="rounded-lg text-[10px] uppercase font-black px-2 h-5">
                                    {isPosted ? "Contabilizado" : "Borrador"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                                <span className="font-bold text-primary/80">{payroll.display_id}</span>
                                <span className="opacity-30">|</span>
                                <span>{payroll.period_label}</span>
                                <span className="opacity-30">|</span>
                                <span>{payroll.employee_name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isPosted && (
                        <>
                            <Button
                                variant="outline" 
                                size="sm"
                                className="rounded-xl text-xs font-bold gap-2 border-primary/20 text-primary hover:bg-primary/5 px-4 h-9"
                                onClick={handleGenerateProforma}
                                disabled={generating}
                            >
                                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                Propuesta Inicial
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" className="rounded-xl text-xs font-bold gap-2 px-4 h-9 shadow-lg shadow-primary/20" disabled={posting}>
                                        {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                                        Contabilizar
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-bold tracking-tight">¿Contabilizar liquidación?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm">
                                            Se generarán los asientos contables asociados a los haberes y retenciones legales. 
                                            Esta acción bloqueará la edición de la liquidación.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-4 gap-3">
                                        <AlertDialogCancel className="rounded-xl font-bold text-xs border-primary/10">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handlePost} className="rounded-xl font-bold text-xs bg-primary hover:bg-primary/90">
                                            Confirmar y Contabilizar
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                    {isPosted && (
                        <>
                            <Button
                                variant="outline" 
                                size="sm"
                                className={cn(
                                    "rounded-xl text-xs font-bold gap-2 px-4 h-9 transition-all",
                                    salaroPaid
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                )}
                                onClick={() => !salaroPaid && setSalaryDialog(true)}
                                disabled={salaroPaid}
                            >
                                {salaroPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <DollarSign className="h-3.5 w-3.5" />}
                                {salaroPaid ? "Sueldo Pagado" : "Pagar Sueldo"}
                            </Button>
                            <Button
                                variant="outline" 
                                size="sm"
                                className={cn(
                                    "rounded-xl text-xs font-bold gap-2 px-4 h-9 transition-all",
                                    previredPaid
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                )}
                                onClick={() => !previredPaid && setPreviredDialog(true)}
                                disabled={previredPaid}
                            >
                                {previredPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                {previredPaid ? "Previred Pagado" : "Pagar Previred"}
                            </Button>
                        </>
                    )}
                    {payroll.status === 'DRAFT' && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50" 
                            onClick={handleDeletePayroll}
                        >
                            <Trash2 className="h-4.5 w-4.5" />
                        </Button>
                    )}
                </div>
            </div>

            <PayrollCard 
                payroll={payroll}
                isPosted={isPosted}
                isSalaryPaid={salaroPaid}
                isPreviredPaid={previredPaid}
                payments={payments}
                onEditItem={setEditingItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={() => setEditingItem({ payroll: payrollId } as any)}
            />

            {/* Payment Dialogs */}
            <PaymentDialog
                open={salaryDialog}
                onOpenChange={setSalaryDialog}
                title="Registrar Pago de Sueldo"
                total={pendingSalary}
                pendingAmount={pendingSalary}
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
                total={pendingPrevired}
                pendingAmount={pendingPrevired}
                isPurchase={true}
                hideDteFields={true}
                onConfirm={async (data) => {
                    await payPrevired(payrollId, data)
                    toast.success("Pago de Previred registrado")
                    fetchPayroll()
                    setPreviredDialog(false)
                }}
            />

            <PayrollItemDialog
                payrollId={payrollId}
                item={editingItem}
                concepts={concepts}
                onSaved={fetchPayroll}
                onEditCleared={() => setEditingItem(null)}
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
            <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-slate-100/50 backdrop-blur-sm">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-lg font-bold tracking-tight">
                                {item ? "Editar Línea" : "Nueva Línea"}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                                Itemización <span className="opacity-30">|</span> Liquidación
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0 text-left">
                        <div className="p-6 space-y-5 bg-white sm:rounded-b-2xl">
                            <FormField control={form.control} name="concept" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Concepto de Remuneración</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="rounded-xl h-11 transition-all focus:ring-primary/20">
                                                <SelectValue placeholder="Seleccionar..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            {concepts.map(c => (
                                                <SelectItem key={c.id} value={c.id.toString()} className="rounded-lg">
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Monto ($)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            type="number" 
                                            className="rounded-xl h-11 font-bold text-lg transition-all focus:ring-primary/20" 
                                        />
                                    </FormControl>
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Observaciones (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            className="rounded-xl h-11 transition-all focus:ring-primary/20" 
                                            placeholder="Detalle adicional..."
                                        />
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                        
                        <div className="flex justify-end gap-3 w-full px-6 py-4 border-t border-border/40 bg-muted/10">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => { setOpen(false); onEditCleared(); }}
                                className="rounded-xl text-xs font-bold border-primary/20 hover:bg-primary/5"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={saving}
                                className="rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20"
                            >
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {item ? "Actualizar Item" : "Añadir a Liquidación"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
