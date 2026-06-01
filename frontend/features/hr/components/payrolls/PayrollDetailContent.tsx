"use client"

import React, { useState, useEffect } from "react"
import { usePayrollDetail } from "@/features/hr/hooks/usePayrolls"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    postPayroll, generateProformaPayroll, deletePayroll,
    createPayrollItem, updatePayrollItem, deletePayrollItem, payPrevired, paySalary,
} from '@/features/hr/api/hrApi'
import { PaymentModal } from "@/features/treasury/components/PaymentModal"
import type { PayrollItem, PayrollConcept, PayrollPayment, SalaryAdvance } from "@/types/hr"
import { Button } from "@/components/ui/button"

import {
    Form, FormField
} from "@/components/ui/form"
import { ActionConfirmModal, ActionSlideButton, BaseModal, CancelButton, FormFooter, LabeledInput, LabeledSelect, StatusBadge } from '@/components/shared'

import {
    Loader2, BookOpen,
    DollarSign, ShieldCheck, Sparkles,
    CheckCircle2, FileText, ArrowLeft
} from "lucide-react"
import { DataCell } from "@/components/shared"
import { SkeletonShell } from "@/components/shared"
import { PayrollCard } from "@/features/hr/components/PayrollCard"
import { cn } from "@/lib/utils"

import { useConfirmAction } from "@/hooks/useConfirmAction"
;

const itemSchema = z.object({
    concept: z.string().min(1, "Concepto requerido"),
    description: z.string().optional(),
    amount: z.string().min(1).refine(v => parseFloat(v) >= 0, "El monto debe ser mayor o igual a 0"),
})
type ItemFormValues = z.infer<typeof itemSchema>

interface EmployeeBasic {
    id: number
    contact_detail?: { name?: string; tax_id?: string } | null
    position?: string | null
    department?: string | null
}

interface PayrollDetailContentProps {
    payrollId: number
    onClose?: () => void
    onUpdate?: () => void
    isSheet?: boolean
    viewMode?: 'admin' | 'employee'
    employee?: EmployeeBasic
    onHeaderDataChange?: (data: {
        title: React.ReactNode | string
        subtitle: React.ReactNode | string
        icon?: any
        headerActions?: React.ReactNode
    }) => void
}

