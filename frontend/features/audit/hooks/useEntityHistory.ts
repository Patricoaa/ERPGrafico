import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { HistoricalRecord } from '@/types/audit'
import { getErrorMessage } from '@/lib/errors'

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

export function useEntityHistory(entityType: string, entityId: number | string) {
    const [history, setHistory] = useState<HistoricalRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!entityId) return

        const endpoint = ENDPOINT_MAP[entityType]
        if (!endpoint) {
            setError(`Unknown entity type: ${entityType}`)
            return
        }

        let cancelled = false
        setLoading(true)
        setError(null)

        api.get(`${endpoint}/${entityId}/history/`)
            .then(res => { if (!cancelled) setHistory(res.data) })
            .catch(err => { if (!cancelled) setError(getErrorMessage(err)) })
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [entityType, entityId])

    return { history, loading, error }
}
