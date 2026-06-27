"use client"

import { useMemo } from "react"
import {Card, CardContent} from "@/components/ui/card"
import { cn, parseDateOnly } from "@/lib/utils"
import { Clock, User, ChevronRight, Calendar } from "lucide-react"

import { CardSkeleton, Chip, StatusBadge } from '@/components/shared'
import { type WorkOrder } from "../types"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { isWorkOrderOverdue } from "../utils"

interface TimelineProps {
    orders: WorkOrder[]
    onManage: (orderId: number) => void
    isLoading?: boolean
}

type Column = { label: string; key: string; orders: WorkOrder[] }

function isSameDay(date1: Date, date2: Date) {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    )
}

function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function WorkOrderTimeline({ orders, onManage, isLoading }: TimelineProps) {
    const columns: Column[] = useMemo(() => {
        const today = startOfDay(new Date())
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
        const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 7)

        const active = orders.filter(o => o.status !== 'FINISHED' && o.status !== 'CANCELLED')

        const todayOrders = active.filter(o => {
            if (!o.due_date) return false
            return isSameDay(parseDateOnly(o.due_date), today)
        })
        const tomorrowOrders = active.filter(o => {
            if (!o.due_date) return false
            return isSameDay(parseDateOnly(o.due_date), tomorrow)
        })
        const weekOrders = active.filter(o => {
            if (!o.due_date) return false
            const d = parseDateOnly(o.due_date)
            return d > tomorrow && d <= endOfWeek
        })
        const noDueDate = active.filter(o => !o.due_date)

        return [
            { label: 'Hoy', key: 'today', orders: todayOrders },
            { label: 'Mañana', key: 'tomorrow', orders: tomorrowOrders },
            { label: 'Esta semana', key: 'week', orders: weekOrders },
            { label: 'Sin fecha', key: 'no_date', orders: noDueDate },
        ]
    }, [orders])

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
            {columns.map(({ label, key, orders: colOrders }) => (
                <div
                    key={key}
                    className="flex-shrink-0 w-80 flex flex-col rounded-md border shadow-card bg-background"
                >
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-bold text-sm uppercase tracking-wider">{label}</h3>
                        </div>
                        <Chip size="xs">{isLoading ? '…' : colOrders.length}</Chip>
                    </div>

                    <div className="p-2 space-y-3 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <CardSkeleton count={3} variant="list" />
                        ) : colOrders.length === 0 ? (
                            <div className="h-24 border-2 border-dashed border-muted/20 rounded-md flex items-center justify-center text-xs text-muted-foreground italic">
                                Sin órdenes
                            </div>
                        ) : (
                            colOrders.map((order) => (
                                <Card
                                    key={order.id}
                                    onClick={() => onManage(order.id)}
                                    className="card-interactive card-accent-cmyk cursor-pointer rounded-md active:scale-95"
                                >
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Chip size="xs">{formatEntityDisplay('production.workorder', order as unknown as Record<string, unknown>)}</Chip>
                                            <StatusBadge status={order.status} size="sm" />
                                        </div>
                                        {isWorkOrderOverdue(order) && (
                                            <Chip intent="destructive" size="xs">
                                                Atrasada
                                            </Chip>
                                        )}
                                        <p className="text-sm font-semibold line-clamp-2 leading-snug">{order.description}</p>
                                        <div className="space-y-1 text-[11px] text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                <span className="truncate">{order.sale_customer_name || 'Manual'}</span>
                                            </div>
                                            {order.due_date && (
                                                <div className={cn("flex items-center gap-1", isWorkOrderOverdue(order) && "text-destructive font-medium")}>
                                                    <Clock className="h-3 w-3" />
                                                    <span>{order.due_date}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="pt-1 flex justify-between items-center border-t border-dashed">
                                            <span className="text-[10px] text-muted-foreground">{order.current_stage?.replace(/_/g, ' ')}</span>
                                            <ChevronRight className="h-3 w-3 text-primary" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
