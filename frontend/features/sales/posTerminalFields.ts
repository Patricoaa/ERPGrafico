import { createEntityFields } from "@/components/shared"
import type { Terminal } from "@/features/treasury"

const PAYMENT_CARD_MAP: Record<string, string> = {
    CASH: 'CASH',
    CARD: 'CARD',
    CARD_TERMINAL: 'CARD_TERMINAL',
    TRANSFER: 'TRANSFER',
    CHECK: 'CHECK',
    OTHER: 'OTHER',
    DEBIT_CARD: 'CARD',
    CREDIT_CARD: 'CARD',
}

export const posTerminalFields = createEntityFields<Terminal>()({
    code: {
        key: "code",
        type: "code",
        label: "Código",
    },
    name: {
        key: "name",
        type: "text",
        label: "Nombre",
    },
    location: {
        key: "location",
        type: "secondary",
        label: "Ubicación",
    },
    device: {
        key: "payment_terminal_device_name",
        type: "text",
        label: "Dispositivo",
        header: "Terminal de cobro",
        get: (t) => t.payment_terminal_device_name || (t.payment_terminal_device ? 'Vinculado' : undefined),
    },
    payment_methods: {
        key: "payment_methods",
        type: "chip-category",
        domain: "payment_method",
        label: "Métodos",
        get: (t) => {
            const types = new Set<string>()
            for (const m of t.allowed_payment_methods) {
                const mapped = PAYMENT_CARD_MAP[m.method_type]
                if (mapped) types.add(mapped)
            }
            return [...types]
        },
    },
    isActive: {
        key: "is_active",
        type: "status",
        label: "Estado",
        get: (t) => t.is_active ? "active" : "inactive",
        getLabel: (t) => t.is_active ? "Activo" : "Inactivo",
        tableOptions: { enableSorting: false },
    },
})
