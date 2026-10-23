import { Landmark } from "lucide-react"
import { defineEntity, toNumber } from "@/components/entity-view"
import type { BankOverviewData } from "../hooks/useBankOverview"

type BankAccount = BankOverviewData["accounts"][number]

const creditLine = (a: BankAccount): number => toNumber(a.credit_line_credit_limit) ?? 0
const available = (a: BankAccount): number => {
    const balance = toNumber(a.current_balance) ?? 0
    return creditLine(a) > 0 ? Math.max(0, balance + creditLine(a)) : balance
}

/** Checking account of the bank overview (ADR-0087 oleada A3). Replaces the legacy "overview" card with an empty field schema. */
export const bankCheckingAccountEntity = defineEntity<BankAccount>()((f) => ({
    title: "Cuentas Corrientes",
    fields: {
        name: f.text("name", { label: "Cuenta" }),
        number: f.code((a) => a.account_number ?? a.code ?? null, { label: "Número" }),
        balance: f.money("current_balance", { label: "Saldo" }),
        available: f.money(available, { label: "Disponible" }),
    },
}))

export const bankCheckingAccountViews = bankCheckingAccountEntity.views({
    card: {
        title: "name",
        subtitle: ["number"],
        meta: ["balance"],
        footer: { value: "available" },
        media: { placement: "top", icon: Landmark },
    },
})
