"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate, cn } from "@/lib/utils"
import { Calendar } from "lucide-react"
import type { ProfitDistribution } from "@/features/contacts"

// ─── profitDistYear: two-line fiscal year + display_id ────────────────────────

export interface ProfitDistYearValue { year: number; displayId: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        profitDistYear: { value: ProfitDistYearValue | null; options: Record<never, never> }
    }
}

function ProfitDistYearCell({ value }: ValueRenderProps<"profitDistYear">) {
    if (!value) return null
    return (
        <div className="flex flex-col items-center">
            <span className="font-bold text-sm tracking-tight">{value.year}</span>
            <span className="text-4xs text-muted-foreground font-mono uppercase">ID: {value.displayId}</span>
        </div>
    )
}

registerValueKind("profitDistYear", {
    format: (v) => v ? String(v.year) : "",
    render: ProfitDistYearCell,
})

// ─── profitDistActa: acta number only ─────────────────────────────────────────

export interface ProfitDistActaValue { actaNumber: string | null; date: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        profitDistActa: { value: ProfitDistActaValue | null; options: Record<never, never> }
    }
}

function ProfitDistActaNumberCell({ value }: ValueRenderProps<"profitDistActa">) {
    if (!value) return null
    return (
        <span className="text-xs font-semibold text-foreground">
            {value.actaNumber ?? <span className="text-muted-foreground italic text-3xs">—</span>}
        </span>
    )
}

registerValueKind("profitDistActa", {
    format: (v) => v?.actaNumber ?? "—",
    render: ProfitDistActaNumberCell,
})

// ─── profitDistDate: resolution date only ─────────────────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        profitDistDate: { value: string | null; options: Record<never, never> }
    }
}

function ProfitDistDateCell({ value }: ValueRenderProps<"profitDistDate">) {
    if (!value) return null
    return (
        <div className="flex items-center gap-1 text-xs text-foreground">
            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>{formatPlainDate(value)}</span>
        </div>
    )
}

registerValueKind("profitDistDate", {
    format: (v) => v ? formatPlainDate(v) : "",
    render: ProfitDistDateCell,
})

// ─── profitDistResult: net amount only (moneda) ───────────────────────────────

export interface ProfitDistResultValue { amount: string; status: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        profitDistResult: { value: ProfitDistResultValue | null; options: Record<never, never> }
    }
}

function ProfitDistResultCell({ value }: ValueRenderProps<"profitDistResult">) {
    if (!value) return null
    const amount = parseFloat(value.amount)
    return (
        <span className={cn(
            "font-mono font-black text-sm tracking-tighter tabular-nums",
            amount < 0 ? "text-destructive" : "text-success"
        )}>
            {formatCurrency(Math.abs(amount))}
        </span>
    )
}

registerValueKind("profitDistResult", {
    format: (v) => v ? formatCurrency(Math.abs(parseFloat(v.amount))) : "",
    render: ProfitDistResultCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

function mapProfitStatus(status: string): string {
    switch (status) {
        case 'DRAFT': return 'Borrador'
        case 'APPROVED': return 'Aprobado'
        case 'EXECUTED': return 'Ejecutado'
        case 'CANCELLED': return 'Cancelado'
        default: return status
    }
}

function calcBreakdown(r: ProfitDistribution) {
    return (r.lines ?? []).reduce(
        (acc, line) => {
            if (line.destinations && line.destinations.length > 0) {
                for (const d of line.destinations) {
                    const amt = parseFloat(d.amount) || 0
                    if (d.destination === 'DIVIDEND') acc.dividends += amt
                    else if (d.destination === 'REINVEST') acc.reinvest += amt
                    else if (d.destination === 'RETAINED') acc.retained += amt
                }
            } else {
                const amount = parseFloat(line.net_amount) || 0
                const dest = line.destination
                if (dest === 'DIVIDEND') acc.dividends += amount
                else if (dest === 'REINVEST') acc.reinvest += amount
                else if (dest === 'RETAINED') acc.retained += amount
            }
            return acc
        },
        { dividends: 0, reinvest: 0, retained: 0 }
    )
}

const fixed = { sortable: false } as const

export const profitDistributionEntity = defineEntity<ProfitDistribution>()((f) => ({
    title: "Distribuciones de utilidades",
    rowId: (r) => r.id,
    fields: {
        fiscalYear: f.value("profitDistYear", (r) => ({ year: r.fiscal_year, displayId: r.display_id }), { ...fixed, label: "Año Fiscal" }),
        status: f.status((r) => ({
            status: r.status === 'CANCELLED' ? 'DESTRUCTIVE' : r.status === 'EXECUTED' ? 'SUCCESS' : 'NEUTRAL',
            label: mapProfitStatus(r.status),
        }), { ...fixed, label: "Estado" }),
        dividends: f.money((r) => calcBreakdown(r).dividends, { ...fixed, label: "Dividendos" }),
        reinvest:  f.money((r) => calcBreakdown(r).reinvest,  { ...fixed, label: "Reinversión" }),
        retained:  f.money((r) => calcBreakdown(r).retained,  { ...fixed, label: "Ut. Retenidas" }),
        offset:    f.money((r) => Number(r.provisional_offset_total) || 0, { ...fixed, label: "Retiros absorbidos" }),
        actaNumber: f.value("profitDistActa", (r) => ({ actaNumber: r.acta_number ?? null, date: r.resolution_date }), { ...fixed, label: "Acta N°" }),
        actaDate:   f.value("profitDistDate", (r) => r.resolution_date ?? null, { ...fixed, label: "Fecha" }),
        netResult:  f.value("profitDistResult", (r) => ({ amount: r.net_result, status: r.status }), { ...fixed, label: "Resultado Neto" }),
    },
}))

export const profitDistributionViews = profitDistributionEntity.views({
    table: { columns: ["fiscalYear", "status", "offset", "dividends", "reinvest", "retained", "actaNumber", "actaDate", "netResult"] },
})
