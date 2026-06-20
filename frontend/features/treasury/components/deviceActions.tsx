import { DataCell, createEntityActions } from '@/components/shared'
import type { PaymentTerminalDevice } from '../hooks/useTerminalProviders'

export interface DeviceActionsCtx {
    onEdit: (device: PaymentTerminalDevice) => void
    onDelete: (device: PaymentTerminalDevice) => void
}

export const deviceActions = createEntityActions<
    PaymentTerminalDevice,
    DeviceActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action action="edit" onClick={() => ctx.onEdit(item)} />
        <DataCell.Action action="delete" onClick={() => ctx.onDelete(item)} />
    </>
))
