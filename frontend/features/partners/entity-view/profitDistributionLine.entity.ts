import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"
import { formatCurrency } from "@/lib/money"

const DESTINATION: Record<string, string> = { DIVIDEND: "Dividendo", REINVEST: "Reinversión", RETAINED: "Retenida", LOSS: "Absorción pérdida" }

export interface ProfitDistributionLine {
    id: number
    partner: number | null
    partner_name: string | null
    percentage_at_date: number
    destination: string
    provisional_withdrawals_offset: number
    net_amount: number
    gross_amount?: number | string
    destinations?: {
        id: number
        destination: 'DIVIDEND' | 'REINVEST' | 'RETAINED'
        amount: string
    }[]
}

const fixed = { sortable: false } as const

/** Renderiza el/los destinos de una línea: si hay destinations[], los lista todos; si no, el campo flat. */
function formatDestinations(line: ProfitDistributionLine): string {
    if (line.destinations && line.destinations.length > 0) {
        return line.destinations
            .map((d) => `${DESTINATION[d.destination] ?? d.destination}: ${formatCurrency(parseFloat(d.amount))}`)
            .join(" · ")
    }
    return DESTINATION[line.destination] ?? line.destination ?? "—"
}

export const profitDistributionLineEntity = defineEntity<ProfitDistributionLine>()((f) => ({
    title: "Socios",
    fields: {
        partner: docRef(
            f,
            (l) => l.partner ? { label: "contacts.contact", id: l.partner, display: l.partner_name ?? "" } : null,
            { ...fixed, label: "Socio", fallback: (l) => l.partner_name ?? undefined },
        ),
        percentage: f.number("percentage_at_date", { ...fixed, label: "Participación", suffix: "%" }),
        destinations: f.text(formatDestinations, { ...fixed, label: "Destino(s)" }),
        offset: f.money("provisional_withdrawals_offset", { ...fixed, label: "Retiros a compensar" }),
        net_amount: f.money("net_amount", { ...fixed, label: "Monto neto" }),
    },
}))

export const profitDistributionLineViews = profitDistributionLineEntity.views({
    table: { columns: ["partner", "percentage", "destinations", "offset", "net_amount"] },
})
