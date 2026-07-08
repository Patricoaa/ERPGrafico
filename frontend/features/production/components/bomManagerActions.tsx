import { DataCell, createEntityActions } from '@/components/shared'
import { Copy, Edit, Trash2 } from 'lucide-react'

export interface BOMManagerActionsCtx {
    onClone: (bom: unknown) => void
    onEdit: (bom: unknown) => void
    onDelete: (bom: unknown) => void
}

export const bomManagerActions = createEntityActions<unknown, BOMManagerActionsCtx>((item, ctx) => (
    <>
        <DataCell.Action
            icon={Copy}
            title="Clonar Receta"
            className="text-success hover:text-success"
            onClick={() => ctx.onClone(item)}
        />
        <DataCell.Action
            icon={Edit}
            title="Editar"
            className="text-primary hover:text-primary"
            onClick={() => ctx.onEdit(item)}
        />
        <DataCell.Action
            icon={Trash2}
            title="Eliminar"
            className="text-destructive hover:text-destructive"
            onClick={() => ctx.onDelete(item)}
        />
    </>
))
