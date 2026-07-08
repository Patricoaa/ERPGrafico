import { DataCell, createEntityActions } from '@/components/shared'
import { Eye, Trash2 } from 'lucide-react'

export interface AttributeActionsCtx {
    onViewEdit: (attr: unknown) => void
    onDelete: (id: number) => void
}

export const attributeActions = createEntityActions<unknown, AttributeActionsCtx>((item, ctx) => (
    <>
        <DataCell.Action
            icon={Eye}
            title="Ver/Editar Atributo"
            color="text-primary"
            onClick={() => ctx.onViewEdit(item)}
        />
        <DataCell.Action
            icon={Trash2}
            title="Eliminar Atributo"
            className="text-destructive"
            onClick={() => {
                const attr = item as { id: number }
                ctx.onDelete(attr.id)
            }}
        />
    </>
))
