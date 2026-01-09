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
            <div className="p-6 space-y-6 flex-1 overflow-auto custom-scrollbar">
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Resumen de Orden
                    </h3>

                    <div className="space-y-4">
                        {orderLines.map((line, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-4">
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <p className="font-bold text-sm leading-tight text-foreground/90 truncate mr-2" title={line.product_name || line.name || line.description}>
                                        {line.product_name || line.name || line.description}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground font-medium">
                                            {line.qty || line.quantity} {line.uom_name || 'un'}
                                        </Badge>
                                        {line.product_type === 'MANUFACTURABLE' && (
                                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none text-[8px] py-0 h-4 font-black uppercase">
                                                Fab
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <p className="font-mono text-xs font-bold whitespace-nowrap pt-0.5">
                                    {((line.qty || line.quantity) * (line.unit_price_net || line.unit_price)).toLocaleString('es-CL')}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator className="opacity-50" />

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm bg-background border rounded-lg p-2.5 shadow-sm">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-bold text-muted-foreground truncate">{customerName || "Cliente Genérico"}</span>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-background border-t space-y-3">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Subtotal Neto</span>
                    <span className="whitespace-nowrap">{(total / 1.19).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>IVA (19%)</span>
                    <span className="whitespace-nowrap">{(total - (total / 1.19)).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/80">Total</span>
                    <span className="text-2xl font-black text-primary tracking-tighter whitespace-nowrap">
                        {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </span>
                </div>
            </div>
        </div>
    )
}
