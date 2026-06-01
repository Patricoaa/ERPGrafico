const FINANCE_ROOT = ['finance'] as const

export const FINANCE_KEYS = {
  all: FINANCE_ROOT,
  budgets: {
    all: () => [...FINANCE_ROOT, 'budgets'] as const,
    lists: () => [...FINANCE_KEYS.budgets.all(), 'list'] as const,
    list: (filters?: unknown) => [...FINANCE_KEYS.budgets.lists(), { filters }] as const,
    details: () => [...FINANCE_KEYS.budgets.all(), 'detail'] as const,
    detail: (id: number) => [...FINANCE_KEYS.budgets.details(), id] as const,
    variance: (id: number) => [...FINANCE_KEYS.budgets.all(), 'variance', id] as const,
    execution: (id: number) => [...FINANCE_KEYS.budgets.all(), 'execution', id] as const,
    detailData: (id: number) => [...FINANCE_KEYS.budgets.all(), 'detail-data', id] as const,
    previousYearActuals: (id: number) => [...FINANCE_KEYS.budgets.all(), 'previous-year-actuals', id] as const,
    budgetableAccounts: () => [...FINANCE_KEYS.budgets.all(), 'budgetable-accounts'] as const,
    items: (id: number) => [...FINANCE_KEYS.budgets.all(), 'items', id] as const,
  },
  accounts: {
    all: () => [...FINANCE_ROOT, 'accounts'] as const,
    detail: (id: number) => [...FINANCE_KEYS.accounts.all(), id] as const,
  },
  statements: {
    all: () => [...FINANCE_ROOT, 'statements'] as const,
    balanceSheet: (params?: unknown) => [...FINANCE_KEYS.statements.all(), 'balance-sheet', { params }] as const,
    incomeStatement: (params?: unknown) => [...FINANCE_KEYS.statements.all(), 'income-statement', { params }] as const,
    cashFlow: (params?: unknown) => [...FINANCE_KEYS.statements.all(), 'cash-flow', { params }] as const,
  },
  pendingInvoices: {
    all: () => [...FINANCE_ROOT, 'pending-invoices'] as const,
    list: (params?: unknown) => [...FINANCE_KEYS.pendingInvoices.all(), { params }] as const,
  },
}
