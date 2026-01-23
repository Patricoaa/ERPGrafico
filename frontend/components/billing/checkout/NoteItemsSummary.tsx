"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ShoppingBag } from "lucide-react"

interface NoteItemsSummaryProps {
    items: any[]
    totalNet: number
    totalTax: number
    total: number
}

export function NoteItemsSummary({
    items,
    totalNet,
    totalTax,
    total
}: NoteItemsSummaryProps) {
    return (
        <div className="flex flex-col h-full bg-card">
            <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Resumen de Ítems</h3>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {items.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8">
                            No hay productos seleccionados
                        </p>
                    ) : (
                        items.map((item, index) => (
                            <div key={index} className="space-y-1">
                                <div className="flex justify-between items-start gap-4">
                                    <span className="text-sm font-medium leading-none truncate">
                                        {item.product_name || `Producto ${item.product_id}`}
                                    </span>
                                    <span className="text-sm font-bold shrink-0">
                                        ${(parseFloat(item.unit_price) * parseFloat(item.quantity)).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Cant: {item.quantity}</span>
                                    <span>${parseFloat(item.unit_price).toLocaleString()} c/u</span>
                                </div>
                                {item.reason && (
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Razón: {item.reason}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-muted/30 space-y-2 mt-auto">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Neto</span>
                    <span>${totalNet.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>IVA (19%)</span>
                    <span>${totalTax.toLocaleString()}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">${total.toLocaleString()}</span>
                </div>
            </div>
        </div>
    )
}
