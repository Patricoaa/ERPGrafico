export const ACCOUNTING_PERIODS_QUERY_KEY = ['accounting-periods'] as const
export const TRIAL_BALANCE_KEYS = {
    all: ['trial_balance'] as const,
    period: (start?: string, end?: string) => [...TRIAL_BALANCE_KEYS.all, start, end] as const,
}
export const JOURNAL_ENTRIES_QUERY_KEY = ['journal-entries'] as const
export const ACCOUNTS_QUERY_KEY = ['accounts'] as const
export const ACCOUNTS_MAPPINGS_QUERY_KEY = ['accounts', 'mappings'] as const
export const LEDGER_QUERY_KEY = ['ledger'] as const // Was string before, let's keep it as array or match it
export const ACCOUNT_KEYS = {
    all: ['accounting_accounts'] as const,
    search: (search: string, isLeaf: boolean) => [...ACCOUNT_KEYS.all, 'search', { search, isLeaf }] as const,
    detail: (id: string | number) => [...ACCOUNT_KEYS.all, 'detail', id] as const,
}
export const FISCAL_YEARS_QUERY_KEY = ['fiscal-years'] as const
