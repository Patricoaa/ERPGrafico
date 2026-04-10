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
}

export interface AccountFilters {
    code?: string
    name?: string
    account_type?: string
}

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
