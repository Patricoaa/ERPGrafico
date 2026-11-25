"use client"

import { useCallback, useMemo, useState } from "react"
import { BookOpen, CheckCircle2, HandCoins, ListOrdered, Save, ShieldCheck, Sparkles, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { EditableCollection } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import {
    ActionConfirmModal, FormFooter, IconButton, Section, SubmitButton, type DocumentActionItem,
} from "@/components/shared"
import { DocumentSheet, useInvalidateDocuments, type DocumentSheetSection } from "@/features/documents"
import { PaymentModal } from "@/features/treasury"
import { showApiError } from "@/lib/errors"
import { formatCurrency } from "@/lib/money"
import { deletePayroll, downloadPayrollPdf, generateProformaPayroll, payPrevired, paySalary, postPayroll } from "@/features/hr/api/hrApi"
import { usePayrollDetail } from "@/features/hr/hooks/usePayrolls"
import { suggestedAdvanceAmount, usePayrollDraft } from "@/features/hr/hooks/usePayrollDraft"
import type { Payroll, PayrollPayment } from "@/types/hr"
import { isPayrollLineCategory, payrollAdvanceEditable, payrollLineEditable } from "../../entity-view/payrollItem.entity"
import { PayrollPickerModal } from "./PayrollPickerModal"
import { PayrollOverviewStrip, PayrollTotalsBox, livePayrollTotals, payrollTotals, usePayrollSections } from "./payrollSummary"

interface PayrollDetailDrawerProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdate?: () => void
    /** Sin Drawer: solo el cuerpo de la ficha (página /hr/payrolls/[id]). */
    embedded?: boolean
}

function previredStatus(payroll: Payroll, payments: PayrollPayment[]) {
    const posted = payments.filter(p => p.status === "POSTED" && p.payment_type === "PREVIRED")
    const total = (payroll.items ?? [])
        .filter(i => i.concept_detail?.category === "DESCUENTO_LEGAL_TRABAJADOR")
        .reduce((s, i) => s + parseFloat(i.amount || "0"), 0)
    const paid = posted.reduce((s, p) => s + parseFloat(p.amount), 0)
    return { isPaid: posted.length > 0, pending: Math.max(0, total - paid) }
}

/**
 * Ficha documental de la liquidación de sueldo (ADR-0083, component-document-sheet.md).
 * Borrador: haberes/descuentos y anticipos/préstamos se editan en línea y se guardan juntos;
 * el pie lleva Eliminar borrador · Propuesta inicial · Guardar cambios · Contabilizar.
 * Contabilizada: Resumen de solo lectura y pagos (sueldo, Previred) en el menú de acciones.
 */
