import { createEntityFields } from '@/components/shared'
import type { PaymentTerminalDevice } from '@/features/treasury/types'

const DEVICE_METHOD_MAP: Record<number, string> = {
    1: 'CREDIT_CARD',
    2: 'DEBIT_CARD',
}

export const terminalDeviceFields = createEntityFields<PaymentTerminalDevice>()({
    name: { key: 'name', type: 'text', label: 'Nombre' },
    provider_name: { key: 'provider_name', type: 'text', label: 'Proveedor' },
    serial_number: { key: 'serial_number', type: 'code', label: 'N° Serie' },
    supported_methods: {
        key: 'supported_methods',
        type: 'chip-category',
        domain: 'payment_method',
        label: 'Métodos Soportados',
        get: (d) => (d.supported_payment_methods ?? [])
            .map(id => DEVICE_METHOD_MAP[id])
            .filter(Boolean),
    },
})
