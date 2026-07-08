import { DataCell, createEntityActions } from '@/components/shared'
import type { Subscription } from './hooks/useSubscriptions'
import { Pencil, Pause, Play, History, Archive } from "lucide-react"

export interface SubscriptionActionsCtx {
    onEdit: (productId: number) => void
    onPause: (id: number) => void
    onResume: (id: number) => void
    onViewHistory: (id: number) => void
    onArchive: (product: { id: number; name: string }) => void
}

export const subscriptionActions = createEntityActions<
    Subscription,
    SubscriptionActionsCtx
>((item, ctx) => (
    <>
        <DataCell.Action
            icon={Pencil}
            title="Editar Producto"
            onClick={() => ctx.onEdit(item.product)}
        />
        {item.status === "ACTIVE" && (
            <DataCell.Action
                icon={Pause}
                title="Pausar Suscripción"
                color="text-warning"
                onClick={() => ctx.onPause(item.id)}
            />
        )}
        {item.status === "PAUSED" && (
            <DataCell.Action
                icon={Play}
                title="Reanudar Suscripción"
                color="text-success"
                onClick={() => ctx.onResume(item.id)}
            />
        )}
        <DataCell.Action
            icon={History}
            title="Ver Historial"
            color="text-primary"
            onClick={() => ctx.onViewHistory(item.id)}
        />
        <DataCell.Action
            icon={Archive}
            title="Archivar Producto"
            className="text-destructive/70 hover:text-destructive"
            onClick={() => ctx.onArchive({ id: item.product, name: item.product_name })}
        />
    </>
))
