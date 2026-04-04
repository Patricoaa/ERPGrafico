"use client"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"


interface NoteItemsSummaryProps {
    items: any[]
    totalNet: number
    totalTax: number
    total: number
    isExempt?: boolean
}


export function NoteItemsSummary({
    items,
    totalNet,
    totalTax,
    total,
    isExempt = false
}: NoteItemsSummaryProps) {

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
                            {items.length === 0 ? (
                                <p className="text-center text-muted-foreground text-[11px] font-bold py-8 uppercase tracking-tighter">
                                    No hay productos seleccionados
                                </p>
                            ) : (
                                items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start gap-4 animate-in fade-in duration-500">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <p className="font-bold text-[13px] leading-tight text-foreground/90 truncate mr-2" title={item.product_name}>
                                                {item.product_name || `Producto ${item.product_id}`}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground font-bold">
                                                    {item.quantity} {item.uom_name || 'un'}
                                                </Badge>
                                                {item.reason && (
                                                    <Badge variant="outline" className="text-[8px] h-3 px-1 font-normal opacity-70 border-muted-foreground/20 italic truncate max-w-[120px]">
                                                        {item.reason}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <p className="font-mono text-xs font-black whitespace-nowrap pt-0.5">
                                            {formatCurrency((parseFloat(item.unit_price_gross) || (parseFloat(item.unit_price) + parseFloat(item.tax_amount))) * parseFloat(item.quantity))}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-background border-t shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] space-y-3">
                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                    <span>Subtotal Neto</span>
                    <span className="whitespace-nowrap font-mono">{formatCurrency(totalNet)}</span>
                </div>
                {(totalTax > 0 || isExempt) && (
                    <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                        <span>IVA {isExempt ? "(0% Exento)" : "(19%)"}</span>
                        <span className={cn("whitespace-nowrap font-mono", isExempt && "opacity-40")}>
                            {formatCurrency(totalTax)}
                        </span>
                    </div>
                )}

                <Separator className="my-2 opacity-50" />
                <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Ajuste</span>
                    <span className="text-2xl font-black text-primary tracking-tighter whitespace-nowrap">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>
        </div>
    )
}

