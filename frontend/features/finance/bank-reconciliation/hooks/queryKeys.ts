export const reconciliationKeys = {
    all: ['reconciliation'] as const,
    statements: () => [...reconciliationKeys.all, 'statements'] as const,
    statement: (id: number) => [...reconciliationKeys.statements(), id] as const,
    accounts: () => [...reconciliationKeys.all, 'accounts'] as const,
    settings: (accountId?: number) => [...reconciliationKeys.all, 'settings', accountId] as const,
    dashboard: (accountId: string) => [...reconciliationKeys.all, 'dashboard', accountId] as const,
    unreconciledLines: (statementId: number, params: any = {}) => [...reconciliationKeys.all, 'unreconciled-lines', statementId, params] as const,
    unreconciledPayments: (accountId: number, params: any = {}) => [...reconciliationKeys.all, 'unreconciled-payments', accountId, params] as const,
    lineSuggestions: (lineId: number) => [...reconciliationKeys.all, 'line-suggestions', lineId] as const,
    paymentSuggestions: (paymentId: number) => [...reconciliationKeys.all, 'payment-suggestions', paymentId] as const,
}
