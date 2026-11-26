import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { FINANCE_KEYS } from "./queryKeys"
import type { BudgetVarianceNode } from "../types"

const HEADERS = [
    "Cuenta", "Detalle", "Real mes", "Presupuesto mes", "Desviación mes",
    "Real acumulado", "Presupuesto acumulado", "Desviación acumulada",
]

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/

/** Escapa comillas y neutraliza celdas de texto que Excel/LibreOffice leería como fórmula. */
const cell = (value: string | number): string => {
    const raw = String(value)
    const safe = typeof value === "string" && CSV_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw
    return `"${safe.replace(/"/g, '""')}"`
}

function flatten(nodes: readonly BudgetVarianceNode[]): BudgetVarianceNode[] {
    return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])])
}

/**
 * Export de la barra de comandos (ADR-0158 §12): genera el CSV desde la variación ya cargada
 * en la caché, con el mismo key que `useBudgetVariance` (mes/año incluidos).
 */
export function useBudgetVarianceExport() {
    const queryClient = useQueryClient()

    const run = useCallback((format: string, filters: Record<string, unknown>) => {
        if (format !== "csv") return
        const id = Number(filters.budget)
        const params = { month: filters.month, year: filters.year }
        const rows = queryClient.getQueryData<BudgetVarianceNode[]>(
            FINANCE_KEYS.budgets.variance(id, params),
        )
        if (!rows?.length) {
            toast.error("No hay datos de variación para exportar")
            return
        }

        const lines = [
            HEADERS.map(cell).join(","),
            ...flatten(rows).map((node) => [
                node.code,
                node.name,
                node.month_actual,
                node.month_budget,
                node.month_variance,
                node.ytd_actual,
                node.ytd_budget,
                node.ytd_variance,
            ].map(cell).join(",")),
        ]
        const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `variacion_${id}_${String(filters.year ?? "")}-${String(filters.month ?? "")}.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        // Revocar en el mismo tick puede cancelar la descarga en Chromium.
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
        toast.success("Exportación iniciada")
    }, [queryClient])

    return { run, isPending: false }
}
