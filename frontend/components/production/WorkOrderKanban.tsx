"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
    Clock,
    User,
    ChevronRight,
    Package,
    AlertCircle,
    Printer,
    FileText,
    Layers,
    CheckCircle2
} from "lucide-react"

interface KanbanProps {
    orders: any[]
    onTransition: (orderId: number, nextStage: string) => void
    onManage: (orderId: number) => void
}

const STAGES = [
    { id: 'MATERIAL_ASSIGNMENT', label: 'Materiales', color: 'bg-slate-100', icon: Package },
    { id: 'MATERIAL_APPROVAL', label: 'Aprobación', color: 'bg-blue-50', icon: CheckCircle2 },
    { id: 'PREPRESS', label: 'Pre-Prensa', color: 'bg-purple-50', icon: FileText },
    { id: 'PRESS', label: 'Imprenta', color: 'bg-orange-50', icon: Printer },
    { id: 'POSTPRESS', label: 'Terminación', color: 'bg-cyan-50', icon: Layers },
    { id: 'FINISHED', label: 'Terminadas', color: 'bg-green-50', icon: CheckCircle2 },
]

export function WorkOrderKanban({ orders, onTransition, onManage }: KanbanProps) {
    const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null)

    const handleDragStart = (e: React.DragEvent, id: number) => {
        setDraggedOrderId(id)
        e.dataTransfer.setData("orderId", id.toString())
        e.dataTransfer.effectAllowed = "move"
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
    }

    const handleDrop = (e: React.DragEvent, nextStage: string) => {
        e.preventDefault()
        const id = parseInt(e.dataTransfer.getData("orderId"))
        if (id) {
            onTransition(id, nextStage)
        }
        setDraggedOrderId(null)
    }

    return (
        <div className="flex space-x-4 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
            {STAGES.map((stage) => {
                const stageOrders = orders.filter(o => o.current_stage === stage.id)
                const Icon = stage.icon

                return (
                    <div
                        key={stage.id}
                        className={cn(
                            "flex-shrink-0 w-80 rounded-xl flex flex-col border shadow-sm",
                            stage.color
                        )}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, stage.id)}
                    >
                        <div className="p-4 border-b flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-bold text-sm uppercase tracking-wider">{stage.label}</h3>
                            </div>
                            <Badge variant="secondary" className="bg-white/50">{stageOrders.length}</Badge>
                        </div>

                        <div className="p-2 space-y-3 flex-1 overflow-y-auto">
                            {stageOrders.map((order) => (
                                <Card
                                    key={order.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, order.id)}
                                    className={cn(
                                        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-none shadow-sm",
                                        draggedOrderId === order.id ? "opacity-40" : "opacity-100"
                                    )}
                                    onDoubleClick={() => onManage(order.id)}
                                >
                                    <CardContent className="p-3 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                OT-{order.number}
                                            </span>
                                            {order.status === 'FINISHED' && (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            )}
                                        </div>

                                        <div>
                                            <p className="text-sm font-semibold line-clamp-2 leading-snug">
                                                {order.description}
                                            </p>
                                        </div>

                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex items-center text-[11px] text-muted-foreground">
                                                <User className="mr-1.5 h-3 w-3" />
                                                <span className="truncate">{order.sale_customer_name || "Manual / Interno"}</span>
                                            </div>
                                            <div className="flex items-center text-[11px] text-muted-foreground">
                                                <Clock className="mr-1.5 h-3 w-3" />
                                                <span>{order.due_date || "Sin fecha"}</span>
                                            </div>
                                        </div>

                                        {order.materials?.length === 0 && order.current_stage === 'MATERIAL_ASSIGNMENT' && (
                                            <div className="flex items-center text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-100">
                                                <AlertCircle className="mr-1 h-3 w-3" />
                                                Sin materiales asignados
                                            </div>
                                        )}

                                        <div className="pt-2 flex justify-between items-center border-t border-dashed">
                                            <button
                                                onClick={() => onManage(order.id)}
                                                className="text-[11px] text-primary font-medium hover:underline flex items-center"
                                            >
                                                Gestionar <ChevronRight className="h-3 w-3 ml-0.5" />
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {stageOrders.length === 0 && (
                                <div className="h-24 border-2 border-dashed border-gray-200/50 rounded-lg flex items-center justify-center text-xs text-muted-foreground italic">
                                    Sin órdenes
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
