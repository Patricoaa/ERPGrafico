import { defineEntity } from "@/components/entity-view"
import type { PendingChargeRow, UpcomingInstallment } from "../types"

/**
 * What a card bill covers for one purchase (ADR-0087): its installments due and its pending charges,
 * read only, inside each purchase group of `BillChargesModal`.
 */
export interface CardChargeLine {
    key: string
    /** «3/12» for an installment; empty for a charge. */
    number: string
    kind: "installment" | "charge"
    typeLabel: string
    reference: string
    amount: number
}

export const installmentLine = (i: UpcomingInstallment): CardChargeLine => ({
    key: `inst-${i.id}`,
    number: `${i.number}/${i.total_installments}`,
    kind: "installment",
    typeLabel: "Cuota",
    reference: i.due_date || "",
    amount: Number(i.principal_amount),
})

export const chargeLine = (c: PendingChargeRow): CardChargeLine => ({
    key: `charge-${c.id}`,
    number: "",
    kind: "charge",
    typeLabel: c.charge_type_display,
    reference: c.description || c.reference || "",
    amount: Number(c.amount),
})

const build = (currency: string) => {
    const entity = defineEntity<CardChargeLine>()((f) => ({
        title: "Cargo a facturar",
        rowId: (l) => l.key,
        fields: {
            number: f.text("number", { label: "#", sortable: false }),
            type: f.status((l) => ({ status: l.kind, label: l.typeLabel, intent: l.kind === "installment" ? "info" : "warning" }), { label: "Tipo", sortable: false }),
            reference: f.text("reference", { label: "Referencia", sortable: false }),
            amount: f.money("amount", { label: "Monto", currency, sortable: false }),
        },
    }))
    return { entity, views: entity.views({ table: { columns: ["number", "type", "reference", "amount"], primary: "reference" } }) }
}

const byCurrency = new Map<string, ReturnType<typeof build>>()

/** The entity in the card's currency (a field option), built once per currency. */
export function cardChargeLineEntity(currency: string) {
    let built = byCurrency.get(currency)
    if (!built) {
        built = build(currency)
        byCurrency.set(currency, built)
    }
    return built
}
