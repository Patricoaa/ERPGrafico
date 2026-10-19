"use client"

import { DocumentRefLink } from "@/features/documents"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { CreditHistoryEntry } from "../api/creditsApi"

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        creditHistoryDocument: { value: CreditHistoryEntry; options: Record<never, never> }
    }
}

function CreditHistoryDocumentCell({ value: entry }: ValueRenderProps<"creditHistoryDocument">) {
    if (!entry.document) return null
    return (
        <div className="flex justify-center">
            <DocumentRefLink documentRef={entry.document} />
        </div>
    )
}

let registered = false
function registerCreditHistoryEntryValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("creditHistoryDocument", {
        format: (e) => e.display_id || e.number || "",
        render: CreditHistoryDocumentCell,
    })
}

registerCreditHistoryEntryValueKinds()

export const creditHistoryEntryEntity = defineEntity<CreditHistoryEntry>()((f) => ({
    title: "Historial de Crédito",
    fields: {
        date: f.date("date", { label: "Fecha" }),
        customerName: f.contact(
            (h) => h.customer_id != null ? { id: h.customer_id, name: h.customer_name } : null,
            { label: "Cliente" },
        ),
        saleOrder: f.value("creditHistoryDocument", (h) => h, { label: "Nota Venta" }),
        effectiveTotal: f.money("effective_total", { label: "Monto" }),
        origin: f.status(
            (h) => h.credit_assignment_origin
                ? { status: `ORIGIN_${h.credit_assignment_origin}`, label: h.credit_assignment_origin_display }
                : null,
            { label: "Origen" },
        ),
    },
}))

export const creditHistoryEntryViews = creditHistoryEntryEntity.views({
    table: {
        columns: ["date", "customerName", "saleOrder", "effectiveTotal", "origin"],
        primary: "date",
    },
})
