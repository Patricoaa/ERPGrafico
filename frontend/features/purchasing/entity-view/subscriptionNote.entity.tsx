"use client"

import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { translateStatus } from "@/lib/utils"

// ─── subscriptionNoteDoc: display_id + dte_type secondary ────────────────────

interface NoteDocValue { displayId: string; dteType: string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        subscriptionNoteDoc: { value: NoteDocValue | null; options: Record<never, never> }
    }
}

function NoteDocCell({ value }: ValueRenderProps<"subscriptionNoteDoc">) {
    if (!value) return null
    return (
        <div className="flex flex-col">
            <span className="font-black text-sm text-primary">{value.displayId}</span>
            <span className="text-4xs text-muted-foreground font-bold uppercase">
                {value.dteType.replace(/_/g, " ")}
            </span>
        </div>
    )
}

registerValueKind("subscriptionNoteDoc", {
    format: (v) => v?.displayId ?? "",
    render: NoteDocCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

export interface SubscriptionNoteEntry {
    id: number
    number: string
    display_id: string
    date: string
    status: string
    dte_type: string
    total: number
    purchase_order_number: string | null
}

const fixed = { sortable: false } as const

export const subscriptionNoteEntity = defineEntity<SubscriptionNoteEntry>()((f) => ({
    label: "billing.invoice",
    fields: {
        note: f.value("subscriptionNoteDoc", (r) => ({ displayId: r.display_id, dteType: r.dte_type }), { ...fixed, label: "Nota" }),
        relatedOCS: f.text((r) => (r.purchase_order_number ? `OCS-${r.purchase_order_number}` : null), { ...fixed, label: "OCS Relacionada" }),
        date: f.date("date", { ...fixed, label: "Fecha" }),
        status: f.status(
            (r) => ({ status: r.status === "POSTED" ? "SUCCESS" : "NEUTRAL", label: translateStatus(r.status) }),
            { ...fixed, label: "Estado" }
        ),
        total: f.money("total", { ...fixed, label: "Monto Total" }),
    },
}))

export const subscriptionNoteViews = subscriptionNoteEntity.views({
    table: { columns: ["note", "relatedOCS", "date", "status", "total"] },
})
