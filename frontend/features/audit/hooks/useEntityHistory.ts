import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { HistoricalRecord } from '@/types/audit'

const ENDPOINT_MAP: Record<string, string> = {
    product: '/inventory/products',
    contact: '/contacts',
    sale_order: '/sales/orders',
    purchase_order: '/purchasing/orders',
    invoice: '/billing/invoices',
    payment: '/treasury/payments',
    sale_delivery: '/sales/deliveries',
    purchase_receipt: '/purchasing/receipts',
    user: '/core/users',
    company_settings: '/core/company',
    work_order: '/production/orders',
    journal_entry: '/accounting/entries',
    stock_move: '/inventory/moves',
    pricing_rule: '/inventory/pricing-rules',
    reordering_rule: '/inventory/reordering-rules',
    treasuryaccount: '/treasury/accounts',
    bank: '/treasury/banks',
    paymentmethod: '/treasury/payment-methods',
    terminal: '/treasury/pos-terminals',
    category: '/inventory/categories',
    warehouse: '/inventory/warehouses',
    uom: '/inventory/uoms',
    uom_category: '/inventory/uom-categories',
    attribute: '/inventory/attributes',
    account: '/accounting/accounts',
    bank_journal: '/accounting/journals',
    employee: '/hr/employees',
    salaryadvance: '/hr/salary-advances',
}

export const ENTITY_HISTORY_KEYS = {
    all: ['entity_history'] as const,
    detail: (type: string, id: string | number) => [...ENTITY_HISTORY_KEYS.all, type, id] as const,
}

export function useEntityHistory(entityType: string, entityId: number | string) {
    const endpoint = ENDPOINT_MAP[entityType]

    const query = useQuery({
        queryKey: ENTITY_HISTORY_KEYS.detail(entityType, entityId),
        queryFn: async ({ signal }) => {
            const res = await api.get(`${endpoint}/${entityId}/history/`, { signal })
            return res.data as HistoricalRecord[]
        },
        enabled: !!entityId && !!endpoint,
        staleTime: 60 * 1000, // 1 min (history can update often)
    })

    return {
        history: query.data ?? [],
        loading: query.isLoading,
        error: !endpoint && entityType ? `Unknown entity type: ${entityType}` : query.error ? (query.error as Error).message : null,
        refetch: query.refetch,
    }
}
