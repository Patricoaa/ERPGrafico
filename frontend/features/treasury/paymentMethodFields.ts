import { createEntityFields } from '@/components/shared'
import type { PaymentMethod } from '@/features/treasury/types'

export const paymentMethodFields = createEntityFields<PaymentMethod>()({
    name: { key: 'name', type: 'text', label: 'Nombre' },
    method_type_display: { key: 'method_type_display', type: 'secondary', label: 'Categoría Operativa' },
    treasury_account_name: { key: 'treasury_account_name', type: 'text', label: 'Cuenta de Tesorería' },
    allowForSales: {
        key: 'allow_for_sales',
        type: 'chip',
        label: 'Permitido',
        cardPlacement: 'body',
        get: (m) => m.allow_for_sales ? 'Ventas' : null,
    },
    allowForPurchases: {
        key: 'allow_for_purchases',
        type: 'chip',
        label: '',
        cardPlacement: 'body',
        get: (m) => m.allow_for_purchases ? 'Compras' : null,
    },
})
