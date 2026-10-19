"use client"

import { DocumentRefLink } from "@/features/documents"
import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import type { CreditLedgerEntry } from "../api/creditsApi"

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        creditLedgerDocument: { value: CreditLedgerEntry; options: Record<never, never> }
        creditDueDate: { value: CreditLedgerEntry; options: Record<never, never> }
    }
}

export const agingLabel: Record<string, string> = {
    current: "Al día",
    overdue_30: "1-30 días",
    overdue_60: "31-60 días",
    overdue_90: "61-90 días",
    overdue_90plus: "+90 días",
}

function CreditLedgerDocumentCell({ value: entry }: ValueRenderProps<"creditLedgerDocument">) {
    if (!entry.document) return null
    return (
        <div className="flex justify-center">
            <DocumentRefLink documentRef={entry.document} />
        </div>
    )
}

function CreditDueDateCell({ value: entry }: ValueRenderProps<"creditDueDate">) {
    return (
        <div className="flex items-center gap-1.5 w-full">
            <DataCell.Date value={entry.due_date} />
            {entry.days_overdue > 0 && (
                <span className="text-destructive font-bold text-2xs">({entry.days_overdue}d)</span>
            )}
        </div>
    )
}

let registered = false
function registerCreditLedgerEntryValueKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("creditLedgerDocument", {
        format: (e) => e.number || "",
        render: CreditLedgerDocumentCell,
    })
    registerValueKind("creditDueDate", {
        format: (e) => e.due_date || "",
        sortValue: (e) => e.due_date || null,
        render: CreditDueDateCell,
    })
}

registerCreditLedgerEntryValueKinds()

export const creditLedgerEntryEntity = defineEntity<CreditLedgerEntry>()((f) => ({
    title: "Libro de Crédito",
    fields: {
        document: f.value("creditLedgerDocument", (e) => e, { label: "N° Documento" }),
        date: f.date("date", { label: "Fecha" }),
        dueDate: f.value("creditDueDate", (e) => e, { label: "Vencimiento" }),
        total: f.money("effective_total", { label: "Total" }),
        paid: f.flow("paid_amount", { label: "Pagado", direction: "inflow" }),
        balance: f.money("balance", { label: "Saldo" }),
        origin: f.status(
            (e) => e.credit_assignment_origin
                ? { status: `ORIGIN_${e.credit_assignment_origin}`, label: e.credit_assignment_origin_display || e.credit_assignment_origin }
                : null,
            { label: "Origen" },
        ),
        status: f.status(
            (e) => ({
                status: e.aging_bucket === "current" ? "SUCCESS" : e.days_overdue > 60 ? "ERROR" : "WARNING",
                label: agingLabel[e.aging_bucket],
            }),
            { label: "Estado" },
        ),
    },
}))

export const creditLedgerEntryViews = creditLedgerEntryEntity.views({
    table: {
        columns: ["document", "date", "dueDate", "total", "paid", "balance", "origin", "status"],
        primary: "document",
    },
})
