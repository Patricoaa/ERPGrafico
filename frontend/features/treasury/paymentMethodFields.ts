import { createEntityFields } from '@/components/shared'
import type { PaymentMethod } from '@/features/treasury/types'

export const paymentMethodFields = createEntityFields<PaymentMethod>()({
    name: { key: 'name', type: 'text', label: 'Nombre' },
    method_type_display: { key: 'method_type_display', type: 'secondary', label: 'Categoría Operativa' },
    treasury_account_name: { key: 'treasury_account_name', type: 'text', label: 'Cuenta de Tesorería' },
})
