import { Landmark } from "lucide-react"
import { defineEntity } from "@/components/entity-view"
import type { Bank } from "../types"
import type { BankSummary } from "../hooks/useAllBanksOverview"

/** A bank plus the figures of its overview (`useAllBanksOverview`), joined by the bank center view. */
export type BankRow = Bank & { summary: BankSummary["summary"] | null }

/** Bank (ADR-0087 oleada A3). Replaces bankCenterFields.ts + renderCard with one accounts metric. */
export const bankEntity = defineEntity<BankRow>()((f) => ({
    label: "treasury.bank",
    fields: {
        name: f.text("name", { label: "Nombre" }),
        code: f.text("code", { label: "Código" }),
        isActive: f.status((b) => (b.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
        // No summary (archived banks are not fetched, or still loading) reads "—", never a fake 0.
        accounts: f.number((b) => b.summary?.total_accounts ?? null, { label: "Cuentas" }),
    },
}))

export const bankViews = bankEntity.views({
    table: { columns: ["name", "code", "isActive"], defaultSort: "name" },
    card: {
        title: "name",
        subtitle: ["code"],
        footer: { value: "accounts", visible: (b) => b.summary != null },
        muted: (b) => !b.is_active,
        media: {
            placement: "top",
            icon: Landmark,
            badge: (b) => (b.is_active ? undefined : "Archivado"),
        },
    },
})
