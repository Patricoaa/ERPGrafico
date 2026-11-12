"use client"

import { Button } from "@/components/ui/button"
import { ROW_ACTIONS } from "@/lib/row-actions"
import { PieChart } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import type { Partner } from "@/features/contacts"
import { partnerLineAction, type PartnerLine } from "./partnerActions"
import type { PartnerActionRunner } from "./partnerActionRequest"

const money = (v: string | number | null | undefined) => formatCurrency(Number(v) || 0)

interface Line {
    key: string
    label: string
    value: (p: Partner) => string
    /** Color de su porción en la dona; sin color no forma parte del patrimonio neto. */
    color?: string
    /** Resta del patrimonio (se muestra con «−»). */
    deduction?: boolean
    action?: PartnerLine
}

const CAPITAL_LINES: Line[] = [
    { key: "subscribed", label: "Capital suscrito", value: p => p.partner_total_contributions, action: "subscribed" },
    { key: "paid", label: "Capital enterado", value: p => p.partner_total_paid_in, color: "var(--color-primary)" },
    { key: "pending", label: "Capital pendiente", value: p => p.partner_pending_capital, action: "pending" },
    { key: "excess", label: "Exceso de capital", value: p => p.partner_excess_capital, action: "excess" },
]

const RESULT_LINES: Line[] = [
    { key: "earnings", label: "Utilidades retenidas", value: p => p.partner_earnings_balance, color: "var(--color-success)", action: "earnings" },
    { key: "dividends", label: "Dividendos por pagar", value: p => p.partner_dividends_payable_balance, color: "var(--color-warning)", action: "dividends" },
    { key: "withdrawals", label: "Retiros provisorios", value: p => p.partner_provisional_withdrawals_balance, deduction: true, action: "withdrawals" },
]

function LineRow({ line, partner, run }: { line: Line; partner: Partner; run: PartnerActionRunner }) {
    const action = line.action ? partnerLineAction(partner, line.action, { run }) : undefined
    const Icon = action ? (action.icon ?? ROW_ACTIONS[action.action].icon) : null
    return (
        <li className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: line.color ?? "transparent" }} />
                {line.label}
            </span>
            <span className="tabular-nums">{line.deduction ? "− " : ""}{money(line.value(partner))}</span>
            <span className="flex w-52 justify-end">
                {action && Icon && (
                    <Button type="button" size="sm" variant="outline" onClick={action.onClick}>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {action.label ?? ROW_ACTIONS[action.action].label}
                    </Button>
                )}
            </span>
        </li>
    )
}

/**
 * Composición del patrimonio del socio: dona del patrimonio neto a la izquierda y, a la derecha, cada línea con
 * su monto y la acción que la resuelve (suscribir, aportar, formalizar, distribuir, pagar, retirar).
 */
export function PartnerEquityPanel({ partner, run }: { partner: Partner; run: PartnerActionRunner }) {
    const slices = [...CAPITAL_LINES, ...RESULT_LINES]
        .filter(l => l.color && Number(l.value(partner)) > 0)
        .map(l => ({ id: l.label, value: Number(l.value(partner)), color: l.color as string }))
    return (
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,13rem)_1fr]">
            <div className="h-48">
                <PieChart
                    data={slices}
                    tooltipFormat="currency"
                    innerRadius={0.68}
                    enableArcLabels={false}
                    enableArcLinkLabels={false}
                    margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    centerLabel={{ value: money(partner.partner_net_equity), label: "Patrimonio neto" }}
                    ariaLabel="Composición del patrimonio neto del socio"
                />
            </div>
            <div className="min-w-0 space-y-4">
                <ul className="space-y-1">{CAPITAL_LINES.map(l => <LineRow key={l.key} line={l} partner={partner} run={run} />)}</ul>
                <ul className="space-y-1 border-t pt-3">{RESULT_LINES.map(l => <LineRow key={l.key} line={l} partner={partner} run={run} />)}</ul>
                <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm font-semibold">
                    <span>Patrimonio neto</span>
                    <span className="tabular-nums">{money(partner.partner_net_equity)}</span>
                </div>
            </div>
        </div>
    )
}
