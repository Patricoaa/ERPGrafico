import { createEntityActions } from '@/components/shared'
import type { PaymentTerminalProvider } from '../hooks/useTerminalProviders'

export interface ProviderActionsCtx {
    onEdit: (provider: PaymentTerminalProvider) => void
    onDelete: (provider: PaymentTerminalProvider) => void
}

export const providerActions = createEntityActions<
    PaymentTerminalProvider,
    ProviderActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item) },
    { action: "delete", onClick: () => ctx.onDelete(item) },
])
