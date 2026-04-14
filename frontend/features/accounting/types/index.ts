export interface Account {
    id: number
    code: string
    name: string
    account_type: string
    account_type_display: string
    parent: number | null
    debit_total: string
    credit_total: string
    balance: string
    is_selectable: boolean
    is_reconcilable: boolean
    is_category: string | null
    cf_category: string | null
    bs_category: string | null
    bs_category_display: string | null
}

export interface AccountFilters {
    code?: string
    name?: string
    account_type?: string
}

export const IS_CATEGORIES = [
    { value: 'REVENUE', label: 'Ingresos Operacionales' },
    { value: 'COST_OF_SALES', label: 'Costo de Ventas' },
    { value: 'OPERATING_EXPENSE', label: 'Gastos Operacionales' },
    { value: 'NON_OPERATING_REVENUE', label: 'Ingresos No Operacionales' },
    { value: 'NON_OPERATING_EXPENSE', label: 'Gastos No Operacionales' },
    { value: 'TAX_EXPENSE', label: 'Impuesto a la Renta' },
] as const

export const CF_CATEGORIES = [
    { value: 'OPERATING', label: 'Actividades de Operación' },
    { value: 'INVESTING', label: 'Actividades de Inversión' },
    { value: 'FINANCING', label: 'Actividades de Financiación' },
    { value: 'DEP_AMORT', label: 'Depreciación y Amortización' },
] as const

export const BS_CATEGORIES = [
    { value: 'CURRENT_ASSET', label: 'Activo Corriente' },
    { value: 'INVENTORY', label: 'Inventario' },
    { value: 'NON_CURRENT_ASSET', label: 'Activo No Corriente' },
    { value: 'CURRENT_LIABILITY', label: 'Pasivo Corriente' },
    { value: 'NON_CURRENT_LIABILITY', label: 'Pasivo No Corriente' },
    { value: 'EQUITY', label: 'Patrimonio' },
] as const

export interface AccountPayload {
    code: string
    name: string
    account_type: string
    parent?: number | null
    is_selectable?: boolean
}

export type PeriodStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';
export type FiscalYearStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export interface AccountingPeriod {
    id: number;
    year: number;
    month: number;
    month_display: string;
    status: PeriodStatus;
    status_display: string;
    closed_at: string | null;
    closed_by: number | null;
    closed_by_name: string | null;
    tax_period_id: number | null;
    tax_period_status: string | null;
}

export interface FiscalYear {
    id: number;
    year: number;
    status: FiscalYearStatus;
    closing_entry: number | null;
    opening_entry: number | null;
    closed_by: number | null;
    closed_by_name: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface FiscalYearPreviewResult {
    year: number;
    can_close: boolean;
    is_balanced: boolean;
    validations: Record<string, { passed: boolean; message: string }>;
    result_account_id: number | null;
    result_account_code: string | null;
    result_account_name: string | null;
    income_total: string;
    expense_total: string;
    net_result: string;
    is_profit: boolean;
    is_loss: boolean;
}

export interface TrialBalanceItem {
    id: number;
    code: string;
    name: string;
    type: string;
    initial_balance: number;
    debit: number;
    credit: number;
    closing_balance: number;
    saldo_deudor: number;
    saldo_acreedor: number;
}

export interface TrialBalanceReport {
    accounts: TrialBalanceItem[];
    total_debit: number;
    total_credit: number;
    total_saldo_deudor: number;
    total_saldo_acreedor: number;
    is_balanced: boolean;
}
