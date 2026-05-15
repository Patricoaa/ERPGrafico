"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { CommentSystem } from "@/components/shared/CommentSystem"
import { useSaleOrderComments } from "../hooks/useSaleOrderComments"

interface SaleOrderSidebarProps {
    orderId: string | number
}

export function SaleOrderSidebar({ orderId }: SaleOrderSidebarProps) {
    const { comments, addComment } = useSaleOrderComments(orderId)

    const mappedComments = comments.map(c => ({
        user: c.user_name,
        text: c.text,
        timestamp: c.created_at,
        source: c.source_label
    }))

    return (
        <div className="w-80 border-l bg-muted/5 flex flex-col h-full min-h-0 overflow-hidden hidden lg:flex shrink-0 divide-y">
            {/* Seccion de Observaciones / Comentarios */}
            <div className="flex flex-col h-1/2">
                <div className="p-3 bg-background border-b shrink-0">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground">Observaciones Internas</h3>
                </div>
                <div className="flex-1 min-h-0 relative p-3">
                    <CommentSystem
                        comments={mappedComments}
                        onAddComment={addComment}
                        placeholder="Agregar observación..."
                        emptyMessage="No hay observaciones"
                        maxHeight="100%"
                    />
                </div>
            </div>

            {/* Seccion de Actividad */}
            <div className="flex flex-col h-1/2">
                <ActivitySidebar
                    entityId={orderId}
                    entityType="sale_order"
                    className="h-full flex-1 min-h-0 p-0"
                />
            </div>
        </div>
    )
}
