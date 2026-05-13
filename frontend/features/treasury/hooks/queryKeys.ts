export const BATCHES_KEYS = {
    all: ['terminal-batches'] as const,
    list: () => [...BATCHES_KEYS.all, 'list'] as const,
}
export const TREASURY_MOVEMENTS_QUERY_KEY = ['treasury', 'movements'] as const
export const BANKS_QUERY_KEY = ['banks'] as const
export const PAYMENT_METHODS_QUERY_KEY = ['paymentMethods'] as const
export const TERMINALS_QUERY_KEY = ['terminals'] as const
export const ACCOUNTS_QUERY_KEY = ['treasury-accounts'] as const
