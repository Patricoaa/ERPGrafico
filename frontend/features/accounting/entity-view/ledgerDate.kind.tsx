"use client"

import { DataCell } from "@/components/shared"
import { registerValueKind, EMPTY, formatTimeOfDay, type ValueRenderProps } from "@/components/entity-view"
import { formatPlainDate } from "@/lib/utils"

/**
 * Feature extension: a ledger row's logical date (can be backdated) plus the audit-trail
 * `createdAt` timestamp's time-of-day as a muted suffix — two different fields, not one
 * datetime value, so the core `date` kind's `{time: true}` option doesn't fit (it reads both
 * date and time off the same value). Shared across accounting (Libro Mayor) and settings
 * (libro auxiliar de socio) — this exact markup was duplicated verbatim in both legacy
 * `*Fields.tsx` before this migration (ADR-0087 oleada C3).
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        ledgerDate: { value: { date: string | null | undefined; createdAt?: string | null }; options: Record<never, never> }
    }
}

function LedgerDateCell({ value }: ValueRenderProps<"ledgerDate">) {
    if (!value.date) return <DataCell.Empty />
    return (
        <div className="flex justify-center items-center w-full text-center text-xs font-sans font-medium text-foreground whitespace-nowrap">
            {formatPlainDate(value.date)}
            {value.createdAt && (
                <span className="text-xs text-muted-foreground/60 ml-1.5">
                    {formatTimeOfDay(value.createdAt)}
                </span>
            )}
        </div>
    )
}

let registered = false
export function registerLedgerDateValueKind(): void {
    if (registered) return
    registered = true
    registerValueKind("ledgerDate", {
        format: (v) => (v.date ? formatPlainDate(v.date) : EMPTY),
        sortValue: (v) => v.date ?? null,
        render: LedgerDateCell,
    })
}

// Registered when the accounting barrel is evaluated (same pattern as documents' docRef.kind.tsx).
registerLedgerDateValueKind()
