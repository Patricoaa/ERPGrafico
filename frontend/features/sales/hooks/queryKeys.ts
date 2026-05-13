import { SaleOrderFilters } from '../types'

export const SALES_KEYS = {
    all: ['sales'] as const,
    orders: (filters?: SaleOrderFilters) => [...SALES_KEYS.all, 'orders', { filters }] as const,
    notes: (filters?: SaleOrderFilters) => [...SALES_KEYS.all, 'notes', { filters }] as const,
    order: (id: number) => [...SALES_KEYS.all, 'order', id] as const,
}
