import type { AccountingPeriod, FiscalYear } from "../types"
import type { TaxPeriod } from "@/features/tax"

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

/** One fiscal year with its accounting and tax (F29) periods. */
export interface FiscalYearGroup {
    year: number
    periods: AccountingPeriod[]
    taxPeriods: TaxPeriod[]
    fiscalYear?: FiscalYear
}

export interface ClosureYearRow {
    kind: "year"
    id: string
    year: number
    fiscalYear?: FiscalYear
    periods: AccountingPeriod[]
    taxPeriods: TaxPeriod[]
    children: ClosureMonthRow[]
}

export interface ClosureMonthRow {
    kind: "month"
    id: string
    year: number
    month: number
    monthName: string
    acct?: AccountingPeriod
    tax?: TaxPeriod
}

/** Row of the closures tree: a fiscal year (parent) or one of its 12 months (child). */
export type ClosureRow = ClosureYearRow | ClosureMonthRow

/** Derived state of a month, shared by the status fields and the row actions (rules of the former CombinedPeriodCard). */
export function monthState(row: ClosureMonthRow) {
    const { acct, tax } = row
    const acctClosed = acct?.status === "CLOSED"
    const taxClosed = tax?.status === "CLOSED"
    const hasDeclaration = !!tax?.declaration_summary
    const isFullyPaid = tax?.declaration_summary?.is_fully_paid ?? true
    const requiresPayment = hasDeclaration && (tax?.declaration_summary?.vat_to_pay ?? 0) > 0
    return {
        acctClosed,
        taxClosed,
        // A closed F29 freezes the accounting period: it cannot be reopened.
        taxFrozen: !!(acct?.tax_period_id && acct?.tax_period_status === "CLOSED"),
        hasDeclaration,
        isFullyPaid,
        requiresPayment,
    }
}

/** Derived state of a year (the former FiscalYearCard header). */
export function yearState(row: ClosureYearRow) {
    const allTaxClosed = row.taxPeriods.length > 0 && row.taxPeriods.every((p) => p.status === "CLOSED")
    const allAcctClosed = row.periods.length > 0 && row.periods.every((p) => p.status === "CLOSED")
    return {
        isClosed: (row.fiscalYear?.status || "OPEN") === "CLOSED",
        closedAcct: row.periods.filter((p) => p.status === "CLOSED").length,
        closedTax: row.taxPeriods.filter((p) => p.status === "CLOSED").length,
        canClose: allTaxClosed && allAcctClosed,
    }
}

/** Years (newest first) with their 12 months, matching accounting and tax periods by month. */
export function buildClosureTree(groups: readonly FiscalYearGroup[]): ClosureYearRow[] {
    return groups.map((g) => ({
        kind: "year",
        id: `y-${g.year}`,
        year: g.year,
        fiscalYear: g.fiscalYear,
        periods: g.periods,
        taxPeriods: g.taxPeriods,
        children: MONTHS.map((monthName, i) => ({
            kind: "month",
            id: `m-${g.year}-${i + 1}`,
            year: g.year,
            month: i + 1,
            monthName,
            acct: g.periods.find((p) => p.month === i + 1),
            tax: g.taxPeriods.find((p) => p.month === i + 1),
        })),
    }))
}
