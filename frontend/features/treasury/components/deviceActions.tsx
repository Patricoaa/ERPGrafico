import { createEntityActions } from '@/components/shared'
import type { PaymentTerminalDevice } from '../hooks/useTerminalProviders'

export interface DeviceActionsCtx {
    onEdit: (device: PaymentTerminalDevice) => void
    onDelete: (device: PaymentTerminalDevice) => void
}

export const deviceActions = createEntityActions<
    PaymentTerminalDevice,
    DeviceActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item) },
    { action: "delete", onClick: () => ctx.onDelete(item) },
])
