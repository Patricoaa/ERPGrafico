import { createEntityFields } from '@/components/shared'
import type { PaymentTerminalProvider } from '@/features/treasury/types'

export const terminalProviderFields = createEntityFields<PaymentTerminalProvider>()({
    name: { key: 'name', type: 'text', label: 'Nombre' },
    supplier_name: { key: 'supplier_name', type: 'text', label: 'Contacto' },
    receivable_account_name: { key: 'receivable_account_name', type: 'text', label: 'Cuenta Recaudación' },
    is_active: { key: 'is_active', type: 'status', label: 'Estado', get: (row) => row.is_active ? 'active' : 'inactive' },
})
