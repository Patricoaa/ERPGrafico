import { createEntityFields } from '@/components/shared'
import type { CreditLine } from './types'

export const creditLineFields = createEntityFields<CreditLine>()({
    code: {
        key: 'code',
        type: 'code',
        label: 'Código',
        get: (c) => c.code || '—',
    },
    accountName: {
        key: 'account_name',
        type: 'text',
        label: 'Cuenta',
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
    },
    creditLimit: {
        key: 'credit_limit',
        type: 'currency',
        label: 'Límite',
        tableOptions: { align: 'right' }
    },
    usedAmount: {
        key: 'used_amount',
        type: 'currency',
        label: 'Utilizado',
        tableOptions: { align: 'right' }
    },
    availableAmount: {
        key: 'available_amount',
        type: 'currency',
        label: 'Disponible',
        tableOptions: { align: 'right' }
    },
    utilizationRate: {
        key: 'utilization_rate',
        type: 'text',
        label: 'Uso %',
        get: (c: CreditLine) => c.utilization_rate !== null ? `${Number(c.utilization_rate).toFixed(1)}%` : '—',
        tableOptions: { align: 'right' }
    }
})
