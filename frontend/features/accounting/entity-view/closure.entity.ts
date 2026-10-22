import { defineEntity, formatDate, type StatusValue } from "@/components/entity-view"
import { monthState, yearState, type ClosureRow } from "../utils/closureTree"

function taxStatus(row: ClosureRow): StatusValue | null {
    if (row.kind !== "month" || !row.tax) return null
    const s = monthState(row)
    if (s.taxClosed) return { status: "CLOSED", label: "Cerrado" }
    if (!s.hasDeclaration) return { status: "OPEN", label: "Pendiente" }
    return s.isFullyPaid && s.requiresPayment ? { status: "PAID", label: "Pagado" } : { status: "UNDER_REVIEW", label: "Declarado" }
}

function periodStatus(row: ClosureRow): StatusValue | null {
    if (row.kind === "year") return { status: row.fiscalYear?.status || "OPEN" }
    return row.acct ? { status: row.acct.status, label: row.acct.status_display } : null
}

function closedInfo(row: ClosureRow): string | null {
    if (row.kind !== "year" || !row.fiscalYear?.closed_at) return null
    const by = row.fiscalYear.closed_by_name ? ` por ${row.fiscalYear.closed_by_name}` : ""
    return `${formatDate(row.fiscalYear.closed_at)}${by}`
}

/**
 * Fiscal closures (ADR-0087, tree): fiscal year → its 12 months, each with its accounting and tax
 * (F29) period. Replaces fiscalYearFields.tsx + FiscalYearCard + CombinedPeriodCard (§6.19, approved).
 */
export const closureEntity = defineEntity<ClosureRow>()((f) => ({
    title: "Ejercicios fiscales",
    rowId: (r) => r.id,
    tree: { children: (r) => (r.kind === "year" ? r.children : undefined) },
    fields: {
        period: f.text((r) => (r.kind === "year" ? `Ejercicio ${r.year}` : r.monthName), { label: "Periodo", sortable: false }),
        // Year rows: the fiscal year status; month rows: the accounting period status.
        status: f.status(periodStatus, { label: "Estado", sortable: false }),
        tax: f.status(taxStatus, { label: "F29", sortable: false }),
        acctProgress: f.progress(
            (r) => (r.kind === "year" && r.periods.length > 0 ? { done: yearState(r).closedAcct, total: r.periods.length } : null),
            { label: "Cierres contables", format: "ratio", sortable: false },
        ),
        taxProgress: f.progress(
            (r) => (r.kind === "year" && r.taxPeriods.length > 0 ? { done: yearState(r).closedTax, total: r.taxPeriods.length } : null),
            { label: "Cierres F29", format: "ratio", sortable: false },
        ),
        closedAt: f.text(closedInfo, { label: "Cierre del ejercicio", tone: "secondary", sortable: false }),
    },
}))

export const closureViews = closureEntity.views({
    table: { columns: ["period", "status", "tax", "acctProgress", "taxProgress", "closedAt"] },
})
