import { defineEntity } from "@/components/entity-view"
import type { PartnerEquityStake } from "@/features/contacts"

const fixed = { sortable: false } as const

/** Vigencias históricas del % de participación de un socio (ficha, pestaña Participación). */
export const partnerStakeEntity = defineEntity<PartnerEquityStake>()((f) => ({
    title: "Participación",
    rowId: (s) => s.id,
    fields: {
        period: f.dateRange((s) => ({ from: s.effective_from, to: s.effective_until }), { ...fixed, label: "Vigencia" }),
        percentage: f.number("percentage", { ...fixed, label: "Participación", suffix: "%" }),
        state: f.status((s) => (s.is_active ? { status: "SUCCESS", label: "Vigente" } : { status: "NEUTRAL", label: "Histórica" }), { ...fixed, label: "Estado" }),
    },
}))

export const partnerStakeViews = partnerStakeEntity.views({
    table: { columns: ["period", "percentage", "state"] },
})
