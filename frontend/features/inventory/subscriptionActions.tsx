import { createEntityActions } from '@/components/shared'
import type { Subscription } from './hooks/useSubscriptions'
import { Pause, Play } from "lucide-react"

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
>((item, ctx) => [
    { action: "edit", label: "Editar Producto", onClick: () => ctx.onEdit(item.product) },
    { action: "lock", icon: Pause, label: "Pausar Suscripción", iconColor: "text-warning", onClick: () => ctx.onPause(item.id), visible: item.status === "ACTIVE" },
    { action: "disburse", icon: Play, label: "Reanudar Suscripción", iconColor: "text-success", onClick: () => ctx.onResume(item.id), visible: item.status === "PAUSED" },
    { action: "history", label: "Ver Historial", iconColor: "text-primary", onClick: () => ctx.onViewHistory(item.id) },
    { action: "archive", label: "Archivar Producto", className: "text-destructive/70 hover:text-destructive", onClick: () => ctx.onArchive({ id: item.product, name: item.product_name }) },
])
