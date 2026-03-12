
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

            <Card className="max-w-5xl mx-auto shadow-sm">
                {/* ENCABEZADO HOJA UNICA */}
                <CardHeader className="border-b bg-muted/20 pb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-2xl font-black uppercase tracking-wider">
                                    Liquidación de Sueldo
                                </CardTitle>
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        "text-[10px] font-bold uppercase",
                                        isPosted
                                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                    )}
                                >
                                    {payroll.status_display}
                                </Badge>
                            </div>
                            <CardDescription className="text-sm mt-1">
                                <span className="font-bold text-foreground">{payroll.employee_detail?.contact_detail?.name}</span> • {payroll.period_label}
                            </CardDescription>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="font-mono text-xs text-muted-foreground mr-1">Folio: <span className="font-bold text-foreground">{payroll.display_id}</span></div>
                            <div className="font-mono text-[10px] text-muted-foreground mr-1">RUT: {payroll.employee_detail?.contact_detail?.tax_id}</div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-6 items-center bg-background rounded-md border p-4 shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Días Pactados</span>
                            <span className="font-mono text-sm">{payroll.agreed_days || 0}</span>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Inasistencias</span>
                            <span className="font-mono text-sm text-amber-600 font-bold">{payroll.absent_days || 0}</span>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Días Trabajados</span>
                            <span className="font-mono text-sm text-emerald-600 font-bold">{payroll.worked_days || 0}</span>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Sueldo Base Liq.</span>
                            <MoneyDisplay amount={parseFloat(payroll.base_salary || "0")} className="font-mono text-sm" />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">

                        {/* IZQUIERDA: HABERES */}
                        <div className="p-6">
                            <div className="flex flex-row items-center justify-between pb-3">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" /> Haberes
                                </h3>
                                {!isPosted && (
                                    <PayrollItemDialog
                                        payrollId={payrollId}
                                        concepts={concepts.filter(c => c.category.startsWith('HABER'))}
                                        item={editingItem && (editingItem.concept_detail?.category.startsWith('HABER')) ? editingItem : null}
                                        onSaved={fetchPayroll}
                                        onEditCleared={() => setEditingItem(null)}
                                        trigger={
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase font-bold text-muted-foreground">
                                                <Plus className="h-3 w-3 mr-1" /> Agregar
                                            </Button>
                                        }
                                    />
                                )}
                            </div>
                            <ItemsTable
                                items={haberes}
                                isPosted={isPosted}
                                onEdit={setEditingItem}
                                onDelete={handleDeleteItem}
                                accentColor="text-emerald-700 font-black"
                            />

                            <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm font-bold">
                                <span>Total Haberes</span>
                                <MoneyDisplay amount={parseFloat(payroll.total_haberes || "0")} className="text-emerald-600 text-lg font-black" />
                            </div>
                        </div>

                        {/* DERECHA: DESCUENTOS SEPARADOS */}
                        <div className="p-6 space-y-5">

                            {/* Descuentos Legales del Trabajador */}
                            <div>
                                <div className="flex flex-row items-center justify-between pb-3">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-amber-600 flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4" /> Descuentos Legales
                                    </h3>
                                    {!isPosted && (
                                        <PayrollItemDialog
                                            payrollId={payrollId}
                                            concepts={concepts.filter(c => c.category === 'DESCUENTO_LEGAL_TRABAJADOR')}
                                            item={editingItem && editingItem.concept_detail?.category === 'DESCUENTO_LEGAL_TRABAJADOR' ? editingItem : null}
                                            onSaved={fetchPayroll}
                                            onEditCleared={() => setEditingItem(null)}
                                            trigger={
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase font-bold text-muted-foreground">
                                                    <Plus className="h-3 w-3 mr-1" /> Agregar
                                                </Button>
                                            }
                                        />
                                    )}
                                </div>
                                <ItemsTable
                                    items={workerLegalDiscounts}
                                    isPosted={isPosted}
                                    onEdit={setEditingItem}
                                    onDelete={handleDeleteItem}
                                    accentColor="text-amber-700"
                                />
                                <div className="mt-2 pt-2 border-t flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground font-semibold uppercase">Subtotal Desc. Legales</span>
                                    <MoneyDisplay amount={workerDiscountsTotal} className="text-amber-700 font-bold" />
                                </div>
                            </div>

                            <Separator />

                            {/* Otros Descuentos */}
                            <div>
                                <div className="flex flex-row items-center justify-between pb-3">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-rose-500 flex items-center gap-2">
                                        <TrendingDown className="h-4 w-4" /> Otros Descuentos
                                    </h3>
                                    {!isPosted && (
                                        <PayrollItemDialog
                                            payrollId={payrollId}
                                            concepts={concepts.filter(c => c.category === 'OTRO_DESCUENTO')}
                                            item={editingItem && editingItem.concept_detail?.category === 'OTRO_DESCUENTO' ? editingItem : null}
                                            onSaved={fetchPayroll}
                                            onEditCleared={() => setEditingItem(null)}
                                            trigger={
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase font-bold text-muted-foreground">
                                                    <Plus className="h-3 w-3 mr-1" /> Agregar
                                                </Button>
                                            }
                                        />
                                    )}
                                </div>
                                <ItemsTable
                                    items={otherDiscounts}
                                    isPosted={isPosted}
                                    onEdit={setEditingItem}
                                    onDelete={handleDeleteItem}
                                    accentColor="text-rose-600"
                                />
                                <div className="mt-2 pt-2 border-t flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground font-semibold uppercase">Total Desc.</span>
                                    <MoneyDisplay amount={parseFloat(payroll.total_descuentos || "0")} className="text-rose-600 font-bold" />
                                </div>
                            </div>

                            <Separator />

                            {/* LIQUIDO A PAGO */}
                            <div className="bg-primary/5 p-5 rounded-xl border border-primary/20 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <DollarSign className="h-5 w-5 text-primary" />
                                    </div>
                                    <span className="text-sm font-black uppercase tracking-widest text-primary">Sueldo Líquido</span>
                                </div>
                                <MoneyDisplay amount={netSalary} className="text-3xl font-black text-primary" />
                            </div>

                            {/* ANTICIPOS (DESPUES DEL LIQUIDO) */}
                            {payroll.advances && payroll.advances.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-dashed">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 pb-2">
                                        <Clock className="h-3 w-3" /> Anticipos Entregados (Ya pagados)
                                    </h3>
                                    <div className="space-y-1">
                                        {payroll.advances.map(adv => (
                                            <div key={adv.id} className="flex justify-between items-center text-xs py-1 px-2 rounded bg-muted/20 border border-transparent hover:border-muted-foreground/10 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">Anticipo de Sueldo</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(adv.date).toLocaleDateString('es-CL')} • {adv.payment_method_name || "Manual"}
                                                    </span>
                                                </div>
                                                <MoneyDisplay amount={parseFloat(adv.amount)} className="font-bold text-rose-600" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex justify-between items-center px-2 py-2 rounded-lg bg-primary/10 border border-primary/20">
                                        <span className="text-[10px] font-black uppercase text-primary">Saldo Final a Pagar</span>
                                        <MoneyDisplay 
                                            amount={netSalary - (payroll.advances?.reduce((s, a) => s + parseFloat(a.amount), 0) || 0)} 
                                            className="text-lg font-black text-primary" 
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Remuneraciones por Pagar */}
                            {isPosted && (
                                <div className="flex items-center justify-between px-1 py-2 rounded-lg bg-muted/30">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                                        {salaroPaid
                                            ? <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Remuneración Pagada</>
                                            : <><Clock className="h-3 w-3 text-amber-500" /> Remuneraciones por Pagar</>
                                        }
                                    </div>
                                    <MoneyDisplay amount={netSalary} className={cn("text-sm font-bold", salaroPaid ? "text-emerald-600" : "text-amber-600")} />
                                </div>
                            )}

                            {/* APORTES EMPLEADOR (INFORMATIVO) */}
                            {employerContributions.length > 0 && (
                                <div className="pt-2 border-t border-dashed">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 pb-3 mb-2">
                                        <AlertCircle className="h-3 w-3" /> Aportes del Empleador
                                    </h3>
                                    <ItemsTable
                                        items={employerContributions}
                                        isPosted={isPosted}
                                        onEdit={setEditingItem}
                                        onDelete={handleDeleteItem}
                                        accentColor="text-muted-foreground"
                                    />
                                    {previredPaid && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                                            <CheckCircle2 className="h-3 w-3" /> Previred pagado
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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

function ItemsTable({ items, isPosted, onEdit, onDelete, accentColor }: {
    items: PayrollItem[], isPosted: boolean, onEdit: (i: PayrollItem) => void, onDelete: (i: PayrollItem) => void, accentColor: string
}) {
    if (items.length === 0) return <div className="px-4 py-4 text-center text-xs text-muted-foreground italic">Sin movimientos</div>
    return (
        <Table>
            <TableBody>
                {items.map(item => (
                    <TableRow key={item.id} className="group">
                        <TableCell className="py-2">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold">{item.concept_detail?.name}</span>
                                {item.description && <span className="text-[10px] text-muted-foreground">{item.description}</span>}
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-2 px-4">
                            <MoneyDisplay amount={parseFloat(item.amount)} className={cn("text-xs font-bold", accentColor)} />
                        </TableCell>
                        {!isPosted && (
                            <TableCell className="w-[80px] p-0 pr-2">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => { if (confirm("¿Eliminar?")) onDelete(item) }}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
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
