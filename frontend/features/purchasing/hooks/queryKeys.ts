export const PURCHASING_KEYS = {
    all: ['purchasing'] as const,
    lists: () => [...PURCHASING_KEYS.all, 'list'] as const,
    orders: () => [...PURCHASING_KEYS.all, 'orders'] as const,
    notes: () => [...PURCHASING_KEYS.all, 'notes'] as const,
    detail: (id: number) => [...PURCHASING_KEYS.all, 'detail', id] as const,
}
