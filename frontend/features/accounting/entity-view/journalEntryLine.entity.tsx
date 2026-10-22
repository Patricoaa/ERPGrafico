"use client"

import { defineEntity } from "@/components/entity-view"
import type { JournalEntry } from "../hooks/useJournalEntries"

/** Journal Entry Line entity for use in JournalEntrySheet lines table. */
export interface JournalEntryLine {
    id: number
    account: number
    account_code: string
    account_name: string
    partner: number | null
    label: string
    debit: number
    credit: number
}

export const journalEntryLineEntity = defineEntity<JournalEntryLine>()((f) => ({
    title: "Líneas de Asiento",
    fields: {
        account_code: f.text("account_code", { label: "Cuenta" }),
        account_name: f.text("account_name", { label: "Nombre" }),
        label: f.text("label", { label: "Concepto" }),
        debit: f.money((l) => l.debit > 0 ? l.debit : null, { label: "Debe" }),
        credit: f.money((l) => l.credit > 0 ? l.credit : null, { label: "Haber" }),
    },
}))

/** View for the JournalEntrySheet lines table (read-only, compact). */
export const journalEntryLineSheetViews = journalEntryLineEntity.views({
    table: {
        columns: ["account_code", "account_name", "label", "debit", "credit"],
        primary: "account_code",
    },
})