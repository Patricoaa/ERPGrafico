import api from "@/lib/api"

export interface AgingBuckets {
    current: number
    overdue_30: number
    overdue_60: number
    overdue_90: number
    overdue_90plus: number
}

export interface CreditContact {
    id: number
    code: string
    display_id: string
    name: string
    tax_id: string
    email: string
    phone: string
    credit_enabled: boolean
    credit_blocked: boolean
    credit_limit: string | null
    credit_days: number
    credit_balance_used: string
    credit_available: string
    credit_aging: AgingBuckets
    credit_auto_blocked: boolean
    credit_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    credit_last_evaluated: string | null
}

export interface CreditSummary {
    total_debt: string;
    total_exposure: string;
    potential_loss: string;
    utilization_rate: string;
    current: string;
    overdue_30: string;
    overdue_60: string;
    overdue_90: string;
    overdue_90plus: string;
    count_with_credit: number;
    count_debtors: number;
    count_overdue: number;
    risk_distribution: {
        LOW: number;
        MEDIUM: number;
        HIGH: number;
        CRITICAL: number;
    };
}

export interface CreditPortfolioResponse {
    contacts: CreditContact[]
    summary: CreditSummary
}

export interface CreditLedgerEntry {
    id: number
    number: string
    date: string
    effective_total: string
    paid_amount: string
    balance: string
    due_date: string
    days_overdue: number
    aging_bucket: 'current' | 'overdue_30' | 'overdue_60' | 'overdue_90' | 'overdue_90plus'
    status: string
}

export async function getCreditPortfolio(): Promise<CreditPortfolioResponse> {
    const res = await api.get("/contacts/credit_portfolio/")
    return res.data
}

export async function getContactCreditLedger(contactId: number): Promise<CreditLedgerEntry[]> {
    const res = await api.get(`/contacts/${contactId}/credit_ledger/`)
    return res.data
}

export async function writeOffDebt(contactId: number): Promise<{ message: string, journal_entry: string, amount: string }> {
    const res = await api.post(`/contacts/${contactId}/write_off_debt/`)
    return res.data
}
