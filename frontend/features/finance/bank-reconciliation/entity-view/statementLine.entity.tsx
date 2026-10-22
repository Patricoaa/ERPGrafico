"use client"

import { defineEntity, registerValueKind } from "@/components/entity-view"
import { DataCell } from "@/components/shared"
import type { BankStatementLine } from "../types"

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        statementLineDesc: {
            value: { description: string; reference: string | null } | null
            options: Record<never, never>
        }
    }
}

registerValueKind("statementLineDesc", {
    format: (v) => v?.description ?? "",
    sortValue: (v) => v?.description ?? null,
    render: ({ value }) =>
        value ? (
            <div className="flex flex-col max-w-[200px]">
                <span className="font-medium text-xs truncate" title={value.description}>
                    {value.description}
                </span>
                {value.reference && (
                    <span className="text-3xs text-muted-foreground truncate">{value.reference}</span>
                )}
            </div>
        ) : (
            <DataCell.Empty />
        ),
    inline: ({ value }) =>
        value ? (
            <DataCell.Text inline>
                <span className="truncate" title={value.description}>
                    {value.description}
                </span>
            </DataCell.Text>
        ) : (
            <DataCell.Empty inline />
        ),
})

export const statementLineEntity = defineEntity<BankStatementLine>()((f) => ({
    title: "Líneas de Cartola",
    fields: {
        lineNumber: f.code("line_number", { label: "#" }),
        date: f.date("transaction_date", { label: "Fecha" }),
        description: f.value(
            "statementLineDesc",
            (l) => ({ description: l.description, reference: l.reference || null }),
            { label: "Descripción" },
        ),
        debit: f.money((l) => (Number(l.debit) > 0 ? l.debit : null), { label: "Cargo" }),
        credit: f.money((l) => (Number(l.credit) > 0 ? l.credit : null), { label: "Abono" }),
        balance: f.money("balance", { label: "Saldo" }),
        reconciliationState: f.status(
            (l) => ({
                status: l.reconciliation_state,
                label: l.reconciliation_state === "MATCHED" ? "Sugerencia Match" : l.reconciliation_state_display,
            }),
            { label: "Estado" },
        ),
        matchedPayment: f.code(
            (l) => l.matched_payment_info?.display_id ?? null,
            { label: "Pago Vinculado" },
        ),
    },
}))

export const statementLineViews = statementLineEntity.views({
    table: {
        columns: ["lineNumber", "date", "description", "debit", "credit", "balance", "reconciliationState", "matchedPayment"],
        primary: "description",
    },
})
