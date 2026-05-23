export const WORK_ORDERS_KEYS = {
    all: ['workOrders'] as const,
    lists: () => [...WORK_ORDERS_KEYS.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...WORK_ORDERS_KEYS.lists(), { filters }] as const,
    details: () => [...WORK_ORDERS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...WORK_ORDERS_KEYS.details(), id] as const,
    comments: (id: number) => [...WORK_ORDERS_KEYS.all, 'comments', id] as const,
}

export const BOMS_KEYS = {
    all: ['boms'] as const,
    lists: () => [...BOMS_KEYS.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...BOMS_KEYS.lists(), { filters }] as const,
    details: () => [...BOMS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...BOMS_KEYS.details(), id] as const,
}

export const PRODUCTION_METRICS_KEY = ['production_metrics'] as const

export const UOMS_KEY = ['uoms'] as const

export const ACCOUNTING_SETTINGS_KEY = ['accountingSettings'] as const
