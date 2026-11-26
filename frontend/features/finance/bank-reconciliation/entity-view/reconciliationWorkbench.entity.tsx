"use client"

import { Sparkles } from "lucide-react"
import { defineEntity, registerValueKind } from "@/components/entity-view"
import { Chip } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { BankStatementLine, ReconciliationSystemItem } from "../types"

/**
 * The two lists of the reconciliation workbench (ReconciliationPanel): pending statement lines and the
 * treasury movements to match them with. The screen derives `suggested` from its selection (the match
 * suggestions of the selected row) and the movement's direction from the reconciled account.
 */
export interface WorkbenchLineRow extends BankStatementLine {
    suggested: boolean
}

export interface WorkbenchItemRow extends ReconciliationSystemItem {
    suggested: boolean
    deposit: boolean
    typeLabel: string
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        workbenchLineDesc: {
            value: { description: string; reference: string | null; excluded: boolean; suggested: boolean }
            options: Record<never, never>
        }
        workbenchItemParty: {
            value: { name: string; batch: string | null; suggested: boolean }
            options: Record<never, never>
        }
    }
}

function SuggestedMark() {
    return (
        <span className="mt-0.5 flex items-center gap-1 text-3xs font-bold uppercase text-warning-text">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            Match sugerido
        </span>
    )
}

let registered = false
function registerWorkbenchKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("workbenchLineDesc", {
        format: (v) => v.description,
        sortValue: (v) => v.description,
        shrink: true,
        render: ({ value }) => (
            <div className="flex min-w-0 flex-col gap-0.5 py-1">
                <span className={cn("truncate text-xs", value.suggested && "text-warning-text")} title={value.description}>{value.description}</span>
                {value.excluded && <Chip size="xs" intent="destructive" className="w-fit">Excluido</Chip>}
                {value.reference && <span className="truncate font-mono text-3xs text-muted-foreground">REF: {value.reference}</span>}
                {value.suggested && <SuggestedMark />}
            </div>
        ),
    })
    registerValueKind("workbenchItemParty", {
        format: (v) => v.name,
        sortValue: (v) => v.name,
        shrink: true,
        render: ({ value }) => (
            <div className="flex min-w-0 flex-col gap-0.5 py-1">
                <span className={cn("truncate text-xs font-bold", value.suggested && "text-warning-text")} title={value.name}>{value.name}</span>
                {value.batch && <Chip size="xs" intent="info" className="w-fit">Liquidación Terminal: {value.batch}</Chip>}
                {value.suggested && <SuggestedMark />}
            </div>
        ),
    })
}
registerWorkbenchKinds()

const isCredit = (l: BankStatementLine) => Number(l.credit) > Number(l.debit)

export const workbenchLineEntity = defineEntity<WorkbenchLineRow>()((f) => ({
    title: "Cartola bancaria",
    rowId: (l) => l.id,
    fields: {
        line: f.code("line_number", { label: "Línea" }),
        date: f.date("transaction_date", { label: "Fecha" }),
        description: f.value(
            "workbenchLineDesc",
            (l) => ({ description: l.description, reference: l.reference || null, excluded: l.reconciliation_status === "EXCLUDED", suggested: l.suggested }),
            { label: "Descripción" },
        ),
        type: f.text((l) => (isCredit(l) ? "Abono" : "Cargo"), { label: "Tipo", tone: "secondary" }),
        amount: f.flow((l) => Math.abs(Number(l.credit) - Number(l.debit)), { label: "Monto", direction: (l) => (isCredit(l) ? "inflow" : "outflow"), showIcon: false }),
    },
    // One search and date range for both lists and the reconciled tab (server params).
    query: {
        search: { placeholder: "Buscar movimientos y pagos por descripción, monto…" },
        filters: {
            type: {
                label: "Tipo",
                control: "single",
                options: [
                    { label: "Abonos / Ingresos", value: "IN" },
                    { label: "Cargos / Egresos", value: "OUT" },
                ],
            },
            date: { field: "date", control: "date", paramFrom: "date_from", paramTo: "date_to", presets: ["today", "this_week", "this_month", "this_quarter", "this_year"] },
        },
    },
}))

export const workbenchLineViews = workbenchLineEntity.views({
    table: { columns: ["line", "date", "description", "type", "amount"], primary: "description" },
})

export const workbenchItemEntity = defineEntity<WorkbenchItemRow>()((f) => ({
    title: "Movimientos de tesorería",
    rowId: (i) => i.id,
    fields: {
        document: f.code((i) => i.display_id || i.code || "PEND", { label: "Documento" }),
        date: f.date("date", { label: "Fecha" }),
        party: f.value(
            "workbenchItemParty",
            (i) => ({ name: i.contact_name, batch: i.terminal_batch_id ? i.terminal_batch_display ?? null : null, suggested: i.suggested }),
            { label: "Entidad / Concepto" },
        ),
        type: f.text("typeLabel", { label: "Tipo", tone: "secondary" }),
        amount: f.flow((i) => Math.abs(Number(i.amount)), { label: "Monto", direction: (i) => (i.deposit ? "inflow" : "outflow"), showIcon: false }),
    },
}))

export const workbenchItemViews = workbenchItemEntity.views({
    table: { columns: ["document", "date", "party", "type", "amount"], primary: "party" },
})
