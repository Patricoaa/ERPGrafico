import { createQueryKeyFactory } from '@/lib/query-keys'

const _workOrders = createQueryKeyFactory('workOrders')
export const WORK_ORDERS_KEYS = {
    ..._workOrders,
    comments: (id: number) => [..._workOrders.all, 'comments', id] as const,
}

const _boms = createQueryKeyFactory('boms')
export const BOMS_KEYS = {
    ..._boms,
}

export const PRODUCTION_METRICS_KEY = ['production_metrics'] as const

export const UOMS_KEY = ['uoms'] as const

export const ACCOUNTING_SETTINGS_KEY = ['accountingSettings'] as const
