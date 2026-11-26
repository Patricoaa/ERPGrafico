/** A line of a financial statement: an account (numeric id) or a synthetic section / total row. */
export interface ReportNode {
    id: number | string
    code: string
    name: string
    balance: number
    comp_balance?: number
    variance?: number
    children?: ReportNode[]
    /** Closing total row («Utilidad del ejercicio», «Saldo final»). */
    isTotalRow?: boolean
    /** Whether a rise is good news; children inherit it from their section. */
    varianceDirection?: VarianceDirection
}

export type VarianceDirection = 'higher-is-better' | 'lower-is-better'

/** Account a statement row drills into (the screen opens its ledger). */
export interface DrillDownTarget {
    accountId: number
    accountName: string
    accountCode: string
}

export interface BalanceSheetData {
    total_assets: number
    total_liabilities: number
    total_equity: number
    assets: ReportNode[]
    liabilities: ReportNode[]
    equity: ReportNode[]
    total_assets_comp?: number
    total_liabilities_comp?: number
    total_equity_comp?: number
    check?: number
    check_comp?: number
}

export interface PLSection {
    name: string
    is_total: boolean
    total: number
    total_comp?: number
    tree: ReportNode[]
}

export interface PLData {
    sections: PLSection[]
}

/** Cash flow: an account with movements in the period that is not mapped to a flow category. */
export interface CulpritAccount {
    code: string;
    name: string;
    variation: number;
    type: string;
}

/** Cash flow: a projected maturity (loan installment, check, card). */
export interface MaturityItem {
    type: string
    direction: string
    label: string
    due_date: string
    amount: number
}

/** Budget variance: an account with month and year-to-date actual, budget and variance. */
export type BudgetVarianceAccountType = 'INCOME' | 'EXPENSE';

export interface BudgetVarianceNode {
    id: number;
    code: string;
    name: string;
    type: BudgetVarianceAccountType;
    month_actual: number;
    month_budget: number;
    month_variance: number;
    month_percentage: number;
    ytd_actual: number;
    ytd_budget: number;
    ytd_variance: number;
    ytd_percentage: number;
    is_unbudgeted: boolean;
    children: BudgetVarianceNode[];
}
