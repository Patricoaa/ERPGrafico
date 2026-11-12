"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { formatCurrency } from "@/lib/money"
import { formatPlainDate, cn } from "@/lib/utils"
import { Chip } from "@/components/shared"
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

// ─── profitDistBreakdown: chips for DIV / REINV / RET ─────────────────────────

export interface ProfitDistBreakdownValue { dividends: number; reinvest: number; retained: number }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        profitDistBreakdown: { value: ProfitDistBreakdownValue | null; options: Record<never, never> }
    }
}

function ProfitDistBreakdownCell({ value }: ValueRenderProps<"profitDistBreakdown">) {
    if (!value) return null
    const { dividends, reinvest, retained } = value
    return (
        <div className="flex flex-wrap justify-center gap-1.5">
            {dividends > 0 && <Chip intent="success" size="xs">DIV: {formatCurrency(dividends)}</Chip>}
            {reinvest > 0 && <Chip intent="info" size="xs">REINV: {formatCurrency(reinvest)}</Chip>}
            {retained > 0 && <Chip intent="warning" size="xs">RET: {formatCurrency(retained)}</Chip>}
        </div>
    )
}

registerValueKind("profitDistBreakdown", {
    format: (v) => v ? [
        v.dividends > 0 ? `DIV: ${formatCurrency(v.dividends)}` : "",
        v.reinvest > 0 ? `REINV: ${formatCurrency(v.reinvest)}` : "",
        v.retained > 0 ? `RET: ${formatCurrency(v.retained)}` : "",
    ].filter(Boolean).join(" | ") : "",
    render: ProfitDistBreakdownCell,
})

// ─── profitDistActa: acta number + resolution date ────────────────────────────

export interface ProfitDistActaValue { actaNumber: string | null; date: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        profitDistActa: { value: ProfitDistActaValue | null; options: Record<never, never> }
    }
}

function ProfitDistActaCell({ value }: ValueRenderProps<"profitDistActa">) {
    if (!value) return null
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-3xs font-bold text-muted-foreground uppercase tracking-wider">
                {value.actaNumber || 'Sin Acta'}
            </span>
            <div className="flex items-center gap-1 text-3xs text-muted-foreground font-medium">
                <Calendar className="h-3 w-3" />
                {formatPlainDate(value.date)}
            </div>
        </div>
    )
}

registerValueKind("profitDistActa", {
    format: (v) => v ? formatPlainDate(v.date) : "",
    render: ProfitDistActaCell,
})

// ─── profitDistResult: net amount + "Asentado" when executed ─────────────────

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
        <div className="flex flex-col items-center gap-0.5">
            <span className={cn(
                "font-mono font-black text-sm tracking-tighter",
                amount < 0 ? "text-destructive" : "text-success"
            )}>
                {formatCurrency(Math.abs(amount))}
            </span>
            {value.status === 'EXECUTED' && (
                <span className="text-4xs text-muted-foreground uppercase font-bold italic tracking-widest leading-none">Asentado</span>
            )}
        </div>
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
        breakdown: f.value("profitDistBreakdown", (r) => {
            const totals = (r.lines ?? []).reduce(
                (acc, line) => {
                    const amount = parseFloat(line.net_amount) || 0
                    const dest = line.destination
                    if (dest === 'DIVIDEND') acc.dividends += amount
                    else if (dest === 'REINVEST') acc.reinvest += amount
                    else if (dest === 'RETAINED') acc.retained += amount
                    return acc
                },
                { dividends: 0, reinvest: 0, retained: 0 }
            )
            return totals
        }, { ...fixed, label: "Distribución por Destino" }),
        actaDate: f.value("profitDistActa", (r) => ({ actaNumber: r.acta_number ?? null, date: r.resolution_date }), { ...fixed, label: "Acta / Fecha" }),
        netResult: f.value("profitDistResult", (r) => ({ amount: r.net_result, status: r.status }), { ...fixed, label: "Resultado Neto" }),
    },
}))

export const profitDistributionViews = profitDistributionEntity.views({
    table: { columns: ["fiscalYear", "status", "breakdown", "actaDate", "netResult"] },
})
