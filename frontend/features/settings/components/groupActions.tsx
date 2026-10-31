import { createEntityActions } from '@/components/shared'
import { Settings2 } from 'lucide-react'
import type { Group } from "../api/types"

export interface GroupActionsCtx {
    onEdit: (group: Group) => void
    onDelete: (id: number) => void
    onCompose: (group: Group) => void
    canChangeGroup: boolean
}

export const groupActions = createEntityActions<Group, GroupActionsCtx>(
    (item, ctx) => [
        { action: "edit", onClick: () => ctx.onEdit(item) },
        ...(item.kind === "ROLE" && ctx.canChangeGroup
            ? [{ action: "report" as const, label: "Composición", icon: Settings2, onClick: () => ctx.onCompose(item) }]
            : []),
        { action: "delete", onClick: () => ctx.onDelete(item.id) },
    ]
)
