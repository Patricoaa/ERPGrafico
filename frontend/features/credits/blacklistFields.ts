import { createEntityFields } from '@/components/shared'
import type { CreditContact } from './api/creditsApi'

export const blacklistFields = createEntityFields<CreditContact>()({
    creditBalanceUsed: {
        key: 'credit_balance_used',
        type: 'currencyFlow',
        label: 'Deuda Actual',
        tableOptions: { align: 'center' },
        cellProps: { direction: 'outflow', showIcon: false, className: 'font-black' },
    },
    creditLastEvaluated: {
        key: 'credit_last_evaluated',
        type: 'dateTime',
        label: 'Bloqueado desde',
        tableOptions: { align: 'center' },
    },
})
