"use client"

import { useMemo } from "react"
import { Banknote, CalendarDays, CalendarRange, HandCoins, ListOrdered, UserRound } from "lucide-react"
import { Collection, useEntityCollection, type EditableRowValue } from "@/components/entity-view"
import { Metric, MetricStrip, Section } from "@/components/shared"
import type { DocumentSheetSection } from "@/features/documents"
import { formatCurrency } from "@/lib/money"
import type { Payroll } from "@/types/hr"
import {
    payrollAdvanceEntity, payrollAdvanceViews, payrollAdvances, payrollLineEntity, payrollLineViews, payrollLines, payrollSettlements,
    type PayrollLineRow,
} from "../../entity-view/payrollItem.entity"

const num = (v: string | number | null | undefined) => {
    const n = parseFloat(String(v ?? 0))
    return Number.isFinite(n) ? n : 0
}

export interface PayrollTotals {
    haberes: number
    descuentos: number
    net: number
    paid: number
    pending: number
}

/** Cifras guardadas. El saldo viene del backend (líquido − anticipos, cuotas y pagos; ADR-0156). */
export function payrollTotals(payroll: Payroll): PayrollTotals {
    const net = num(payroll.net_salary)
    const pending = Math.max(0, payroll.balance !== undefined ? num(payroll.balance) : net)
    return {
        haberes: num(payroll.total_haberes),
        descuentos: num(payroll.total_descuentos),
        net,
        pending,
        paid: Math.max(0, net - pending),
    }
}

/**
 * Cifras del borrador mientras se edita, con la misma regla que el backend
 * (`PayrollService.update_payroll_totals`: líquido = Σ haberes − Σ descuentos de las líneas).
 * Lo ya pagado que no es un anticipo/préstamo de la tabla (pagos de sueldo) se conserva.
 */
export function livePayrollTotals(
    payroll: Payroll,
    lines: PayrollLineRow[],
    lineValues: EditableRowValue[],
    advanceValues: EditableRowValue[],
): PayrollTotals {
    const amount = new Map(lineValues.map((v) => [v.key, v.values.amount ?? 0]))
    const sum = (kind: PayrollLineRow["kind"]) => lines.filter((l) => l.kind === kind).reduce((s, l) => s + (amount.get(l.key) ?? 0), 0)
    const haberes = sum("HABER")
    const descuentos = sum("DESCUENTO")
    const net = haberes - descuentos
    const saved = payrollTotals(payroll)
    const savedAdvances = payrollAdvances(payroll).reduce((s, a) => s + a.amount, 0)
    const otherPaid = Math.max(0, saved.paid - savedAdvances)
    const paid = otherPaid + advanceValues.reduce((s, v) => s + (v.values.amount ?? 0), 0)
    return { haberes, descuentos, net, paid, pending: Math.max(0, net - paid) }
}

/** Fila de indicadores sobre las tablas: empleado, período, días trabajados y sueldo base. */
export function PayrollOverviewStrip({ payroll }: { payroll: Payroll }) {
    const employee = payroll.employee_detail
    const name = employee?.contact_detail?.name || payroll.employee_name || null
    const role = [employee?.position, employee?.department].filter(Boolean).join(" · ")
    const absent = payroll.absent_days ?? 0
    return (
        <MetricStrip label="Resumen de la liquidación">
            <Metric label="Empleado" lead={UserRound} value={name} context={role || undefined} />
            <Metric label="Período" lead={CalendarRange} value={payroll.period_label} />
            <Metric
                label="Días trabajados"
                lead={CalendarDays}
                tone={absent > 0 ? "warning" : "neutral"}
                value={payroll.worked_days ?? 0}
                unit={`/ ${payroll.agreed_days ?? 0}`}
                context={absent > 0 ? `${absent} ${absent === 1 ? "ausencia" : "ausencias"}` : "Sin ausencias"}
            />
            <Metric label="Sueldo base" lead={Banknote} value={formatCurrency(num(payroll.base_salary))} />
        </MetricStrip>
    )
}

/** Recuadro final (a la derecha): haberes, descuentos, líquido, lo ya descontado o pagado y el saldo. */
export function PayrollTotalsBox({ totals, note }: { totals: PayrollTotals; note?: string }) {
    return (
        <div className="ml-auto w-full max-w-xs shrink-0 space-y-2">
            <Section className="surface-panel px-4">
                <Section.Row variant="stat" title="Total haberes" value={formatCurrency(totals.haberes)} />
                <Section.Row variant="stat" title="Total descuentos" value={`− ${formatCurrency(totals.descuentos)}`} />
                <Section.Row variant="stat" strong title="Líquido a percibir" value={formatCurrency(totals.net)} />
                <Section.Row variant="stat" title="Anticipos y pagos" value={formatCurrency(totals.paid)} />
                <Section.Row
                    variant="stat"
                    strong={totals.pending > 0}
                    title="Saldo por pagar"
                    value={formatCurrency(totals.pending)}
                    valueClassName={totals.pending > 0 ? "text-warning-text" : undefined}
                />
            </Section>
            {note && <p className="text-right text-2xs text-muted-foreground" aria-live="polite">{note}</p>}
        </div>
    )
}

function LinesTable({ payroll }: { payroll: Payroll }) {
    const rows = useMemo(() => payrollLines(payroll), [payroll])
    const collection = useEntityCollection(payrollLineEntity, { rows }, { pagination: { mode: "none" } })
    return (
        <Collection.Root collection={collection} label="Haberes y descuentos">
            <Collection.View table={payrollLineViews.table} emptyTitle="Sin conceptos" />
        </Collection.Root>
    )
}

function SettlementsTable({ payroll }: { payroll: Payroll }) {
    const rows = useMemo(() => payrollSettlements(payroll), [payroll])
    const collection = useEntityCollection(payrollAdvanceEntity, { rows }, { pagination: { mode: "none" } })
    return (
        <Collection.Root collection={collection} label="Anticipos, préstamos y pagos">
            <Collection.View table={payrollAdvanceViews.table} emptyTitle="Sin anticipos, préstamos ni pagos" />
        </Collection.Root>
    )
}

/** Resumen de solo lectura (liquidación contabilizada, vista del empleado). */
export function usePayrollSections(payroll: Payroll | null): DocumentSheetSection[] {
    return useMemo(() => {
        if (!payroll) return []
        return [
            { content: <PayrollOverviewStrip payroll={payroll} /> },
            { title: "Haberes y descuentos", icon: ListOrdered, content: <LinesTable payroll={payroll} /> },
            {
                title: "Anticipos, préstamos y pagos",
                icon: HandCoins,
                content: (
                    <div className="space-y-8">
                        <SettlementsTable payroll={payroll} />
                        <PayrollTotalsBox totals={payrollTotals(payroll)} />
                    </div>
                ),
            },
        ]
    }, [payroll])
}
