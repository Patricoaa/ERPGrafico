import { CreditCard } from "lucide-react"
import { defineEntity, toNumber } from "@/components/entity-view"
import type { BankOverviewData } from "../hooks/useBankOverview"

type BankAccount = BankOverviewData["accounts"][number]

/** "4111111111111111" → "4111 1111 1111 1111". */
function formatCardNumber(value: string | null | undefined): string | null {
    if (!value) return null
    const groups = value.replace(/\D/g, "").match(/.{1,4}/g)
    return groups ? groups.join(" ") : value
}

const used = (c: BankAccount): number => Math.abs(toNumber(c.current_balance) ?? 0)
const available = (c: BankAccount): number => (c.credit_limit != null ? (toNumber(c.credit_limit) ?? 0) - used(c) : 0)

/** Credit card of the bank overview (ADR-0087 oleada A3). Replaces the legacy "overview" card with an empty field schema. */
export const bankCreditCardEntity = defineEntity<BankAccount>()((f) => ({
    title: "Tarjetas de Crédito",
    fields: {
        number: f.code((c) => formatCardNumber(c.card_number || c.account_number || c.code), { label: "Tarjeta" }),
        limit: f.money((c) => toNumber(c.credit_limit) ?? 0, { label: "Cupo" }),
        used: f.money(used, { label: "Utilizado" }),
        available: f.money(available, { label: "Disponible" }),
    },
}))

export const bankCreditCardViews = bankCreditCardEntity.views({
    card: { title: "number", media: { placement: "top", icon: CreditCard }, body: { kind: "metrics", fields: ["limit", "used", "available"] } },
})
