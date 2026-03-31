"use client"

import { Badge } from "@/components/ui/badge"
import { Calendar, ArrowRight, Receipt, FileBadge, Package, GitBranch } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/ui/MoneyDisplay"
import { InvoiceHubStatus } from "@/features/billing/components/InvoiceHubStatus"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

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
    const { openHub } = useHubPanel()
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
        iconBg = "bg-primary/5"
        iconColor = "text-indigo-500/60"
        iconBorder = "border-primary/20/10"
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

    const handleClick = () => {
        if (onClick) {
            onClick()
        }
    }

    return (
        <div className={cn("flex flex-col gap-0 w-full min-w-0 max-w-full", className)}>
            <div
                className={cn(
                    "group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl transition-all cursor-pointer hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 relative z-10"
                )}
                onClick={handleClick}
            >
                {/* Left: icon + info */}
                <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                        "w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center border transition-transform duration-300 group-hover:scale-105",
                        iconBg, iconColor, iconBorder
                    )}>
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
                    <div className="hidden sm:flex items-center gap-3">
                        {/* Parent/Corrected Invoice Link (only for Notes) */}
                        {isNote && (item.corrected_invoice || item.sale_order || item.purchase_order) && (
                            <Badge 
                                variant="outline" 
                                className="h-6 px-2 gap-1.5 text-[10px] font-bold border-primary/20/30 text-primary bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (item.corrected_invoice) {
                                        openHub({ orderId: null, invoiceId: item.corrected_invoice.id, type: 'sale' })
                                    } else if (item.sale_order || item.purchase_order) {
                                        openHub({ orderId: item.sale_order || item.purchase_order, type: item.sale_order ? 'sale' : 'purchase' })
                                    }
                                }}
                            >
                                <GitBranch className="size-3" />
                                {item.corrected_invoice?.display_id || item.sale_order_number || item.purchase_order_number || 'Ver Origen'}
                            </Badge>
                        )}

                        {/* Associated Adjustments Links (for regular invoices) */}
                        {!isNote && item.adjustments?.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                {item.adjustments.map((adj: any) => (
                                    <Badge 
                                        key={adj.id}
                                        variant="outline" 
                                        className="h-6 px-2 gap-1.5 text-[10px] font-bold border-primary/20/30 text-primary bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            openHub({ orderId: null, invoiceId: adj.id, type: isSale ? 'sale' : 'purchase' })
                                        }}
                                    >
                                        <GitBranch className="size-3" />
                                        {adj.display_id || adj.number}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <InvoiceHubStatus invoice={item} />
                    </div>

                    <div className="text-right min-w-[100px]">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</div>
                        <MoneyDisplay amount={total} showColor={false} className="text-sm" />
                    </div>

                    <div className="transition-transform duration-500 ml-2">
                        <ArrowRight className="h-5 w-5 text-primary opacity-50 group-hover:opacity-100" />
                    </div>
                </div>
            </div>
        </div>
    )
}
