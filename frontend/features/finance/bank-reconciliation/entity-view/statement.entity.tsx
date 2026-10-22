"use client"

import { defineEntity, registerValueKind } from "@/components/entity-view"
import { DataCell } from "@/components/shared"
import type { BankStatement } from "../types"

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        statementLines: {
            value: { total_lines: number; reconciled_lines: number } | null
            options: Record<never, never>
        }
    }
}

registerValueKind("statementLines", {
    format: (v) => (v ? `${v.total_lines} total / ${v.reconciled_lines} rec.` : ""),
    sortValue: (v) => v?.total_lines ?? null,
    render: ({ value }) =>
        value ? (
            <div className="flex flex-col items-center justify-center w-full">
                <span className="font-semibold text-xs">{value.total_lines} total</span>
                <span className="text-xs text-muted-foreground">{value.reconciled_lines} rec.</span>
            </div>
        ) : (
            <DataCell.Empty />
        ),
    inline: ({ value }) =>
        value ? (
            <DataCell.Text inline>
                {value.total_lines} / {value.reconciled_lines}
            </DataCell.Text>
        ) : (
            <DataCell.Empty inline />
        ),
})

export const statementEntity = defineEntity<BankStatement>()((f) => ({
    label: "treasury.bankstatement",
    fields: {
        displayId: f.code("display_id", { label: "Folio" }),
        account: f.text("treasury_account_name", { label: "Cuenta", tone: "secondary" }),
        date: f.date("statement_date", { label: "Fecha" }),
        openingBalance: f.money("opening_balance", { label: "Apertura" }),
        closingBalance: f.money("closing_balance", { label: "Cierre" }),
        lines: f.value(
            "statementLines",
            (e) => ({ total_lines: e.total_lines, reconciled_lines: e.reconciled_lines }),
            { label: "Líneas" },
        ),
        progress: f.value(
            "progress",
            (e) => ({ done: e.reconciled_lines, total: e.total_lines }),
            { label: "Progreso" },
        ),
        state: f.status(
            (e) => ({ status: e.state, label: e.state_display }),
            { label: "Estado" },
        ),
    },
}))

export const statementViews = statementEntity.views({
    table: {
        columns: ["displayId", "account", "date", "openingBalance", "closingBalance", "lines", "progress", "state"],
        primary: "displayId",
    },
    card: {
        title: "displayId",
        subtitle: ["account"],
        meta: ["date", "state"],
        trailing: ["closingBalance"],
        body: { kind: "progress", field: "progress" },
    },
})
