"use client"

import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
    Clock,
    User,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
} from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { CardSkeleton, Skeleton } from "@/components/shared"
import { WorkOrder } from "../types"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { STAGES_ORDERED } from "../constants/stages"
import { isWorkOrderOverdue } from "../utils"
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"

interface KanbanProps {
    orders: WorkOrder[]
    onTransition: (orderId: number, nextStage: string) => void
    onManage: (orderId: number) => void
    isLoading?: boolean
}

const STAGES = STAGES_ORDERED.filter(s => s.showInKanban)

// ── Droppable column ─────────────────────────────────────────────────────────

interface DroppableColumnProps {
    stageId: string
    children: React.ReactNode
}

function DroppableColumn({ stageId, children }: DroppableColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: stageId })
    return (
        <div
            ref={setNodeRef}
            className={cn(
                "p-2 space-y-3 flex-1 overflow-y-auto rounded-b-md transition-colors",
                isOver && "bg-primary/10 ring-2 ring-inset ring-primary/30"
            )}
        >
            {children}
        </div>
    )
}

// ── Draggable card ────────────────────────────────────────────────────────────

interface DraggableCardProps {
    order: WorkOrder
    onManage: (id: number) => void
    isDragging?: boolean
}

function DraggableCard({ order, onManage, isDragging }: DraggableCardProps) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: String(order.id),
        data: { order },
    })

    const style = transform
        ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
        : undefined

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <KanbanCard order={order} onManage={onManage} faded={isDragging} />
        </div>
    )
}

// ── Card content (shared between draggable + overlay) ────────────────────────

function KanbanCard({ order, onManage, faded }: { order: WorkOrder; onManage: (id: number) => void; faded?: boolean }) {
    return (
        <Card
            onClick={() => onManage(order.id)}
            className={cn(
                "cursor-pointer hover:shadow-md transition-all border-none shadow-sm rounded-md",
                "active:scale-95 duration-100",
                faded && "opacity-40"
            )}
        >
            <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                        {formatEntityDisplay('production.workorder', order)}
                    </span>
                    <StatusBadge status={order.status} size="sm" />
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    {isWorkOrderOverdue(order) && (
                        <Badge variant="destructive" className="h-4 text-[9px] px-1 uppercase tracking-wider font-bold">
                            Atrasada
                        </Badge>
                    )}
                    {order.outsourcing_status === 'partial' && (
                        <StatusBadge status="PARTIAL" label="Parcial" size="sm" className="bg-info/10 text-info border-info/20" />
                    )}
                    {order.outsourcing_status === 'full' && (
                        <StatusBadge status="CONFIRMED" label="Tercerizado" size="sm" className="bg-primary/5 text-primary border-primary/10" />
                    )}
                </div>
                {order.status === 'FINISHED' && (
                    <div className="flex items-center gap-1.5 text-success font-bold text-[10px] uppercase">
                        <CheckCircle2 className="h-3 w-3" />
                        Completada
                    </div>
                )}
                <div>
                    <p className="text-sm font-semibold line-clamp-2 leading-snug">{order.description}</p>
                </div>
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center text-[11px] text-muted-foreground">
                        <User className="mr-1.5 h-3 w-3" />
                        <span className="truncate">{order.sale_customer_name || "Manual / Interno"}</span>
                    </div>
                    <div className={cn("flex items-center text-[11px]", isWorkOrderOverdue(order) ? "text-destructive font-medium" : "text-muted-foreground")}>
                        <Clock className="mr-1.5 h-3 w-3" />
                        <span>{order.sale_order_date || order.due_date || "Sin fecha"}</span>
                    </div>
                </div>
                {order.materials?.length === 0 && order.current_stage === 'MATERIAL_ASSIGNMENT' && (
                    <div className="flex items-center text-[10px] text-warning bg-warning/10 p-1.5 rounded border border-warning/20">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Sin materiales asignados
                    </div>
                )}
                <div className="pt-2 flex justify-between items-center border-t border-dashed">
                    <span className="text-[10px] text-muted-foreground">Click para gestionar</span>
                    <ChevronRight className="h-3 w-3 text-primary" />
                </div>
            </CardContent>
        </Card>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function WorkOrderKanban({ orders, onTransition, onManage, isLoading }: KanbanProps) {
    const [activeOrder, setActiveOrder] = useState<WorkOrder | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

    const handleDragStart = (event: DragStartEvent) => {
        const order = orders.find(o => String(o.id) === String(event.active.id))
        setActiveOrder(order ?? null)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveOrder(null)
        if (!over) return
        const orderId = Number(active.id)
        const nextStage = String(over.id)
        const order = orders.find(o => o.id === orderId)
        if (!order || order.current_stage === nextStage) return
        onTransition(orderId, nextStage)
    }

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex space-x-4 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
                {STAGES.map((stage) => {
                    const stageOrders = isLoading ? [] : orders.filter(o => o.current_stage === stage.id)
                    const Icon = stage.icon

                    return (
                        <div
                            key={stage.id}
                            className={cn(
                                "flex-shrink-0 w-80 rounded-md flex flex-col border shadow-sm",
                                stage.color
                            )}
                        >
                            <div className="p-4 border-b flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">{stage.label}</h3>
                                </div>
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-border bg-white text-muted-foreground whitespace-nowrap min-w-[20px] flex justify-center">
                                    {isLoading ? <Skeleton className="h-2.5 w-3" /> : stageOrders.length}
                                </span>
                            </div>

                            {isLoading ? (
                                <div className="p-2 flex-1">
                                    <CardSkeleton count={3} variant="list" />
                                </div>
                            ) : (
                                <DroppableColumn stageId={stage.id}>
                                    {stageOrders.map((order) => (
                                        <DraggableCard
                                            key={order.id}
                                            order={order}
                                            onManage={onManage}
                                            isDragging={activeOrder?.id === order.id}
                                        />
                                    ))}
                                    {stageOrders.length === 0 && (
                                        <div className="h-24 border-2 border-dashed border-muted/20 rounded-md flex items-center justify-center text-xs text-muted-foreground italic">
                                            Sin órdenes
                                        </div>
                                    )}
                                </DroppableColumn>
                            )}
                        </div>
                    )
                })}
            </div>

            <DragOverlay>
                {activeOrder && (
                    <div className="rotate-2 opacity-90 shadow-2xl w-80">
                        <KanbanCard order={activeOrder} onManage={() => {}} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    )
}
