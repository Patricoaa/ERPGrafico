import type { SearchDefinition } from '@/types/search'

export const creditLineSearchDef: SearchDefinition = {
    fields: [
        { key: 'code', label: 'Código', type: 'text', serverParam: 'search', clientKey: ['code'] },
        { key: 'account_name', label: 'Cuenta', type: 'text', serverParam: 'search', clientKey: ['account_name'] },
        { key: 'credit_limit', label: 'Límite', type: 'text', serverParam: 'search', clientKey: ['credit_limit'] },
    ],
}
