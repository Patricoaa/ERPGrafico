import { Landmark } from "lucide-react"
import { defineEntity } from "@/components/entity-view"
import type { Bank } from "../types"
import type { BankSummary } from "../hooks/useAllBanksOverview"

/** A bank plus the figures of its overview (`useAllBanksOverview`), joined by the bank center view. */
export type BankRow = Bank & { summary: BankSummary["summary"] | null }

/** Bank (ADR-0087 oleada A3). Replaces bankCenterFields.ts + renderCard with external metrics children. */
export const bankEntity = defineEntity<BankRow>()((f) => ({
    label: "treasury.bank",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        code: f.text("code", { label: "Código" }),
        isActive: f.status((b) => (b.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
        // No summary (archived banks are not fetched, or still loading) reads "—", never a fake 0.
        accounts: f.number((b) => b.summary?.total_accounts ?? null, { label: "Cuentas" }),
        cards: f.number((b) => b.summary?.card_count ?? null, { label: "Tarjetas" }),
        checks: f.number((b) => b.summary?.issued_checks ?? null, { label: "Cheques" }),
        loans: f.number((b) => b.summary?.active_loan_count ?? null, { label: "Préstamos" }),
    },
}))

export const bankViews = bankEntity.views({
    table: { columns: ["name", "code", "isActive"], defaultSort: "name" },
    card: {
        title: "name",
        subtitle: ["code"],
        trailing: ["isActive"],
        media: { placement: "top", icon: Landmark },
        body: { kind: "metrics", fields: ["accounts", "cards", "checks", "loans"] },
    },
})
