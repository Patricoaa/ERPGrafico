import { DataCell, createEntityActions } from '@/components/shared'
import type { Terminal } from '@/features/treasury'
import { Settings, Power, PowerOff, Trash2 } from "lucide-react"

export interface PosTerminalActionsCtx {
    onEdit: (terminal: Terminal) => void
    onToggleActive: (terminal: Terminal) => void
    onDelete: (terminal: Terminal) => void
}

export const posTerminalActions = createEntityActions<
    Terminal,
    PosTerminalActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action
            icon={Settings}
            title="Editar"
            onClick={() => ctx.onEdit(item)}
        />
        <DataCell.Action
            icon={item.is_active ? PowerOff : Power}
            title={item.is_active ? "Desactivar" : "Activar"}
            className={item.is_active ? "text-muted-foreground hover:text-destructive" : ""}
            onClick={() => ctx.onToggleActive(item)}
        />
        <DataCell.Action
            icon={Trash2}
            title="Eliminar"
            className="text-destructive hover:text-destructive"
            onClick={() => ctx.onDelete(item)}
        />
    </>
))
