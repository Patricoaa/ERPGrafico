import type { OrderFilters } from '../api/purchasingApi'
import { createQueryKeyFactory } from '@/lib/query-keys'

const _purchasing = createQueryKeyFactory('purchasing')
export const PURCHASING_KEYS = {
    ..._purchasing,
    orders: () => [..._purchasing.all, 'orders'] as const,
    receipts: (filters?: Record<string, unknown>) => [..._purchasing.all, 'receipts', { filters }] as const,
    receipt: (id: number) => [..._purchasing.all, 'receipt', id] as const,
    notes: (filters?: Record<string, unknown>) => [..._purchasing.all, 'notes', { filters }] as const,
    orderAnalytics: (filters: OrderFilters | undefined, granularity: string) => [..._purchasing.all, 'orders', 'analytics', { filters, granularity }] as const,
}
