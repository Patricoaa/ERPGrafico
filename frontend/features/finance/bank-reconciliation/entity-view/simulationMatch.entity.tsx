"use client"

import { DataCell, MoneyDisplay } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { formatPlainDate } from "@/lib/utils"

// ─── bankLine: description + date/amount sub-line ────────────────────────────

export interface BankLineValue { description: string; date: string; amount: number | string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        bankLine: { value: BankLineValue | null; options: Record<never, never> }
    }
}

function BankLineCell({ value }: ValueRenderProps<"bankLine">) {
    if (!value) return null
    return (
        <div className="flex flex-col items-start justify-start text-left w-full gap-0.5">
            <DataCell.Text className="text-left justify-start font-black text-foreground/80">
                {value.description}
            </DataCell.Text>
            <div className="text-3xs font-mono text-muted-foreground mt-0.5">
                {formatPlainDate(value.date)} •{" "}
                <span className="font-bold text-foreground/60">
                    <MoneyDisplay amount={value.amount} inline className="text-3xs" />
                </span>
            </div>
        </div>
    )
}

registerValueKind("bankLine", {
    format: (v) => v?.description ?? "",
    render: BankLineCell,
})

// ─── systemMatch: partner + reference/amount sub-line ────────────────────────

export interface SystemMatchValue { partner?: string; reference?: string; amount: number | string }

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        systemMatch: { value: SystemMatchValue | null; options: Record<never, never> }
    }
}

function SystemMatchCell({ value }: ValueRenderProps<"systemMatch">) {
    if (!value) return null
    return (
        <div className="flex flex-col items-start justify-start text-left w-full gap-0.5">
            <DataCell.Text className="text-left justify-start font-black text-foreground/80">
                {value.partner || "Concepto General"}
            </DataCell.Text>
            <div className="text-3xs font-mono text-muted-foreground mt-0.5">
                Ref: <span className="font-bold">{value.reference || "N/A"}</span> •{" "}
                <span className="font-bold">
                    <MoneyDisplay amount={value.amount} inline className="text-3xs" />
                </span>
            </div>
        </div>
    )
}

registerValueKind("systemMatch", {
    format: (v) => v?.partner ?? "Concepto General",
    render: SystemMatchCell,
})

// ─── matchScore: percentage chip with computed intent ────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        matchScore: { value: number | null | undefined; options: Record<never, never> }
    }
}

function MatchScoreCell({ value }: ValueRenderProps<"matchScore">) {
    if (value === null || value === undefined) return null
    const score = Math.round(value)
    const intent = score >= 90 ? "success" : score >= 70 ? "warning" : "neutral"
    return (
        <div className="flex justify-end w-full">
            <DataCell.Chip intent={intent} size="xs" className="w-fit font-mono font-black">
                {score}%
            </DataCell.Chip>
        </div>
    )
}

registerValueKind("matchScore", {
    format: (v) => (v !== null && v !== undefined ? `${Math.round(v)}%` : ""),
    align: "end",
    render: MatchScoreCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

export interface SimulationMatchRow {
    line: BankLineValue
    payment: SystemMatchValue
    score: number
}

const fixed = { sortable: false } as const

export const simulationMatchEntity = defineEntity<SimulationMatchRow>()((f) => ({
    title: "Resultados de simulación",
    fields: {
        bankLine: f.value("bankLine", (r) => r.line, { ...fixed, label: "Línea Banco" }),
        systemMatch: f.value("systemMatch", (r) => r.payment, { ...fixed, label: "Coincidencia Sistema" }),
        score: f.value("matchScore", (r) => r.score, { ...fixed, label: "Score", align: "end" }),
    },
}))

export const simulationMatchViews = simulationMatchEntity.views({
    table: { columns: ["bankLine", "systemMatch", "score"] },
})
