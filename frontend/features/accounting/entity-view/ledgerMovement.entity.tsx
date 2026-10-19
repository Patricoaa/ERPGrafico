"use client"

import { defineEntity } from "@/components/entity-view"
import type { LedgerMovement } from "../types"

/** Ledger movements (Account ledger / LedgerDrawer). Uses the `ledgerDate` kind registered by this feature barrel. */
export const ledgerMovementEntity = defineEntity<LedgerMovement>()((f) => ({
    title: "Movimientos Contables",
    fields: {
        // ledgerDate kind registered via `features/accounting/index.ts` side-effect import
        date: f.value("ledgerDate", (m) => ({ date: m.date, createdAt: m.created_at }), { label: "Fecha" }),
        // text kind has built-in title tooltip on truncation
        description: f.text((m) => m.label ?? m.description, { label: "Descripción" }),
        // Return null for zero so the cell renders "—" (showZeroAsDash equivalent)
        debit: f.money((m) => (Number(m.debit) > 0 ? m.debit : null), { label: "Debe" }),
        credit: f.money((m) => (Number(m.credit) > 0 ? m.credit : null), { label: "Haber" }),
        balance: f.money("balance", { label: "Saldo" }),
        reference: f.text("reference", { label: "Referencia", tone: "secondary" }),
        partner: f.text("partner", { label: "Tercero", tone: "secondary" }),
    },
}))

/** Columns for the LedgerDrawer embedded table. */
export const ledgerMovementDrawerViews = ledgerMovementEntity.views({
    table: {
        columns: ["date", "description", "debit", "credit", "balance"],
        primary: "date",
    },
})

/** Columns for the standalone Account Ledger page. */
export const ledgerMovementPageViews = ledgerMovementEntity.views({
    table: {
        columns: ["date", "reference", "description", "partner", "debit", "credit", "balance"],
        primary: "date",
    },
})
