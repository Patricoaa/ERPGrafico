"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    getPayroll, postPayroll, generateProformaPayroll, deletePayroll,
    createPayrollItem, updatePayrollItem, deletePayrollItem,
    getPayrollConcepts, payPrevired, paySalary,
    getPayrollPayments
} from "@/lib/hr/api"
import { getEmployeePayrollPreview } from "@/lib/profile/api"
import { PaymentDialog } from "@/features/treasury/components/PaymentDialog"
import type { Payroll, PayrollItem, PayrollConcept, PayrollPayment } from "@/types/hr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import {
    Loader2, Trash2, BookOpen,
    DollarSign, ShieldCheck, Sparkles,
    CheckCircle2, FileText, ArrowLeft, X
} from "lucide-react"
import { PayrollCard } from "@/features/hr/components/PayrollCard"
import { cn } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { useConfirmAction } from "@/hooks/useConfirmAction"

const itemSchema = z.object({
    concept: z.string().min(1, "Concepto requerido"),
    description: z.string().optional(),
    amount: z.string().min(1).refine(v => parseFloat(v) >= 0, "El monto debe ser mayor o igual a 0"),
})
type ItemFormValues = z.infer<typeof itemSchema>

interface PayrollDetailContentProps {
    payrollId: number
    onClose?: () => void
    onUpdate?: () => void
    isSheet?: boolean
    viewMode?: 'admin' | 'employee'
    employee?: any
}

