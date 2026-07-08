import { createQueryKeyFactory } from '@/lib/query-keys'

const _purchasing = createQueryKeyFactory('purchasing')
export const PURCHASING_KEYS = {
    ..._purchasing,
    orders: () => [..._purchasing.all, 'orders'] as const,
    receipts: (filters?: Record<string, unknown>) => [..._purchasing.all, 'receipts', { filters }] as const,
    receipt: (id: number) => [..._purchasing.all, 'receipt', id] as const,
    notes: () => [..._purchasing.all, 'notes'] as const,
}
