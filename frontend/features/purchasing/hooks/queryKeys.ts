import { createQueryKeyFactory } from '@/lib/query-keys'

const _purchasing = createQueryKeyFactory('purchasing')
export const PURCHASING_KEYS = {
    ..._purchasing,
    orders: () => [..._purchasing.all, 'orders'] as const,
    notes: () => [..._purchasing.all, 'notes'] as const,
}
