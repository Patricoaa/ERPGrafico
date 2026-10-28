"use client"


import { cn } from "@/lib/utils"
import {
    Clock,
    User,
    AlertCircle,
} from "lucide-react"
import { CardSkeleton, CardSurface, Chip, Skeleton, StatusBadge } from "@/components/shared"
import { workOrderActions, type WorkOrderActionsCtx } from "@/features/production"
import { type WorkOrder } from "../types"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { formatQuantity } from "@/lib/money"
import { STAGES_ORDERED } from "../constants/stages"
import { isWorkOrderOverdue } from "../utils"

interface KanbanCardHandlers {
    onManage: (orderId: number) => void
    onDuplicate?: (orderId: number) => void
    onAnnul?: (orderId: number) => void
}

interface KanbanProps extends KanbanCardHandlers {
    orders: WorkOrder[]
    isLoading?: boolean
}

const STAGES = STAGES_ORDERED.filter(s => s.showInKanban)

function KanbanCard({ order, onManage, onDuplicate, onAnnul }: { order: WorkOrder } & KanbanCardHandlers) {
    const actionsCtx: WorkOrderActionsCtx = {
        onEdit: onManage,
        onDuplicate: onDuplicate ?? (() => {}),
        onAnnul: onAnnul ?? (() => {}),
    }

    const isOverdue = isWorkOrderOverdue(order)
    const folio = formatEntityDisplay('production.workorder', order as unknown as Record<string, unknown>)
    const title = order.product_description || order.description || order.product_name || "Sin descripción"
    const hasQuantity = order.quantity != null && Number(order.quantity) > 0
    const formattedQty = hasQuantity ? `${formatQuantity(order.quantity)}${order.uom_name ? ` ${order.uom_name}` : ""}` : null
    const dateText = order.due_date || order.sale_order_delivery_date || order.sale_order_date
    const hasOutsourcing = order.outsourcing_status === 'partial' || order.outsourcing_status === 'full'
    const isMissingMaterials = (!order.materials || order.materials.length === 0) && order.current_stage === 'MATERIAL_ASSIGNMENT'

    return (
        <CardSurface
            kind="item"
            onClick={() => onManage(order.id)}
            className={cn(
                "group transition-all hover:border-foreground/30 active:scale-[0.99]",
                isOverdue && "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
            )}
        >
            <div className="flex flex-col gap-1.5 p-2.5">
                {/* Header: Folio + OV + Status + Kebab Action Menu */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold tracking-tight text-foreground truncate">
                            {folio}
                        </span>
                        {order.sale_order_number && (
                            <span className="font-mono text-3xs text-muted-foreground truncate">
                                · {order.sale_order_number}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={order.status} size="sm" />
                        <div className="text-muted-foreground hover:text-foreground">
                            {workOrderActions.render(order, actionsCtx)}
                        </div>
                    </div>
                </div>

                {/* Product / Job Title & Quantity */}
                <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground flex-1" title={title}>
                        {title}
                    </p>
                    {formattedQty && (
                        <span className="shrink-0 font-mono text-3xs font-semibold text-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded-xs tabular-nums">
                            {formattedQty}
                        </span>
                    )}
                </div>

                {/* Customer & Delivery / Due Date */}
                <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground pt-0.5">
                    <div className="flex items-center gap-1 min-w-0 truncate">
                        <User className="h-3 w-3 shrink-0 opacity-70" />
                        <span className="truncate">{order.sale_customer_name || "Interno / Stock"}</span>
                    </div>
                    {dateText && (
                        <div className={cn(
                            "flex items-center gap-1 shrink-0 font-mono text-3xs tabular-nums",
                            isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                        )}>
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{dateText}</span>
                        </div>
                    )}
                </div>

                {/* Contextual Badges (Only rendered when condition is met) */}
                {(isOverdue || hasOutsourcing || isMissingMaterials) && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {isOverdue && (
                            <Chip intent="destructive" size="xs">
                                Atrasada
                            </Chip>
                        )}
                        {order.outsourcing_status === 'partial' && (
                            <Chip intent="info" size="xs">
                                Terc. Parcial
                            </Chip>
                        )}
                        {order.outsourcing_status === 'full' && (
                            <Chip intent="primary" size="xs">
                                Tercerizado
                            </Chip>
                        )}
                        {isMissingMaterials && (
                            <Chip intent="warning" size="xs" icon={AlertCircle}>
                                Sin materiales
                            </Chip>
                        )}
                    </div>
                )}
            </div>
        </CardSurface>
    )
}

export function WorkOrderKanban({ orders, onManage, onDuplicate, onAnnul, isLoading }: KanbanProps) {
    return (
        <div className="flex flex-1 min-h-0 gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
                const stageOrders = isLoading ? [] : orders.filter(o => o.current_stage === stage.id)
                const Icon = stage.icon

                return (
                    <div
                        key={stage.id}
                        className={cn(
                            "flex-shrink-0 w-80 rounded-md flex flex-col border shadow-card",
                            stage.color
                        )}
                    >
                        <div className="px-3 py-2.5 border-b flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-bold text-xs uppercase tracking-wider">{stage.label}</h3>
                            </div>
                            <Chip size="xs" className="min-w-[20px] justify-center">
                                {isLoading ? <Skeleton className="h-2.5 w-3" /> : stageOrders.length}
                            </Chip>
                        </div>

                        {isLoading ? (
                            <div className="p-2 flex-1">
                                <CardSkeleton count={3} variant="list" />
                            </div>
                        ) : (
                            <div className="p-2 space-y-2 flex-1 overflow-y-auto rounded-b-md">
                                {stageOrders.map((order) => (
                                    <KanbanCard
                                        key={order.id}
                                        order={order}
                                        onManage={onManage}
                                        onDuplicate={onDuplicate}
                                        onAnnul={onAnnul}
                                    />
                                ))}
                                {stageOrders.length === 0 && (
                                    <div className="h-16 border border-dashed border-muted/30 rounded-md flex items-center justify-center text-xs text-muted-foreground italic">
                                        Sin órdenes
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
