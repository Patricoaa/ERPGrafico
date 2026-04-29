export const reconciliationKeys = {
    all: ['reconciliation'] as const,
    statements: () => [...reconciliationKeys.all, 'statements'] as const,
    statement: (id: number) => [...reconciliationKeys.statements(), id] as const,
    accounts: () => [...reconciliationKeys.all, 'accounts'] as const,
    rules: () => [...reconciliationKeys.all, 'rules'] as const,
    dashboard: (accountId: string) => [...reconciliationKeys.all, 'dashboard', accountId] as const,
    unreconciledLines: (statementId: number) => [...reconciliationKeys.all, 'unreconciled-lines', statementId] as const,
    unreconciledPayments: (accountId: number) => [...reconciliationKeys.all, 'unreconciled-payments', accountId] as const,
    lineSuggestions: (lineId: number) => [...reconciliationKeys.all, 'line-suggestions', lineId] as const,
    paymentSuggestions: (paymentId: number) => [...reconciliationKeys.all, 'payment-suggestions', paymentId] as const,
}
