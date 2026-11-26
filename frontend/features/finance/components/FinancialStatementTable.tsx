"use client"

import * as React from "react"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { financialStatementEntity, isDrillableLine, toStatementLines, type StatementLine } from "../entity-view/financialStatement.entity"
import type { DrillDownTarget, ReportNode, VarianceDirection } from "../types"

interface FinancialStatementTableProps {
    data: readonly ReportNode[]
    showComparison?: boolean
    periodLabel?: string
    compPeriodLabel?: string
    /** Direction of the lines that do not set one (their section's otherwise). */
    varianceDirection?: VarianceDirection
    /** Account rows open their ledger through this; without it no row opens. */
    onDrillDown?: (target: DrillDownTarget) => void
}

/**
 * A financial statement as an entity-view tree (replaces `ReportTable`): sections and totals are
 * row tones, accounts drill into their ledger, comparison adds the previous period and the variance.
 */
export function FinancialStatementTable({ data, showComparison = false, periodLabel, compPeriodLabel, varianceDirection, onDrillDown }: FinancialStatementTableProps) {
    const { entity, table, comparedTable } = React.useMemo(() => financialStatementEntity({ period: periodLabel, comparison: compPeriodLabel }), [periodLabel, compPeriodLabel])
    const rows = React.useMemo(() => toStatementLines(data, varianceDirection), [data, varianceDirection])
    const collection = useEntityCollection(entity, { rows, rowCount: rows.length }, {
        pagination: { mode: "none" },
        rowTone: (line: StatementLine) => (line.isTotalRow ? "total" : line.level === 0 ? "section" : null),
        openable: isDrillableLine,
    })
    const open = onDrillDown
        ? (line: StatementLine) => onDrillDown({ accountId: Number(line.id), accountName: line.name, accountCode: line.code ?? "" })
        : undefined

    return (
        <Collection.Root collection={collection} onOpen={open} label="Estado financiero">
            <Collection.View
                table={showComparison ? comparedTable : table}
                emptyTitle="Sin datos en este período"
                emptyDescription="No hay movimientos contables para el período seleccionado."
            />
        </Collection.Root>
    )
}
