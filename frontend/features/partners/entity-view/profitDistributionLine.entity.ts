import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

const DESTINATION: Record<string, string> = { DIVIDEND: "Dividendo", REINVEST: "Reinversión", RETAINED: "Retenida" }

export interface ProfitDistributionLine {
    id: number
    partner: number | null
    partner_name: string | null
    percentage_at_date: number
    destination: string
    provisional_withdrawals_offset: number
    net_amount: number
}

const fixed = { sortable: false } as const

export const profitDistributionLineEntity = defineEntity<ProfitDistributionLine>()((f) => ({
    title: "Socios",
    fields: {
        partner: docRef(
            f,
            (l) => l.partner ? { label: "contacts.contact", id: l.partner, display: l.partner_name ?? "" } : null,
            { ...fixed, label: "Socio", fallback: (l) => l.partner_name ?? undefined },
        ),
        percentage: f.number("percentage_at_date", { ...fixed, label: "Participación", suffix: "%" }),
        destination: f.text((l) => DESTINATION[l.destination] ?? "—", { ...fixed, label: "Destino" }),
        offset: f.money("provisional_withdrawals_offset", { ...fixed, label: "Retiros a compensar" }),
        net_amount: f.money("net_amount", { ...fixed, label: "Monto neto" }),
    },
}))

export const profitDistributionLineViews = profitDistributionLineEntity.views({
    table: { columns: ["partner", "percentage", "destination", "offset", "net_amount"] },
})
