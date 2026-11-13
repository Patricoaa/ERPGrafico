import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

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
        destination: 'DIVIDEND' | 'REINVEST' | 'RETAINED' | 'LOSS'
        amount: string
    }[]
}

const fixed = { sortable: false } as const

function getDestAmount(line: ProfitDistributionLine, dest: 'DIVIDEND' | 'REINVEST' | 'RETAINED' | 'LOSS'): number {
    if (line.destinations && line.destinations.length > 0) {
        const item = line.destinations.find(d => d.destination === dest)
        return item ? parseFloat(item.amount) || 0 : 0
    }
    if (line.destination === dest) {
        return Number(line.net_amount) || 0
    }
    return 0
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
        gross_amount: f.money((l) => Number(l.gross_amount) || 0, { ...fixed, label: "Monto bruto" }),
        offset: f.money((l) => Number(l.provisional_withdrawals_offset) || 0, { ...fixed, label: "Retiros absorbidos" }),
        net_amount: f.money("net_amount", { ...fixed, label: "Monto neto" }),
        dividends: f.money((l) => getDestAmount(l, 'DIVIDEND'), { ...fixed, label: "Dividendos" }),
        reinvest: f.money((l) => getDestAmount(l, 'REINVEST'), { ...fixed, label: "Reinversión" }),
        retained: f.money((l) => getDestAmount(l, 'RETAINED'), { ...fixed, label: "Ut. Retenidas" }),
    },
}))

export const profitDistributionLineViews = profitDistributionLineEntity.views({
    table: { columns: ["partner", "percentage", "gross_amount", "offset", "net_amount", "dividends", "reinvest", "retained"] },
})
