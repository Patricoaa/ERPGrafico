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
    // ADR-0158 §3: el historial carga todo y filtra en el navegador (id del filtro = clave de la fila).
    query: {
        search: { placeholder: "Cliente o folio…" },
        filters: {
            credit_assignment_origin: {
                field: "origin",
                control: "single",
                options: [
                    { value: "MANUAL", label: "Manual" },
                    { value: "SALE", label: "Venta" },
                    { value: "ADJUSTMENT", label: "Ajuste" },
                    { value: "REVERSAL", label: "Reversión" },
                ],
            },
        },
        sort: { fields: ["date", "customerName", "effectiveTotal"], default: "-date" },
        groupBy: { fields: ["origin"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "manual", label: "Manual", filters: { credit_assignment_origin: "MANUAL" } },
            { id: "sale", label: "Venta", filters: { credit_assignment_origin: "SALE" } },
            { id: "adjustment", label: "Ajuste", filters: { credit_assignment_origin: "ADJUSTMENT" } },
            { id: "reversal", label: "Reversión", filters: { credit_assignment_origin: "REVERSAL" } },
        ],
    },
}))

export const creditHistoryEntryViews = creditHistoryEntryEntity.views({
    table: {
        columns: ["date", "customerName", "saleOrder", "effectiveTotal", "origin"],
        primary: "date",
    },
})
