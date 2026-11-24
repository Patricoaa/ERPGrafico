"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { cn } from "@/lib/utils"
import type { JournalEntry } from "../hooks/useJournalEntries"

// ─── ledgerAccount: «código · nombre», a la izquierda en el Debe y a la derecha en el Haber ──────────

export interface LedgerAccountValue { text: string; side: "debit" | "credit" }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        ledgerAccount: { value: LedgerAccountValue | null; options: Record<never, never> }
    }
}

function LedgerAccountCell({ value }: ValueRenderProps<"ledgerAccount">) {
    if (!value) return null
    return (
        <span className={cn("block w-full truncate", value.side === "credit" ? "text-right" : "text-left")}>
            {value.text}
        </span>
    )
}

registerValueKind("ledgerAccount", {
    format: (v) => v?.text ?? "",
    // La cuenta toma el ancho sobrante; Debe y Haber quedan al ancho de su contenido.
    shrink: true,
    render: LedgerAccountCell,
})

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
        account: f.value(
            "ledgerAccount",
            (l) => ({ text: `${l.account_code} · ${l.account_name}`, side: l.credit > 0 && !(l.debit > 0) ? "credit" : "debit" }),
            { label: "Cuenta" },
        ),
        debit: f.money((l) => l.debit > 0 ? l.debit : null, { label: "Debe", align: "start" }),
        credit: f.money((l) => l.credit > 0 ? l.credit : null, { label: "Haber", align: "end" }),
        label: f.text("label", { label: "Concepto" }),
    },
}))

/** View for the JournalEntrySheet lines table (read-only, compact). */
export const journalEntryLineSheetViews = journalEntryLineEntity.views({
    table: {
        columns: ["account", "debit", "credit", "label"],
        footer: { sum: ["debit", "credit"] },
    },
})