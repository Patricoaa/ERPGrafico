import { createEntityActions } from '@/components/shared'
import type { PaymentMethod } from '@/features/treasury/types'

export interface PaymentMethodActionsCtx {
    onEdit: (method: PaymentMethod) => void
    onDelete: (id: number) => void
}

export const paymentMethodActions = createEntityActions<
    PaymentMethod,
    PaymentMethodActionsCtx
>((item, ctx) => {
    if (item.is_terminal_integration) {
        return [
            {
                action: "lock",
                label: "Gestionado por terminal — modifique el dispositivo",
                className: "text-muted-foreground cursor-default opacity-50",
                onClick: () => {},
            },
        ]
    }
    return [
        { action: "edit", onClick: () => ctx.onEdit(item) },
        { action: "delete", onClick: () => ctx.onDelete(item.id) },
    ]
})
