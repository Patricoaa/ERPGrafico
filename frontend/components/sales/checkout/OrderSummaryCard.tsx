"use client"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag, User, Tag } from "lucide-react"

interface OrderSummaryCardProps {
    orderLines: any[]
    total: number
    customerName?: string
}

export function OrderSummaryCard({ orderLines, total, customerName }: OrderSummaryCardProps) {
    return (
        <div className="h-full flex flex-col bg-muted/20 border-l">
            <div className="p-6 space-y-6 flex-1 overflow-auto">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Resumen de Orden
                    </h3>

                    <div className="space-y-3">
                        {orderLines.map((line, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-2 text-sm leading-tight">
                                <div className="space-y-1">
                                    <p className="font-medium">{line.product_name || line.name || line.description}</p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                                            {line.qty || line.quantity} {line.uom_name || 'un'}
                                        </Badge>
                                        {line.product_type === 'MANUFACTURABLE' && (
                                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none text-[8px] py-0 h-4 font-bold uppercase">
                                                Fab
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <p className="font-mono text-xs">
                                    {((line.qty || line.quantity) * (line.unit_price_net || line.unit_price)).toLocaleString('es-CL')}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{customerName || "Cliente Genérico"}</span>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-background border-t space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal Neto</span>
                    <span>{(total / 1.19).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>IVA (19%)</span>
                    <span>{(total - (total / 1.19)).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-2xl font-black text-primary">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </span>
                </div>
            </div>
        </div>
    )
}
