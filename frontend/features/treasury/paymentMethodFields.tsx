import { createEntityFields, Chip } from '@/components/shared'
import { CreditCard } from 'lucide-react'
import type { PaymentMethod } from '@/features/treasury/types'

const METHOD_TYPE_LABELS: Record<string, string> = {
    CASH: "Efectivo Directo",
    CARD_TERMINAL: "Tarjeta (Dispositivo Integrado)",
    TRANSFER: "Transferencia Bancaria",
    DEBIT_CARD: "Tarjeta Débito Empresa",
    CREDIT_CARD: "Tarjeta Crédito Empresa",
    CHECK: "Cheque",
}

export const paymentMethodFields = createEntityFields<PaymentMethod>()({
    name: {
        key: 'name',
        type: 'text',
        label: 'Nombre',
        icon: CreditCard,
    },
    method_type_display: {
        key: 'method_type_display',
        type: 'secondary',
        label: 'Categoría Operativa',
        get: (m) => m.method_type_display || METHOD_TYPE_LABELS[m.method_type] || m.method_type,
    },
    treasuryAccountName: {
        key: 'treasury_account_name',
        type: 'computed',
        label: 'Cuenta de Tesorería',
        render: (m) => (
            <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                <span className="text-sm font-sans font-medium text-foreground">{m.treasury_account_name}</span>
                <div className="flex justify-center gap-1">
                    {m.allow_for_sales && (
                        <Chip size="xs" intent="success">Ventas</Chip>
                    )}
                    {m.allow_for_purchases && (
                        <Chip size="xs" intent="info">Compras</Chip>
                    )}
                </div>
            </div>
        ),
    },
}, {
    subtitle: {
        template: '{method_type_display}',
        suffixTemplate: '{treasury_account_name}',
        excludeKeys: ['method_type_display', 'treasury_account_name'],
    },
})