export function PayrollDetailContent({ payrollId, onClose, onUpdate, isSheet = false, viewMode = 'admin', employee }: PayrollDetailContentProps) {
    const router = useRouter()
    
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
            if (viewMode === 'employee') {
                const payrollData = await getEmployeePayrollPreview(payrollId)
                if (employee && payrollData) {
                    payrollData.employee_detail = payrollData.employee_detail || {
                        contact_detail: employee.contact_detail,
                        position: employee.position,
                        department: employee.department
                    }
                }
                setPayroll(payrollData)
                setPayments(payrollData.payments || [])
                // Concepts are not needed for employee view
                setConcepts([])
            } else {
                const [payrollData, conceptsData, paymentsData] = await Promise.all([
                    getPayroll(payrollId),
                    getPayrollConcepts(),
                    getPayrollPayments({ payroll: String(payrollId) })
                ])
                setPayroll(payrollData)
                setConcepts(conceptsData)
                setPayments(paymentsData)
            }
        } catch {
            toast.error("Error al cargar liquidación")
        } finally {
            setLoading(false)
        }
    }, [payrollId, viewMode])

    useEffect(() => { fetchPayroll() }, [fetchPayroll])

    const handlePost = async () => {
        setPosting(true)
        try {
            const updated = await postPayroll(payrollId)
            setPayroll(updated)
            toast.success("Liquidación contabilizada")
            onUpdate?.()
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
            onUpdate?.()
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Error al generar propuesta")
        } finally {
            setGenerating(false)
        }
    }

    const deleteConfirm = useConfirmAction(async () => {
        try {
            await deletePayroll(payrollId)
            toast.success("Liquidación eliminada")
            onUpdate?.()
            if (onClose) onClose()
            else router.push('/hr/payrolls')
        } catch {
            toast.error("Error al eliminar liquidación")
        }
    })

    const handleDeletePayroll = () => deleteConfirm.requestConfirm()

    const handleDeleteItem = async (item: PayrollItem) => {
        try {
            await deletePayrollItem(payrollId, item.id)
            toast.success("Línea eliminada")
            fetchPayroll()
            onUpdate?.()
        } catch {
            toast.error("Error al eliminar")
        }
    }

    if (loading) {
        return (
            <div className="flex h-[400px] flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!payroll) return (
        <div className="flex flex-col items-center justify-center p-24 text-muted-foreground gap-4">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="font-medium uppercase tracking-widest text-xs opacity-50">Liquidación no encontrada</p>
        </div>
    )

    const isPosted = payroll.status === 'POSTED'
    const salaroPaid = payments.some(p => p.payment_type === 'SALARIO')
    const previredPaid = payments.some(p => p.payment_type === 'PREVIRED')

    const netSalary = parseFloat(payroll.net_salary || "0")
    const totalAdvances = payroll.advances?.reduce((s, a) => s + parseFloat(a.amount), 0) || 0
    const totalSalaryPaid = payments.filter(p => p.payment_type === 'SALARIO').reduce((s, p) => s + parseFloat(p.amount), 0)
    const pendingSalary = Math.max(0, netSalary - totalAdvances - totalSalaryPaid)
    
    const workerLegalDiscounts = payroll.items?.filter(i => i.concept_detail?.category === 'DESCUENTO_LEGAL_TRABAJADOR') || []
    const employerContributions = payroll.items?.filter(i => i.concept_detail?.category === 'DESCUENTO_LEGAL_EMPLEADOR') || []
    const totalPreviredRequired = (workerLegalDiscounts.reduce((s, i) => s + parseFloat(i.amount), 0)) + employerContributions.reduce((s, i) => s + parseFloat(i.amount), 0)
    const totalPreviredPaid = payments.filter(p => p.payment_type === 'PREVIRED').reduce((s, p) => s + parseFloat(p.amount), 0)
    const pendingPrevired = Math.max(0, totalPreviredRequired - totalPreviredPaid)

    return (
        <div className={cn("flex-1 flex flex-col min-h-0", isSheet ? "w-full" : "space-y-6")}>
            {/* Header Section */}
            <div className={cn(
                "flex items-center justify-between",
                isSheet ? "px-6 py-4 border-b bg-background sticky top-0 z-50 rounded-tr-3xl" : "px-0"
            )}>
                <div className="flex items-center gap-4">
                    {!isSheet && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => router.push('/hr/payrolls')} 
                            className="rounded-lg h-10 w-10 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary shadow-sm border border-primary/5 hidden sm:block">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h1 className={cn("font-bold tracking-tight text-foreground", isSheet ? "text-xl" : "text-2xl")}>
                                    {isPosted ? "Liquidación" : "Borrador de Liquidación"}
                                </h1>
                                <Badge variant={isPosted ? "success" : "warning"} className="rounded-lg text-[9px] uppercase font-black px-2 h-4.5">
                                    {isPosted ? "Contabilizado" : "Borrador"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                                <span className="font-bold text-primary/80">{payroll.display_id}</span>
                                <span className="opacity-30">|</span>
                                <span className="hidden sm:inline">{payroll.period_label}</span>
                                <span className="opacity-30 hidden sm:inline">|</span>
                                <span>{payroll.employee_name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {viewMode === 'admin' && !isPosted && (
                        <>
                            <Button
                                variant="outline" 
                                size="sm"
                                className="rounded-lg text-[10px] sm:text-xs font-bold gap-1.5 border-primary/20 text-primary hover:bg-primary/5 px-2 sm:px-4 h-8 sm:h-9"
                                onClick={handleGenerateProforma}
                                disabled={generating}
                            >
                                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">Propuesta Inicial</span>
                                <span className="sm:hidden">Propuesta</span>
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" className="rounded-lg text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 shadow-lg shadow-primary/20" disabled={posting}>
                                        {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                                        Contabilizar
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-lg border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-bold tracking-tight">¿Contabilizar liquidación?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm">
                                            Se generarán los asientos contables asociados a los haberes y retenciones legales. 
                                            Esta acción bloqueará la edición de la liquidación.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-4 gap-3">
                                        <AlertDialogCancel className="rounded-lg font-bold text-xs border-primary/10">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handlePost} className="rounded-lg font-bold text-xs bg-primary hover:bg-primary/90">
                                            Confirmar y Contabilizar
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                    {viewMode === 'admin' && isPosted && (
                        <>
                            <Button
                                variant="outline" 
                                size="sm"
                                className={cn(
                                    "rounded-lg text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 transition-all",
                                    salaroPaid
                                        ? "bg-success/10 text-success border-success/20"
                                        : "bg-warning/10 text-warning border-warning/20 hover:bg-warning/10"
                                )}
                                onClick={() => !salaroPaid && setSalaryDialog(true)}
                                disabled={salaroPaid}
                            >
                                {salaroPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <DollarSign className="h-3.5 w-3.5" />}
                                {salaroPaid ? "Pagado" : "Pagar Sueldo"}
                            </Button>
                            <Button
                                variant="outline" 
                                size="sm"
                                className={cn(
                                    "rounded-lg text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 transition-all",
                                    previredPaid
                                        ? "bg-success/10 text-success border-success/20"
                                        : "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                                )}
                                onClick={() => !previredPaid && setPreviredDialog(true)}
                                disabled={previredPaid}
                            >
                                {previredPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                {previredPaid ? "Previred" : "Pagar Previred"}
                            </Button>
                        </>
                    )}
                    
                    {viewMode === 'admin' && !isPosted && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-destructive hover:bg-destructive/10" 
                            onClick={handleDeletePayroll}
                        >
                            <Trash2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        </Button>
                    )}

                    {isSheet && (
                        <div className="flex items-center gap-2 ml-4 pr-10">
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Close Button for Sheet (Top Right Corner) */}
            {isSheet && (
                <SheetCloseButton 
                    onClick={onClose!} 
                    className="absolute top-4 right-4 z-[60] bg-muted/50 backdrop-blur-sm border shadow-sm"
                />
            )}

            {/* Scroll Area for Content */}
            <div className={cn("flex-1", isSheet ? "overflow-y-auto custom-scrollbar p-6 bg-muted/30" : "")}>
                <div className={cn(isSheet ? "max-w-4xl mx-auto pb-12" : "")}>
                    <PayrollCard 
                        payroll={payroll}
                        isPosted={isPosted}
                        isSalaryPaid={salaroPaid}
                        isPreviredPaid={previredPaid}
                        payments={payments}
                        onEditItem={viewMode === 'admin' ? setEditingItem : undefined}
                        onDeleteItem={viewMode === 'admin' ? handleDeleteItem : undefined}
                        onAddItem={viewMode === 'admin' ? () => setEditingItem({ payroll: payrollId } as any) : undefined}
                        isReadOnly={viewMode === 'employee'}
                        showEmployerContributions={viewMode === 'admin'}
                        className={isSheet ? "shadow-2xl shadow-border/20" : ""}
                    />
                </div>
            </div>

            {/* Dialogs */}
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
                    onUpdate?.()
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
                    onUpdate?.()
                    setPreviredDialog(false)
                }}
            />

            <PayrollItemDialog
                payrollId={payrollId}
                item={editingItem}
                concepts={concepts}
                onSaved={() => {
                    fetchPayroll()
                    onUpdate?.()
                }}
                onEditCleared={() => setEditingItem(null)}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Liquidación"
                description="¿Eliminar esta liquidación? Esta acción no se puede deshacer."
                variant="destructive"
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
        <BaseModal
            open={open}
            onOpenChange={(o) => { setOpen(o); if (!o) onEditCleared() }}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
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
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setOpen(false); onEditCleared(); }}
                        className="rounded-lg text-xs font-bold border-primary/20 hover:bg-primary/5"
                    >
                        Cancelar
                    </Button>
                    <Button
                        form="payroll-item-form"
                        type="submit"
                        disabled={saving}
                        className="rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
                    >
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {item ? "Actualizar Item" : "Añadir a Liquidación"}
                    </Button>
                </div>
            }
        >
            <Form {...form}>
                <form 
                    id="payroll-item-form"
                    onSubmit={form.handleSubmit(onSubmit)} 
                    className="space-y-5 text-left py-2"
                >
                    <FormField control={form.control} name="concept" render={({ field }) => (
                        <FormItem>
                            <FormLabel className={FORM_STYLES.label}>Concepto de Remuneración</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="rounded-lg h-11 transition-all focus:ring-primary/20">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-lg">
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
                                    className="rounded-lg h-11 font-bold text-lg transition-all focus:ring-primary/20"
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
                                    className="rounded-lg h-11 transition-all focus:ring-primary/20"
                                    placeholder="Detalle adicional..."
                                />
                            </FormControl>
                        </FormItem>
                    )} />
                </form>
            </Form>
        </BaseModal>
    )
}
