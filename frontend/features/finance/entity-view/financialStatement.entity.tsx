"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { defineEntity, formatMoneyValue, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { MoneyDisplay } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { ReportNode, VarianceDirection } from "../types"

/**
 * Financial statement lines (balance sheet, income statement, cash flow) on entity-view, replacing
 * the shared `ReportTable` (ADR-0087; row tones and `openable` from the ADR-0159 amendment).
 * The column headers are the period labels, so the entity is built per pair of labels
 * (`financialStatementEntity`); the screen memoizes it.
 */
export interface StatementLine extends ReportNode {
    children?: StatementLine[]
    /** Depth in the statement: 0 = section heading. */
    level: number
    /** Inherited from the section when the line does not set it. */
    direction: VarianceDirection
}

/** Statement nodes → lines: depth and the section's variance direction pushed down to every account. */
export function toStatementLines(nodes: readonly ReportNode[], direction: VarianceDirection = "higher-is-better", level = 0): StatementLine[] {
    return nodes.map((node) => {
        const own = node.varianceDirection ?? direction
        return { ...node, level, direction: own, children: node.children?.length ? toStatementLines(node.children, own, level + 1) : undefined }
    })
}

/** An account (positive numeric id) opens its ledger; section and total rows do not. */
export function isDrillableLine(line: StatementLine): boolean {
    const id = Number(line.id)
    return !line.isTotalRow && Number.isInteger(id) && id > 0
}

export interface StatementVariance {
    balance: number
    comp: number
    direction: VarianceDirection
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        statementAccount: { value: { code: string; name: string }; options: Record<never, never> }
        statementVariance: { value: StatementVariance; options: Record<never, never> }
    }
}

function StatementAccountInline({ value }: ValueRenderProps<"statementAccount">) {
    return (
        <span className="inline-flex min-w-0 items-baseline gap-2">
            {value.code && <span className="font-mono text-2xs text-muted-foreground">{value.code}</span>}
            <span className="truncate">{value.name}</span>
        </span>
    )
}

function StatementVarianceCell({ value }: ValueRenderProps<"statementVariance">) {
    const { balance, comp, direction } = value
    if (balance === 0 && comp === 0) return null
    const variance = balance - comp
    const pct = comp !== 0 ? ((variance / Math.abs(comp)) * 100).toFixed(1) : null
    const good = variance === 0 ? null : (variance > 0) === (direction === "higher-is-better")
    const Icon = variance > 0 ? TrendingUp : TrendingDown
    return (
        <div className="flex flex-col items-end">
            <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs font-semibold", good === null ? "text-muted-foreground" : good ? "text-success-text" : "text-destructive")}>
                {variance !== 0 && <Icon className="size-3" aria-hidden />}
                <MoneyDisplay amount={variance} showColor={false} inline />
            </span>
            {pct && <span className="font-mono text-3xs text-muted-foreground">{pct}%</span>}
        </div>
    )
}

let registered = false
function registerStatementKinds(): void {
    if (registered) return
    registered = true
    registerValueKind("statementAccount", {
        format: (v) => (v.code ? `${v.code} ${v.name}` : v.name),
        render: StatementAccountInline,
        inline: StatementAccountInline,
    })
    registerValueKind("statementVariance", {
        format: (v) => {
            const variance = v.balance - v.comp
            return v.comp !== 0 ? `${formatMoneyValue(variance)} (${((variance / Math.abs(v.comp)) * 100).toFixed(1)}%)` : formatMoneyValue(variance)
        },
        sortValue: (v) => v.balance - v.comp,
        render: StatementVarianceCell,
    })
}
registerStatementKinds()

export interface StatementLabels {
    /** Current period column header («2026», «ene–nov 2026»). */
    period?: string
    /** Comparison period column header. */
    comparison?: string
}

/** Entity + views of a statement for a pair of period labels (memoize per labels). */
export function financialStatementEntity({ period, comparison }: StatementLabels) {
    const entity = defineEntity<StatementLine>()((f) => ({
        title: "Estado financiero",
        tree: { children: (line) => line.children },
        fields: {
            account: f.value("statementAccount", (line) => ({ code: line.code, name: line.name }), { label: "Cuenta / Concepto", sortable: false }),
            balance: f.money("balance", { label: "Saldo", header: period, sortable: false }),
            compBalance: f.money((line) => line.comp_balance ?? 0, { label: "Período comparativo", header: comparison ?? "Anterior", sortable: false }),
            variance: f.value("statementVariance", (line) => ({ balance: line.balance || 0, comp: line.comp_balance || 0, direction: line.direction }), { label: "Var.", sortable: false }),
        },
    }))
    const views = entity.views({ table: { columns: ["account", "balance"], primary: "account" } })
    const compared = entity.views({ table: { columns: ["account", "balance", "compBalance", "variance"], primary: "account" } })
    return { entity, table: views.table, comparedTable: compared.table }
}
