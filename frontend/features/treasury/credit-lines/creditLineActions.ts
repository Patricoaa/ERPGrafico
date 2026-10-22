import { createEntityActions } from '@/components/shared'
import type { CreditLine } from './types'

export interface CreditLineActionsCtx {
    onEdit: (line: CreditLine) => void
    onArchive: (id: number) => void
}

export const creditLineActions = createEntityActions<
    CreditLine,
    CreditLineActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item) },
    { action: "archive", onClick: () => ctx.onArchive(item.id), visible: item.status === "ACTIVE" },
])
