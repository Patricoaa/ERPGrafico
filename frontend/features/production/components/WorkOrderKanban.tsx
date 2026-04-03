"use client"

import React from "react"
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
    CheckCircle2,
    Ban
} from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Badge } from "@/components/ui/badge"

interface KanbanProps {
    orders: any[]
    onTransition: (orderId: number, nextStage: string) => void
    onManage: (orderId: number) => void
}

const STAGES = [
    { id: 'MATERIAL_ASSIGNMENT', label: 'Asignación de Materiales', color: 'bg-secondary text-secondary-foreground', icon: Package },
    { id: 'MATERIAL_APPROVAL', label: 'Aprobación de Materiales', color: 'bg-info/10', icon: CheckCircle2 },
    { id: 'PREPRESS', label: 'Pre-Prensa', color: 'bg-primary/10', icon: FileText },
    { id: 'PRESS', label: 'Impresión', color: 'bg-warning/10', icon: Printer },
    { id: 'POSTPRESS', label: 'Post-Impresión', color: 'bg-info/5', icon: Layers },
    { id: 'FINISHED', label: 'Finalizado', color: 'bg-success/10', icon: CheckCircle2 },
    { id: 'CANCELLED', label: 'Anulada', color: 'bg-muted/50', icon: Ban },
]

export function WorkOrderKanban({ orders, onTransition, onManage }: KanbanProps) {
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
                                    onClick={() => onManage(order.id)}
                                    className={cn(
                                        "cursor-pointer hover:shadow-md transition-all border-none shadow-sm",
                                        "active:scale-95 duration-100"
                                    )}
                                >
                                    <CardContent className="p-3 space-y-3">
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                OT-{order.number}
                                            </span>
                                            {order.outsourcing_status === 'partial' && (
                                                <StatusBadge 
                                                    status="PARTIAL" 
                                                    label="Parcial" 
                                                    size="sm" 
                                                    className="bg-info/10 text-info border-info/20"
                                                />
                                            )}
                                            {order.outsourcing_status === 'full' && (
                                                <StatusBadge 
                                                    status="CONFIRMED" 
                                                    label="Tercerizado" 
                                                    size="sm" 
                                                    className="bg-primary/5 text-primary border-primary/10"
                                                />
                                            )}
                                        </div>
                                        {order.status === 'FINISHED' && (
                                            <div className="flex items-center gap-1.5 text-success font-bold text-[10px] uppercase">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Completada
                                            </div>
                                        )}

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
                            ))}
                            {stageOrders.length === 0 && (
                                <div className="h-24 border-2 border-dashed border-muted/20 rounded-lg flex items-center justify-center text-xs text-muted-foreground italic">
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
