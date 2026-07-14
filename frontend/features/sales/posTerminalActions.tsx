import { createEntityActions } from '@/components/shared'
import type { Terminal } from '@/features/treasury'
import { Settings, Power, PowerOff } from "lucide-react"

export interface PosTerminalActionsCtx {
    onEdit: (terminal: Terminal) => void
    onToggleActive: (terminal: Terminal) => void
    onDelete: (terminal: Terminal) => void
}

export const posTerminalActions = createEntityActions<
    Terminal,
    PosTerminalActionsCtx
>((item, ctx) => [
    { action: "edit", icon: Settings, onClick: () => ctx.onEdit(item) },
    {
        action: "toggle_active",
        icon: item.is_active ? PowerOff : Power,
        label: item.is_active ? "Desactivar" : "Activar",
        className: item.is_active ? "text-muted-foreground hover:text-destructive" : "",
        onClick: () => ctx.onToggleActive(item),
    },
    { action: "delete", className: "text-destructive hover:text-destructive", onClick: () => ctx.onDelete(item) },
])
