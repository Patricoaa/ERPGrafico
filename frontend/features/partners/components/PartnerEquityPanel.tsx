"use client"

import type { ReactNode } from "react"
import { ROW_ACTIONS } from "@/lib/row-actions"
import { Section } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import type { Partner } from "@/features/contacts"
import { partnerActionsFor, partnerLineAction, TRANSFER_ACTION_LABEL, type PartnerLine } from "./partnerActions"
import type { PartnerActionRunner } from "./partnerActionRequest"

const money = (v: string | number | null | undefined) => formatCurrency(Number(v) || 0)

interface Line {
    key: string
    label: string
    value: (p: Partner) => string
    /** Resta del patrimonio (se muestra con «−»). */
    deduction?: boolean
    action?: PartnerLine
}

const CAPITAL_LINES: Line[] = [
    { key: "subscribed", label: "Capital suscrito", value: p => p.partner_total_contributions, action: "subscribed" },
    { key: "paid", label: "Capital enterado", value: p => p.partner_total_paid_in },
    { key: "pending", label: "Capital pendiente", value: p => p.partner_pending_capital, action: "pending" },
    { key: "excess", label: "Exceso de capital", value: p => p.partner_excess_capital, action: "excess" },
]

const RESULT_LINES: Line[] = [
    { key: "earnings", label: "Utilidades retenidas", value: p => p.partner_earnings_balance, action: "earnings" },
    { key: "dividends", label: "Dividendos por pagar", value: p => p.partner_dividends_payable_balance, action: "dividends" },
    { key: "withdrawals", label: "Retiros provisorios", value: p => p.partner_provisional_withdrawals_balance, deduction: true, action: "withdrawals" },
]

/** Última columna de la fila: ancho fijo para que los montos queden alineados aunque la línea no tenga acción. */
function ActionSlot({ children }: { children?: ReactNode }) {
    return <span className="flex w-56 shrink-0 justify-end">{children}</span>
}

function lineRow(line: Line, partner: Partner, run: PartnerActionRunner) {
    const action = line.action ? partnerLineAction(partner, line.action, { run }) : undefined
    return (
        <Section.Row
            key={line.key}
            title={line.label}
            value={`${line.deduction ? "− " : ""}${money(line.value(partner))}`}
            actions={
                <ActionSlot>
                    {action && (
                        <Section.Action
                            text={action.label ?? ROW_ACTIONS[action.action].label}
                            icon={action.icon ?? ROW_ACTIONS[action.action].icon}
                            onClick={action.onClick}
                        />
                    )}
                </ActionSlot>
            }
        />
    )
}

/**
 * Composición del patrimonio del socio: una fila por línea con su monto y, en la última columna, la acción que la
 * resuelve (suscribir, aportar, formalizar, distribuir, pagar, retirar). La transferencia de capital va en el patrimonio neto.
 */
export function PartnerEquityPanel({ partner, run }: { partner: Partner; run: PartnerActionRunner }) {
    const transfer = partnerActionsFor(partner, "capital", { run }).find(a => "label" in a && a.label === TRANSFER_ACTION_LABEL)
    return (
        <div className="space-y-2">
            <Section>{CAPITAL_LINES.map(l => lineRow(l, partner, run))}</Section>
            <Section>{RESULT_LINES.map(l => lineRow(l, partner, run))}</Section>
            <Section>
                <Section.Row
                    title="Patrimonio neto"
                    strong
                    value={money(partner.partner_net_equity)}
                    actions={
                        <ActionSlot>
                            {transfer && "onClick" in transfer && (
                                <Section.Action text={TRANSFER_ACTION_LABEL} icon={transfer.icon} onClick={transfer.onClick} />
                            )}
                        </ActionSlot>
                    }
                />
            </Section>
        </div>
    )
}
