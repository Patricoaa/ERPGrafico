"use client"

import { DocumentRefLink } from "@/features/documents"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { Check } from "../checks/types"

/**
 * Feature extension: the check's associated sale order, as a raw ADR-0080 DocumentRef — the
 * generic `docRef` kind doesn't fit (its value is a client-built {label,id,display}, not a raw
 * backend DocumentRef with accessible/url), same reasoning as inventoryDocRef (oleada B3).
 */
declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        checkSaleOrder: { value: Check; options: Record<never, never> }
    }
}

function CheckSaleOrderCell({ value: check }: ValueRenderProps<"checkSaleOrder">) {
    if (!check.sale_order_document) return null
    return (
        <div className="flex justify-center">
            <DocumentRefLink documentRef={check.sale_order_document} />
        </div>
    )
}

let registered = false
function registerCheckValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("checkSaleOrder", {
        format: (c) => c.sale_order_display?.number != null ? String(c.sale_order_display.number) : "",
        render: CheckSaleOrderCell,
    })
}

// The entity owns its extension: loading this module registers it (no app bootstrap needed).
registerCheckValueKinds()

/** Checks (received or issued) (ADR-0087 oleada C1). Replaces checkFields.tsx (1 computed). */
export const checkEntity = defineEntity<Check>()((f) => ({
    label: "treasury.check",
    fields: {
        folio: f.code("display_id", { label: "Folio" }),
        checkNumber: f.text("check_number", { label: "# Cheque" }),
        dueDate: f.date("due_date", { label: "Vencimiento" }),
        amount: f.money("amount", { label: "Monto" }),
        saleOrder: f.value("checkSaleOrder", (c) => c, { label: "OV Asociada" }),
        status: f.status((c) => ({ status: c.status, label: c.status_display }), { label: "Estado" }),
        // Not shown in table/card — only a group-by target (a view not scoped to one direction can mix both).
        direction: f.text("direction_display", { label: "Dirección" }),
    },
    // ADR-0158 §3, client mode: the server filters, the browser sorts. `bank` options come from the screen.
    query: {
        search: { placeholder: "Buscar por N° cheque, girador o monto…" },
        filters: {
            bank: { label: "Banco", control: "single", options: "remote" },
            status: {
                field: "status",
                control: "single",
                options: [
                    { value: "IN_PORTFOLIO", label: "En Cartera" },
                    { value: "DEPOSITED", label: "Depositado" },
                    { value: "CLEARED", label: "Cobrado" },
                    { value: "BOUNCED", label: "Protestado" },
                    { value: "VOIDED", label: "Anulado" },
                ],
            },
            due_date: { field: "dueDate", control: "date", paramFrom: "due_date_after", paramTo: "due_date_before" },
        },
        sort: { fields: ["dueDate", "folio", "checkNumber", "amount", "status", "direction"], default: "dueDate" },
        groupBy: { fields: ["status", "direction"] },
        views: [
            { id: "all", label: "Todos" },
            { id: "portfolio", label: "En cartera", filters: { status: "IN_PORTFOLIO" } },
            { id: "deposited", label: "Depositados", filters: { status: "DEPOSITED" } },
        ],
    },
}))

export const checkViews = checkEntity.views({
    table: { columns: ["folio", "checkNumber", "dueDate", "amount", "saleOrder", "status"], primary: "folio" },
    card: {
        rail: { status: (r) => r.status },
        title: "checkNumber",
        subtitle: ["folio", "dueDate"],
        trailing: ["amount"],
        meta: ["status", "saleOrder"],
    },
})
