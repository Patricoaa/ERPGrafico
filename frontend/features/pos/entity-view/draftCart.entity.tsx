"use client"

import { Lock, User } from "lucide-react"
import { Chip } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDraftNumber, resolveDraftStatusChips } from "../utils/draft-status"
import type { DraftCart } from "../components/DraftCartsClientView"

/**
 * A draft in the session's draft picker. The lock comes from the real-time sync (WebSocket) and the
 * relative time ticks every minute, so the picker derives both per render and hands them on the row.
 */
export interface DraftCartRow extends DraftCart {
    lock: { isLocked: boolean; lockedByName: string | null; isOwnLock: boolean }
    /** The draft loaded in the cart right now. */
    isCurrent: boolean
    /** «Hace 5m», «Ahora», or the date. */
    updatedLabel: string
}

// ─── draftSummary: name, wizard chips, lock and customer / age line ──────────

export interface DraftSummaryValue {
    name: string
    chips: ReturnType<typeof resolveDraftStatusChips>
    lockedBy: string | null
    customer: string | null
    updated: string
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        draftSummary: { value: DraftSummaryValue; options: Record<never, never> }
    }
}

function DraftSummaryCell({ value }: ValueRenderProps<"draftSummary">) {
    return (
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium leading-tight">{value.name}</span>
                {value.lockedBy !== null && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help">
                                <Chip size="xs" intent="destructive" icon={Lock}>{value.lockedBy || "En uso"}</Chip>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px] text-xs">
                            Este borrador está siendo editado por <strong>{value.lockedBy}</strong>. No se puede cargar hasta que termine.
                        </TooltipContent>
                    </Tooltip>
                )}
                {value.chips.map((chip) => (
                    <Chip key={chip.key} size="xs" intent={chip.intent} icon={chip.icon}>{chip.label}</Chip>
                ))}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-3xs text-muted-foreground">
                {value.customer && (
                    <span className="flex max-w-[140px] items-center gap-0.5 truncate">
                        <User className="size-2.5 shrink-0" aria-hidden />
                        {value.customer}
                    </span>
                )}
                <span className="shrink-0">{value.updated}</span>
            </div>
        </div>
    )
}

registerValueKind("draftSummary", {
    format: (v) => [v.name, v.customer].filter(Boolean).join(" · "),
    render: DraftSummaryCell,
})

function summaryOf(row: DraftCartRow): DraftSummaryValue {
    const lockedByOther = row.lock.isLocked && !row.lock.isOwnLock
    return {
        name: row.name || `Borrador ${formatDraftNumber(row)}`,
        // The «locked by other» chip is shown apart, with its tooltip.
        chips: resolveDraftStatusChips(row, { isOwnLock: row.lock.isOwnLock }).filter((c) => c.key !== "locked"),
        lockedBy: lockedByOther ? row.lock.lockedByName ?? "" : null,
        customer: row.customer_name,
        updated: row.updatedLabel,
    }
}

const fixed = { sortable: false } as const

export const draftCartEntity = defineEntity<DraftCartRow>()((f) => ({
    title: "Borradores",
    rowId: (r) => r.id,
    fields: {
        number: f.code((r) => formatDraftNumber(r), { ...fixed, label: "N°" }),
        summary: f.value("draftSummary", summaryOf, { ...fixed, label: "Nombre / Cliente" }),
        items: f.number("item_count", { ...fixed, label: "Ítems" }),
        total: f.money("total_gross", { ...fixed, label: "Total" }),
    },
}))

export const draftCartViews = draftCartEntity.views({
    table: { columns: ["number", "summary", "items", "total"], primary: "number" },
})
