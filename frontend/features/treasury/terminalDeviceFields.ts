import { createEntityFields } from '@/components/shared'
import type { PaymentTerminalDevice } from '@/features/treasury/types'

export const terminalDeviceFields = createEntityFields<PaymentTerminalDevice>()({
    name: { key: 'name', type: 'text', label: 'Nombre' },
    provider_name: { key: 'provider_name', type: 'text', label: 'Proveedor' },
    serial_number: { key: 'serial_number', type: 'code', label: 'N° Serie' },
})