export function PayrollDetailContent({
    payrollId,
    onClose,
    onUpdate,
    isSheet = false,
    viewMode = 'admin',
    employee,
    onHeaderDataChange
}: PayrollDetailContentProps) {
    const router = useRouter()

    const [posting, setPosting] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [editingItem, setEditingItem] = useState<PayrollItem | null>(null)
    const [previredDialog, setPreviredDialog] = useState(false)
    const [salaryDialog, setSalaryDialog] = useState(false)
    const [postConfirmOpen, setPostConfirmOpen] = useState(false)

    const { data: payrollData, isLoading: loading, refetch: fetchPayroll } = usePayrollDetail(payrollId, viewMode, employee)

    const payroll = payrollData?.payroll || null
    const concepts = payrollData?.concepts || []
    const payments = payrollData?.payments || []

    const handlePost = async () => {
        setPosting(true)
        try {
            await postPayroll(payrollId)
            fetchPayroll()
            toast.success("Liquidación contabilizada")
            onUpdate?.()
        } catch (e: unknown) {
            showApiError(e, "Error al contabilizar")
        } finally {
            setPosting(false)
        }
    }

    const handleGenerateProforma = async () => {
        if (!payroll) return
        setGenerating(true)
        try {
            await generateProformaPayroll({
                employee: payroll.employee,
                period_year: payroll.period_year,
                period_month: payroll.period_month
            })
            fetchPayroll()
            toast.success("Propuesta generada exitosamente")
            onUpdate?.()
        } catch (e: unknown) {
            showApiError(e, "Error al generar propuesta")
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
        } catch (error) {
            showApiError(error, "Error al eliminar liquidación")
        }
    })

    const handleDeletePayroll = () => deleteConfirm.requestConfirm()

    const handleDeleteItem = async (item: PayrollItem) => {
        try {
            await deletePayrollItem(payrollId, item.id)
            toast.success("Línea eliminada")
            fetchPayroll()
            onUpdate?.()
        } catch (error) {
            showApiError(error, "Error al eliminar")
        }
    }

    const isPosted = payroll?.status === 'POSTED'
    const salaroPaid = payments.some((p: PayrollPayment) => p.payment_type === 'SALARIO')
    const previredPaid = payments.some((p: PayrollPayment) => p.payment_type === 'PREVIRED')

    const netSalary = parseFloat(payroll?.net_salary || "0")
    const totalAdvances = payroll?.advances?.reduce((s: number, a: SalaryAdvance) => s + parseFloat(a.amount), 0) || 0
    const totalSalaryPaid = payments.filter((p: PayrollPayment) => p.payment_type === 'SALARIO').reduce((s: number, p: PayrollPayment) => s + parseFloat(p.amount), 0)
    const pendingSalary = Math.max(0, netSalary - totalAdvances - totalSalaryPaid)

    const workerLegalDiscounts = payroll?.items?.filter((i: PayrollItem) => i.concept_detail?.category === 'DESCUENTO_LEGAL_TRABAJADOR') || []

    useEffect(() => {
        if (isSheet && onHeaderDataChange && payroll) {
            onHeaderDataChange({
                title: (
                    <div className="flex items-center gap-2">
                        <span>{isPosted ? "Liquidación" : "Borrador de Liquidación"}</span>
                        <StatusBadge
                            status={isPosted ? "posted" : "draft"}
                            size="md"
                        />
                    </div>
                ),
                subtitle: (
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                        <span className="font-bold text-primary/80">{payroll.display_id}</span>
                        <span className="opacity-30">|</span>
                        <span className="hidden sm:inline">{payroll.period_label}</span>
                        <span className="opacity-30 hidden sm:inline">|</span>
                        <span>{payroll.employee_name}</span>
                    </div>
                ),
                icon: FileText,
                headerActions: (
                    <div className="flex items-center gap-2 sm:gap-3">
                        {viewMode === 'admin' && !isPosted && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 border-primary/20 text-primary hover:bg-primary/5 px-2 sm:px-4 h-8 sm:h-9"
                                    onClick={handleGenerateProforma}
                                    disabled={generating}
                                >
                                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">Propuesta Inicial</span>
                                    <span className="sm:hidden">Propuesta</span>
                                </Button>

                                <Button
                                    size="sm"
                                    className="rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 "
                                    disabled={posting}
                                    onClick={() => setPostConfirmOpen(true)}
                                >
                                    {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                                    Contabilizar
                                </Button>
                            </>
                        )}
                        {viewMode === 'admin' && isPosted && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 transition-all",
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
                                        "rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 transition-all",
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
                            <DataCell.Action action="delete" onClick={handleDeletePayroll} />
                        )}
                    </div>
                )
            })
        }
    }, [isSheet, payroll, isPosted, generating, posting, salaroPaid, previredPaid, viewMode, onHeaderDataChange])

    if (loading) return <SkeletonShell isLoading ariaLabel="Cargando..." />

    if (!payroll) return (
        <div className="flex flex-col items-center justify-center p-24 text-muted-foreground gap-4">
            <FileText className="h-12 w-12 opacity-20" />
            <p className="font-medium uppercase tracking-widest text-xs opacity-50">Liquidación no encontrada</p>
        </div>
    )

    return (
        <div className={cn("flex-1 flex flex-col min-h-0", isSheet ? "w-full" : "space-y-6")}>
            {/* Header Section */}
            {!isSheet && (
                <div className="flex items-center justify-between px-0">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push('/hr/payrolls')}
                            className="rounded-sm h-10 w-10 text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-4">
                            <FileText className="h-6 w-6" />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h1 className="font-bold tracking-tight text-foreground text-2xl">
                                        {isPosted ? "Liquidación" : "Borrador de Liquidación"}
                                    </h1>
                                    <StatusBadge
                                        status={isPosted ? "posted" : "draft"}
                                        size="md"
                                    />
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
                                    className="rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 border-primary/20 text-primary hover:bg-primary/5 px-2 sm:px-4 h-8 sm:h-9"
                                    onClick={handleGenerateProforma}
                                    disabled={generating}
                                >
                                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">Propuesta Inicial</span>
                                    <span className="sm:hidden">Propuesta</span>
                                </Button>

                                <Button
                                    size="sm"
                                    className="rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 "
                                    disabled={posting}
                                    onClick={() => setPostConfirmOpen(true)}
                                >
                                    {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                                    Contabilizar
                                </Button>
                            </>
                        )}
                        {viewMode === 'admin' && isPosted && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 transition-all",
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
                                        "rounded-sm text-[10px] sm:text-xs font-bold gap-1.5 px-2 sm:px-4 h-8 sm:h-9 transition-all",
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
                            <DataCell.Action action="delete" onClick={handleDeletePayroll} />
                        )}
                    </div>
                </div>
            )}

            {/* Custom Close Button for Sheet (Top Right Corner) */}
            {/* Removed: Drawer already provides a close button */}

            {/* Scroll Area for Content */}
            <div className={cn("flex-1", isSheet ? "overflow-y-auto custom-scrollbar p-6" : "")}>
                <div className={cn(isSheet ? "max-w-4xl mx-auto pb-12" : "")}>
                    <PayrollCard
                        payroll={payroll}
                        isPosted={isPosted}
                        isSalaryPaid={salaroPaid}
                        isPreviredPaid={previredPaid}
                        payments={payments}
                        onEditItem={viewMode === 'admin' && !isPosted ? setEditingItem : undefined}
                        onDeleteItem={viewMode === 'admin' && !isPosted ? handleDeleteItem : undefined}
                        onAddItem={viewMode === 'admin' && !isPosted ? () => setEditingItem({ payroll: payrollId } as unknown as PayrollItem) : undefined}
                        isReadOnly={viewMode === 'employee' || isPosted}
                        showEmployerContributions={viewMode === 'admin'}
                        className={isSheet ? "" : ""}
                    />
                </div>
            </div>

            {/* Dialogs */}
            <PaymentModal
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
            <PaymentModal
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

            <ActionConfirmModal
                open={postConfirmOpen}
                onOpenChange={setPostConfirmOpen}
                onConfirm={handlePost}
                title="¿Contabilizar liquidación?"
                description="Se generarán los asientos contables asociados a los haberes y retenciones legales. Esta acción bloqueará la edición de la liquidación."
                variant="destructive"
                confirmText="Confirmar y Contabilizar"
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
        if (item && item.id) {
            form.reset({
                concept: item.concept?.toString() || "",
                description: item.description || "",
                amount: item.amount || "0",
            })
        } else if (open || (item && !item.id)) {
            form.reset({ concept: concepts[0]?.id.toString() || "", description: "", amount: "0" })
        }
    }, [item, open, concepts, form])

    const onSubmit = async (data: ItemFormValues) => {
        setSaving(true)
        try {
            const payload = { ...data, concept: parseInt(data.concept), payroll: payrollId }
            if (item && item.id) {
                await updatePayrollItem(payrollId, item.id, payload as unknown as Partial<PayrollItem>)
            } else {
                await createPayrollItem(payrollId, payload as unknown as Partial<PayrollItem>)
            }
            onSaved()
            setOpen(false)
            onEditCleared()
        } catch (error) {
            showApiError(error, "Error al guardar ítem")
        } finally {
            setSaving(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={(o) => { setOpen(o); if (!o) onEditCleared() }}
            icon={Sparkles}
            title={item && item.id ? "Editar Línea" : "Nueva Línea"}
            description="Itemización • Liquidación de Remuneraciones"
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => { setOpen(false); onEditCleared(); }} />
                            <ActionSlideButton
                                form="payroll-item-form"
                                type="submit"
                                disabled={saving}
                            >
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {item && item.id ? "Actualizar Item" : "Añadir a Liquidación"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form
                    id="payroll-item-form"
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-5 text-left py-2"
                >
                    <FormField control={form.control} name="concept" render={({ field, fieldState }) => (
                        <LabeledSelect
                            label="Concepto de Remuneración"
                            value={field.value}
                            onChange={field.onChange}
                            error={fieldState.error?.message}
                            placeholder="Seleccionar..."
                            options={concepts.map(c => ({
                                value: c.id.toString(),
                                label: c.name
                            }))}
                        />
                    )} />

                    <FormField control={form.control} name="amount" render={({ field, fieldState }) => (
                        <LabeledInput
                            {...field}
                            type="number"
                            label="Monto ($)"
                            error={fieldState.error?.message}
                            className="font-bold text-lg"
                        />
                    )} />

                    <FormField control={form.control} name="description" render={({ field, fieldState }) => (
                        <LabeledInput
                            {...field}
                            label="Observaciones (Opcional)"
                            placeholder="Detalle adicional..."
                            error={fieldState.error?.message}
                        />
                    )} />
                </form>
            </Form>
        </BaseModal>
    )
}
