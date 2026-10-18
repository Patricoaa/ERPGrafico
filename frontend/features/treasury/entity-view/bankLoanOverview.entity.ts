import { HandCoins } from "lucide-react"
import { defineEntity } from "@/components/entity-view"
import type { BankOverviewLoanItem } from "../hooks/useBankOverview"

/** Active loan of the bank overview (ADR-0087 oleada A3). Replaces the legacy "overview" card with an empty field schema. */
export const bankLoanOverviewEntity = defineEntity<BankOverviewLoanItem>()((f) => ({
    title: "Préstamos Bancarios",
    fields: {
        folio: f.code("display_id", { label: "Préstamo" }),
        state: f.text(() => "Vigente", { label: "Estado", tone: "secondary" }),
        principal: f.money("principal", { label: "Capital" }),
        outstanding: f.money("outstanding_balance", { label: "Saldo Insoluto" }),
        installments: f.text((l) => `${l.paid_installments_count}/${l.installments_count}`, { label: "Cuotas pagadas" }),
    },
}))

export const bankLoanOverviewViews = bankLoanOverviewEntity.views({
    card: { title: "folio", subtitle: ["state"], media: { icon: HandCoins }, body: { kind: "metrics", fields: ["principal", "outstanding", "installments"] } },
})
