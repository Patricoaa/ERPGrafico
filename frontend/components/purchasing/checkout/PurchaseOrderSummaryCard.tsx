"use client"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag } from "lucide-react"
import { formatCurrency } from "@/lib/currency"

interface PurchaseOrderSummaryCardProps {
    orderLines: any[]
    total: number
}

export function PurchaseOrderSummaryCard({
    orderLines,
    total
}: PurchaseOrderSummaryCardProps) {
    return (
        <div className="h-full flex flex-col bg-muted/20 border-l">
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4" />
                            Detalle de Productos
                        </h3>

                        <div className="space-y-4">
                            {orderLines.map((line, idx) => (
                                <div key={idx} className="flex justify-between items-start gap-4 animate-in fade-in duration-500">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <p className="font-bold text-[13px] leading-tight text-foreground/90 truncate mr-2" title={line.name}>
                                            {line.name}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground font-bold">
                                                {line.qty || line.quantity} {line.uom || 'un'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="font-mono text-xs font-black whitespace-nowrap pt-0.5">
                                        {formatCurrency(Math.round((line.qty || line.quantity) * (line.unit_cost || 0)))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-background border-t shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] space-y-3">
                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                    <span>Subtotal Neto</span>
                    <span className="whitespace-nowrap font-mono">{formatCurrency(Math.round(total / 1.19))}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                    <span>IVA (19%)</span>
                    <span className="whitespace-nowrap font-mono">{formatCurrency(Math.round(total - (total / 1.19)))}</span>
                </div>
                <Separator className="my-2 opacity-50" />
                <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Compra</span>
                    <span className="text-2xl font-black text-destructive tracking-tighter whitespace-nowrap">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>
        </div>
    )
}
