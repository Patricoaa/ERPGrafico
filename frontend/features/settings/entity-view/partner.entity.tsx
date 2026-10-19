"use client"

import { AlertCircle } from "lucide-react"
import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, toNumber, formatMoneyValue, type ValueRenderProps } from "@/components/entity-view"
import type { Partner } from "@/features/contacts"

/** Feature extension: the partner's name, linked to its contact, with an "exceso de capital" badge. */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        partnerName: { value: Partner; options: Record<never, never> }
        /** Money with a tone that only turns on above zero; shared by the 4 "balance" columns below. */
        partnerBalance: { value: Partner["partner_pending_capital"]; options: { tone: "warning" | "destructive" | "success"; dashIfZero?: boolean } }
    }
}

function PartnerNameCell({ value: partner }: ValueRenderProps<"partnerName">) {
    const excess = toNumber(partner.partner_excess_capital) ?? 0
    return (
        <div className="flex flex-col gap-1 py-1 items-center">
            <DataCell.ContactLink contactId={partner.id}>{partner.name}</DataCell.ContactLink>
            {excess > 0 && (
                <div className="mt-1.5 p-1.5 bg-warning/10 border border-warning/20 rounded-sm flex items-center gap-2 overflow-hidden ring-1 ring-warning/10">
                    <div className="flex items-center gap-1.5 text-4xs text-warning font-bold uppercase tracking-tighter">
                        <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                        Exceso: +{formatMoneyValue(partner.partner_excess_capital)}
                    </div>
                </div>
            )}
        </div>
    )
}

// Tailwind needs the full class name literally — no `text-${tone}` interpolation.
const TONE_CLASS = {
    warning: "text-warning",
    destructive: "text-destructive",
    success: "text-success",
} as const satisfies Record<ValueRenderProps<"partnerBalance">["options"]["tone"], string>

function PartnerBalanceCell({ value, options }: ValueRenderProps<"partnerBalance">) {
    const n = toNumber(value) ?? 0
    if (options.dashIfZero && n <= 0) return <DataCell.Empty align="end" />
    return <DataCell.Text align="end" className={n > 0 ? TONE_CLASS[options.tone] : "text-muted-foreground/30"}>{formatMoneyValue(value)}</DataCell.Text>
}

let registered = false
function registerPartnerValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("partnerName", {
        format: (p) => p.name,
        sortValue: (p) => p.name,
        render: PartnerNameCell,
    })
    registerValueKind("partnerBalance", {
        format: (v) => formatMoneyValue(v),
        sortValue: (v) => toNumber(v) ?? 0,
        align: "end",
        render: PartnerBalanceCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerPartnerValueKinds()

/** Company partners / shareholders (ADR-0087 oleada B5). Replaces partnerFields.ts + the inline name column. */
export const partnerEntity = defineEntity<Partner>()((f) => ({
    label: "settings.partner",
    fields: {
        name: f.value("partnerName", (p) => p, { label: "Socio" }),
        equityPercentage: f.number("partner_equity_percentage", { label: "Part. %", suffix: "%" }),
        totalContributions: f.money("partner_total_contributions", { label: "C. Suscrito" }),
        totalPaidIn: f.money("partner_total_paid_in", { label: "C. Enterado" }),
        pendingCapital: f.value("partnerBalance", "partner_pending_capital", { label: "Pendiente", tone: "warning" }),
        provisionalWithdrawals: f.value("partnerBalance", "partner_provisional_withdrawals_balance", { label: "R. Provisorios", tone: "destructive", dashIfZero: true }),
        earningsBalance: f.value("partnerBalance", "partner_earnings_balance", { label: "Utilidades", tone: "success", dashIfZero: true }),
        dividendsPayable: f.value("partnerBalance", "partner_dividends_payable_balance", { label: "D. por Pagar", tone: "warning", dashIfZero: true }),
        netEquity: f.money("partner_net_equity", { label: "Patrimonio" }),
    },
}))

export const partnerViews = partnerEntity.views({
    table: {
        columns: ["name", "equityPercentage", "totalContributions", "totalPaidIn", "pendingCapital", "provisionalWithdrawals", "earningsBalance", "dividendsPayable", "netEquity"],
        primary: "name",
    },
    card: {
        title: "name",
        meta: ["equityPercentage", "totalContributions", "totalPaidIn"],
        trailing: ["netEquity"],
    },
})
