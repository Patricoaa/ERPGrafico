export const PURCHASING_KEYS = {
    all: ['purchasing'] as const,
    orders: () => [...PURCHASING_KEYS.all, 'orders'] as const,
    notes: () => [...PURCHASING_KEYS.all, 'notes'] as const,
}
