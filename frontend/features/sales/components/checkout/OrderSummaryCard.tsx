"use client"

import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"

interface OrderSummaryCardProps {
    orderLines: any[]
    total: number
    dteType?: string
}

export function OrderSummaryCard({
    orderLines,
    total,
    dteType
}: OrderSummaryCardProps) {
    const isExempt = dteType === 'FACTURA_EXENTA' || dteType === 'BOLETA_EXENTA';
    const net = isExempt ? total : PricingUtils.grossToNet(total);
    const tax = isExempt ? 0 : PricingUtils.extractTax(total);

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
                                        <p className="font-bold text-[13px] leading-tight text-foreground/90 truncate mr-2" title={line.product_name || line.name || line.description}>
                                            {line.product_name || line.name || line.description}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            {line.internal_code && (
                                                <Badge variant="outline" className="text-[8px] h-3 px-1 font-normal opacity-70 uppercase border-muted-foreground/20">
                                                    {line.internal_code}
                                                </Badge>
                                            )}
                                            {line.code && line.code !== line.internal_code && (
                                                <Badge variant="secondary" className="text-[8px] h-3 px-1 font-normal opacity-70 uppercase">
                                                    {line.code}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground font-bold">
                                                {line.qty || line.quantity} {line.uom_name || 'un'}
                                            </Badge>
                                            {line.product_type === 'MANUFACTURABLE' && (
                                                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none text-[8px] py-0 h-4 font-black uppercase">
                                                    Fab
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <p className="font-mono text-xs font-black whitespace-nowrap pt-0.5">
                                        {formatCurrency(isExempt ? PricingUtils.calculateLineNet(line.qty || line.quantity, line.unit_price_net || line.unit_price) : (line.total_gross || PricingUtils.calculateLineTotal(line.qty || line.quantity, line.unit_price_net || line.unit_price)))}
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
                    <span className="whitespace-nowrap font-mono">{formatCurrency(net)}</span>
                </div>
                {!isExempt && (
                    <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                        <span>IVA (19%)</span>
                        <span className="whitespace-nowrap font-mono">{formatCurrency(tax)}</span>
                    </div>
                )}
                <Separator className="my-2 opacity-50" />
                <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Venta</span>
                    <span className="text-2xl font-black text-primary tracking-tighter whitespace-nowrap">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>
        </div>
    )
}
