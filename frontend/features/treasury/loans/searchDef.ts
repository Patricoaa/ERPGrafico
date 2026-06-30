import type { SearchDefinition } from '@/types/search'

export const loanSearchDef: SearchDefinition = {
    fields: [
        { key: 'display_id', label: 'ID Interno', type: 'text', serverParam: 'search', clientKey: ['display_id'] },
        { key: 'loan_number', label: 'N° Préstamo', type: 'text', serverParam: 'search', clientKey: ['loan_number'] },
        { key: 'lender_name', label: 'Banco', type: 'text', serverParam: 'search', clientKey: ['lender_name'] },
    ],
}
