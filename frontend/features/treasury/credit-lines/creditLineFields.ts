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
})
