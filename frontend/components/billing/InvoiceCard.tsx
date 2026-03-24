"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowRight, Receipt, FileBadge, Package } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { InvoiceHubStatus } from "@/components/billing/InvoiceHubStatus"

type InvoiceType = 'sale_invoice' | 'purchase_invoice'

interface InvoiceCardProps {
    item: any
    type: InvoiceType
    onClick?: () => void
    className?: string
}

const dteTypeLabel: Record<string, string> = {
    FACTURA: 'FAC',
    FACTURA_EXENTA: 'FE',
    BOLETA: 'BOL',
    BOLETA_EXENTA: 'BE',
    NOTA_CREDITO: 'NC',
    NOTA_DEBITO: 'ND',
    PURCHASE_INV: 'FAC',
}

export function InvoiceCard({ item, type, onClick, className }: InvoiceCardProps) {
    const isSale = type === 'sale_invoice'
    const isPurchase = type === 'purchase_invoice'
    const isNote = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(item.dte_type)

    // Icon and color scheme
    let Icon = Receipt
    let iconBg = "bg-primary/5"
    let iconColor = "text-primary/60"
    let iconBorder = "border-primary/10"

    if (isPurchase) {
        Icon = Package
        iconBg = "bg-indigo-500/5"
        iconColor = "text-indigo-500/60"
        iconBorder = "border-indigo-500/10"
    } else if (isNote) {
        Icon = FileBadge
        iconBg = "bg-amber-500/5"
        iconColor = "text-amber-500/60"
        iconBorder = "border-amber-500/10"
    }

    const typeCode = dteTypeLabel[item.dte_type] ?? 'DOC'
    const docNumber = item.number ? `${typeCode}-${item.number}` : '---'
    const partnerName = item.partner_name || item.customer_name || item.supplier_name || '---'

    const total = parseFloat(item.total ?? '0')

    return (
        <div
            className={cn(
                "group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer",
                className
            )}
            onClick={onClick}
        >
            {/* Left: icon + info */}
            <div className="flex items-center gap-4 min-w-0">
                <div className={cn("w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center border", iconBg, iconColor, iconBorder)}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                            {docNumber}
                        </span>
                        <h4 className="font-bold text-foreground truncate">
                            {partnerName}
                        </h4>
                        {isNote && (
                            <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                                {item.dte_type_display}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatPlainDate(item.date)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right: status + total + arrow */}
            <div className="flex items-center gap-4 shrink-0 ml-4">
                {/* Status badge */}
                <div className="hidden sm:flex flex-col items-end">
                    <InvoiceHubStatus invoice={item} />
                </div>

                <div className="text-right min-w-[100px]">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</div>
                    <MoneyDisplay amount={total} showColor={false} className="text-sm" />
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="group-hover:translate-x-1 transition-transform"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ArrowRight className="h-5 w-5 text-primary" />
                </Button>
            </div>
        </div>
    )
}