export function PayrollDetailDrawer({ payrollId, open, onOpenChange, onUpdate, embedded = false }: PayrollDetailDrawerProps) {
    const { payrollDetail, isLoading, isError, refetch } = usePayrollDetail(payrollId ?? 0)
    const invalidateDocuments = useInvalidateDocuments()

    const payroll = payrollDetail?.payroll ?? null
    const concepts = useMemo(() => payrollDetail?.concepts ?? [], [payrollDetail])
    const payments = payrollDetail?.payments ?? []
    const isPosted = payroll?.status === "POSTED"

    const draft = usePayrollDraft(payroll)
    const readOnlySections = usePayrollSections(isPosted ? payroll : null)

    const [picker, setPicker] = useState<"concept" | "advance" | null>(null)
    const [dialog, setDialog] = useState<"salary" | "previred" | "post" | "delete" | null>(null)
    const [busy, setBusy] = useState<"proforma" | "post" | null>(null)

    const refresh = useCallback(() => {
        void refetch()
        invalidateDocuments()
        onUpdate?.()
    }, [refetch, invalidateDocuments, onUpdate])

    const totals = payroll ? payrollTotals(payroll) : null
    const salaryPaid = isPosted && (totals?.pending ?? 0) <= 0
    const previred = payroll ? previredStatus(payroll, payments) : { isPaid: false, pending: 0 }

    const handleSave = async () => {
        try {
            if (await draft.save()) {
                toast.success("Cambios guardados")
                refresh()
            }
        } catch (e) {
            showApiError(e, "No se pudieron guardar todos los cambios")
            refresh()
        }
    }

    const handleProforma = async () => {
        if (!payroll) return
        setBusy("proforma")
        try {
            draft.resync()
            await generateProformaPayroll({ employee: payroll.employee, period_year: payroll.period_year, period_month: payroll.period_month })
            toast.success("Propuesta generada")
            refresh()
        } catch (e) {
            showApiError(e, "Error al generar propuesta")
        } finally {
            setBusy(null)
        }
    }

    const handlePost = async () => {
        if (!payroll) return
        setDialog(null)
        setBusy("post")
        try {
            // Lo editado se guarda antes de contabilizar: el asiento sale de lo que está en el servidor.
            if (draft.isDirty && !(await draft.save())) return
            await postPayroll(payroll.id)
            toast.success("Liquidación contabilizada")
            refresh()
        } catch (e) {
            showApiError(e, "Error al contabilizar")
            refresh()
        } finally {
            setBusy(null)
        }
    }

    // ── Secciones del borrador (edición en línea) ──────────────────────────
    const draftSections: DocumentSheetSection[] = payroll && !isPosted ? [
        { content: <PayrollOverviewStrip payroll={payroll} /> },
        {
            title: "Haberes y descuentos",
            icon: ListOrdered,
            content: (
                <EditableCollection
                    definition={payrollLineEditable}
                    rows={draft.lines}
                    value={draft.lineValues}
                    onChange={draft.setLineValues}
                    errors={draft.lineErrors}
                    label="Haberes y descuentos"
                    disabled={draft.isSaving}
                    emptyText="Sin conceptos: agrega uno o genera la propuesta inicial."
                    addAction={{ label: "Agregar concepto", onClick: () => setPicker("concept") }}
                    rowActions={(row) => (
                        <IconButton title={`Quitar ${row.conceptName}`} onClick={() => draft.removeLine(row.key)} disabled={draft.isSaving}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                    )}
                />
            ),
        },
        {
            title: "Anticipos y préstamos",
            icon: HandCoins,
            content: (
                <div className="space-y-8">
                    <EditableCollection
                            definition={payrollAdvanceEditable}
                            rows={draft.advances}
                            value={draft.advanceValues}
                            onChange={draft.setAdvanceValues}
                            errors={draft.advanceErrors}
                            label="Anticipos y préstamos"
                            disabled={draft.isSaving}
                            emptyText="Sin anticipos ni préstamos descontados."
                            addAction={{ label: "Asignar anticipo o préstamo", onClick: () => setPicker("advance") }}
                            rowActions={(row) => (
                                <IconButton title={`Quitar ${row.displayId}`} onClick={() => draft.removeAdvance(row.key)} disabled={draft.isSaving}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </IconButton>
                            )}
                        />
                    {payroll.cap_warning && (
                        <Section><Section.Note>{payroll.cap_warning}</Section.Note></Section>
                    )}
                    <PayrollTotalsBox
                        totals={livePayrollTotals(payroll, draft.lines, draft.lineValues, draft.advanceValues)}
                        note={draft.isDirty ? "Incluye cambios sin guardar." : undefined}
                    />
                </div>
            ),
        },
    ] : []

    // ── Acciones ───────────────────────────────────────────────────────────
    const salaryAction: DocumentActionItem = {
        id: "pay-salary", label: "Pagar sueldo", icon: salaryPaid ? CheckCircle2 : Wallet,
        onClick: () => setDialog("salary"), disabled: salaryPaid, disabledReason: "Sueldo pagado",
    }
    const previredAction: DocumentActionItem = {
        id: "pay-previred", label: "Pagar Previred", icon: previred.isPaid ? CheckCircle2 : ShieldCheck,
        onClick: () => setDialog("previred"), disabled: previred.isPaid, disabledReason: "Previred pagado",
    }
    const primaryAction = isPosted ? (!salaryPaid ? salaryAction : !previred.isPaid ? previredAction : null) : null
    const actions = isPosted ? [salaryAction, previredAction].filter(a => a.id !== primaryAction?.id) : []

    const footer = payroll && !isPosted ? (
        <FormFooter
            leftActions={
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDialog("delete")} disabled={busy !== null || draft.isSaving}>
                    <Trash2 className="h-4 w-4" /> Eliminar borrador
                </Button>
            }
            actions={
                <>
                    <SubmitButton type="button" variant="outline" icon={Sparkles} loading={busy === "proforma"} disabled={busy !== null || draft.isSaving} onClick={() => void handleProforma()}>
                        Propuesta inicial
                    </SubmitButton>
                    <SubmitButton type="button" variant="outline" icon={Save} loading={draft.isSaving && busy === null} disabled={!draft.isDirty || busy !== null} onClick={() => void handleSave()}>
                        Guardar cambios
                    </SubmitButton>
                    <SubmitButton type="button" icon={BookOpen} loading={busy === "post"} disabled={busy !== null || draft.isSaving} onClick={() => setDialog("post")}>
                        Contabilizar
                    </SubmitButton>
                </>
            }
        />
    ) : undefined

    // ── Opciones de los selectores ─────────────────────────────────────────
    const conceptOptions = useMemo(() => concepts
        .filter(c => isPayrollLineCategory(c.category))
        .map(c => ({
            id: c.id,
            title: c.name,
            chips: [c.category_display, c.formula_type_display].filter(Boolean),
            value: c.formula_type === "FIXED" && parseFloat(c.default_amount) > 0 ? formatCurrency(parseFloat(c.default_amount)) : undefined,
        })), [concepts])
    const advanceOptions = draft.pendingMovements.map(m => ({
        id: m.id,
        title: m.display_id,
        chips: [m.kind_display],
        value: formatCurrency(suggestedAdvanceAmount(m)),
        valueHint: `Saldo ${formatCurrency(parseFloat(String(m.free_balance)))}`,
    }))

    return (
        <>
            <DocumentSheet
                label="hr.payroll"
                auditType="payroll"
                open={open}
                onOpenChange={onOpenChange}
                embedded={embedded}
                document={payroll}
                isLoading={isLoading}
                error={isError ? new Error("No se pudo cargar la liquidación.") : undefined}
                loadingLabel="Cargando liquidación"
                status={payroll?.status ?? null}
                statusLabel={payroll?.status_display}
                primaryAction={primaryAction}
                actions={actions}
                onPrint={payroll ? () => void downloadPayrollPdf(payroll.id, `${payroll.display_id}.pdf`).catch((e: unknown) => showApiError(e, "No se pudo descargar el PDF")) : undefined}
                context={[]}
                sections={isPosted ? readOnlySections : draftSections}
                footer={footer}
            />

            <PayrollPickerModal
                open={picker === "concept"}
                onOpenChange={(o) => { if (!o) setPicker(null) }}
                icon={ListOrdered}
                title="Agregar concepto"
                description="Haberes y descuentos configurados. El monto se edita en la tabla."
                options={conceptOptions}
                emptyTitle="Sin conceptos configurados"
                emptyDescription="Crea conceptos de remuneración en Configuración › RRHH."
                onSelect={(id) => { const c = concepts.find(x => x.id === id); if (c) draft.addConcept(c) }}
            />
            <PayrollPickerModal
                open={picker === "advance"}
                onOpenChange={(o) => { if (!o) setPicker(null) }}
                icon={HandCoins}
                title="Asignar anticipo o préstamo"
                description="Movimientos vigentes del empleado con saldo. La cuota se edita en la tabla."
                options={advanceOptions}
                isLoading={draft.movementsLoading}
                emptyTitle="Sin movimientos pendientes"
                emptyDescription="El empleado no tiene anticipos ni préstamos con saldo."
                onSelect={(id) => { const m = draft.pendingMovements.find(x => x.id === id); if (m) draft.addAdvance(m) }}
            />

            {payroll && (
                <>
                    <PaymentModal
                        open={dialog === "salary"}
                        onOpenChange={(o) => { if (!o) setDialog(null) }}
                        title="Registrar pago de sueldo"
                        total={totals?.pending ?? 0}
                        pendingAmount={totals?.pending ?? 0}
                        isPurchase
                        hideDteFields
                        onConfirm={async (data) => {
                            await paySalary(payroll.id, data)
                            toast.success("Pago de sueldo registrado")
                            setDialog(null)
                            refresh()
                        }}
                    />
                    <PaymentModal
                        open={dialog === "previred"}
                        onOpenChange={(o) => { if (!o) setDialog(null) }}
                        title="Registrar pago de Previred"
                        total={previred.pending}
                        pendingAmount={previred.pending}
                        isPurchase
                        hideDteFields
                        onConfirm={async (data) => {
                            await payPrevired(payroll.id, data)
                            toast.success("Pago de Previred registrado")
                            setDialog(null)
                            refresh()
                        }}
                    />
                    <ActionConfirmModal
                        open={dialog === "post"}
                        onOpenChange={(o) => { if (!o) setDialog(null) }}
                        title="¿Contabilizar liquidación?"
                        description={`${draft.isDirty ? "Primero se guardarán los cambios pendientes. " : ""}Se generarán los asientos contables de haberes y retenciones legales. La liquidación quedará bloqueada para edición.`}
                        variant="destructive"
                        confirmText="Confirmar y contabilizar"
                        onConfirm={handlePost}
                    />
                    <ActionConfirmModal
                        open={dialog === "delete"}
                        onOpenChange={(o) => { if (!o) setDialog(null) }}
                        title="Eliminar liquidación"
                        description="¿Eliminar este borrador de liquidación? Esta acción no se puede deshacer."
                        variant="destructive"
                        onConfirm={async () => {
                            setDialog(null)
                            try {
                                await deletePayroll(payroll.id)
                                toast.success("Liquidación eliminada")
                                onUpdate?.()
                                onOpenChange(false)
                            } catch (e) {
                                showApiError(e, "Error al eliminar liquidación")
                            }
                        }}
                    />
                </>
            )}
        </>
    )
}
