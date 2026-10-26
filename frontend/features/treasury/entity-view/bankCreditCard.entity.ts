import { CreditCard } from "lucide-react"
import { defineEntity, toNumber } from "@/components/entity-view"
import type { BankOverviewData } from "../hooks/useBankOverview"

type BankAccount = BankOverviewData["accounts"][number]

/** Only the last four digits survive: cards never expose the full PAN. */
function maskedCardNumber(value: string | null | undefined): string | null {
    const digits = value?.replace(/\D/g, "") ?? ""
    if (!digits) return null
    return `•••• ${digits.slice(-4)}`
}

const used = (c: BankAccount): number => Math.abs(toNumber(c.current_balance) ?? 0)
const available = (c: BankAccount): number => (c.credit_limit != null ? (toNumber(c.credit_limit) ?? 0) - used(c) : 0)

/** Credit card of the bank overview (ADR-0087 oleada A3). Replaces the legacy "overview" card with an empty field schema. */
export const bankCreditCardEntity = defineEntity<BankAccount>()((f) => ({
    title: "Tarjetas de Crédito",
    fields: {
        name: f.text("name", { label: "Tarjeta" }),
        number: f.code((c) => maskedCardNumber(c.card_number || c.account_number || c.code), { label: "Número" }),
        limit: f.money((c) => toNumber(c.credit_limit) ?? 0, { label: "Cupo" }),
        available: f.money(available, { label: "Disponible" }),
    },
}))

export const bankCreditCardViews = bankCreditCardEntity.views({
    card: {
        code: "number",
        title: "name",
        meta: ["limit"],
        footer: { value: "available" },
        media: { placement: "top", icon: CreditCard },
    },
})
