import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { BANKS_KEYS } from './queryKeys'

export interface BankOverviewMaturityItem {
    type: string
    label: string
    due_date: string
    amount: number
    entity_id: number
    display_id: string
}

export interface BankOverviewRecentMovement {
    id: number
    display_id: string
    movement_type: string
    movement_type_display: string
    amount: number
    date: string
    from_account_id: number | null
    from_account_name: string | null
    to_account_id: number | null
    to_account_name: string | null
    payment_method: string
    payment_method_display: string
}

export interface BankOverviewLoanItem {
    id: number
    display_id: string
    loan_number: string
    principal: number
    outstanding_balance: number
    next_due_date: string | null
    next_installment_amount: number | null
    installments_count: number
    paid_installments_count: number
}

export interface BankOverviewCheckItem {
    id: number
    display_id: string
    check_number: string
    amount: number
    issue_date: string
    due_date: string
    counterparty_name: string | null
    drawer_name: string
}

export interface BankOverviewData {
    bank: { id: number; name: string; code: string | null }
    accounts: Array<{
        id: number
        name: string
        code: string | null
        account_number: string | null
        card_number: string | null
        account_type: string
        account_type_display: string
        current_balance: number
        currency: string
        credit_limit: number | null
        credit_line_credit_limit: number | null
    }>
    summary: {
        total_accounts: number
        card_debt: number
        portfolio_checks: number
        issued_checks: number
        active_loan_count: number
        total_loan_debt: number
        card_count?: number
        reconciliation: {
            latest_statement_id: number
            latest_statement_date: string
            latest_statement_status: string
            unreconciled_lines: number
        } | null
    }
    upcoming_maturities: BankOverviewMaturityItem[]
    recent_movements: BankOverviewRecentMovement[]
    active_loans: BankOverviewLoanItem[]
    issued_checks_list: BankOverviewCheckItem[]
}

export function useBankOverview(bankId: number | null) {
    return useQuery({
        queryKey: [...BANKS_KEYS.all, 'overview', bankId],
        queryFn: () => treasuryApi.getBankOverview(bankId as number),
        enabled: bankId != null,
        staleTime: 2 * 60 * 1000,
    })
}
