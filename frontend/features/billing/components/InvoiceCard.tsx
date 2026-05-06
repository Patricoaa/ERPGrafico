"use client"

import { Badge } from "@/components/ui/badge"
import { Calendar, ArrowRight, Receipt, FileBadge, Package, GitBranch } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { InvoiceHubStatus } from "@/features/billing/components/InvoiceHubStatus"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Card } from "@/components/ui/card"
import { Invoice } from "@/features/billing/types"

type InvoiceType = 'sale_invoice' | 'purchase_invoice'

interface InvoiceCardProps {
    item: Invoice
    type: InvoiceType
    onClick?: () => void
    onActionSuccess?: () => void
    className?: string
    isSelected?: boolean
    visibleColumns?: Record<string, boolean>
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

export function InvoiceCard({ item, type, onClick, onActionSuccess, className, isSelected = false, visibleColumns }: InvoiceCardProps) {
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
        iconColor = "text-info/60"
        iconBorder = "border-primary/20"
    } else if (isNote) {
        Icon = FileBadge
        iconBg = "bg-warning/5"
        iconColor = "text-warning/60"
        iconBorder = "border-warning/10"
    }

    const typeCode = dteTypeLabel[item.dte_type] ?? 'DOC'
    const docNumber = item.number ? `${typeCode}-${item.number}` : '---'
    const partnerName = item.partner_name || item.customer_name || item.supplier_name || '---'
    const displayTotal = parseFloat(item.total ?? '0')

    // Enrichment Data
    const lines = item.lines || item.items || []
    const pending = parseFloat(String(item.pending_amount ?? 0))
    const hasPending = displayTotal > 0 && pending > 0

    const handleClick = () => {
        if (onClick) onClick()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
        }
    }

    return (
        <Card
            role="button"
            tabIndex={0}
            data-order-card="true"
            aria-selected={isSelected}
            data-state={isSelected ? 'selected' : undefined}
            className={cn(
                "group flex flex-col p-4 relative z-10 cursor-pointer border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                isSelected && "ring-2 ring-inset ring-primary/40 bg-primary/5 border-transparent",
                className
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            {/* ROW 1: Header */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4 min-w-[30%]">
                    <div className={cn("w-12 h-12 rounded-sm flex flex-col items-center justify-center border transition-transform duration-300 group-hover:scale-105 shrink-0", iconBg, iconColor, iconBorder)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        {visibleColumns?.partner_name !== false && (
                            <div className="flex items-center gap-2">
                                <h4 className="font-heading font-extrabold text-base text-foreground line-clamp-1 max-w-[200px] tracking-tight">
                                    {partnerName}
                                </h4>
                            </div>
                        )}
                        <div className="flex items-center gap-2.5 mt-1 text-[11px] font-medium text-muted-foreground flex-wrap">
                            <span className="font-mono font-semibold text-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded-sm">
                                {docNumber}
                            </span>
                            {visibleColumns?.date !== false && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3 opacity-70" />
                                    {formatPlainDate(item.date)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* CENTER: Status Badges and Origin Links */}
                {visibleColumns?.status !== false && (
                    <div className="hidden sm:flex items-center gap-3">
                        {/* Parent/Corrected Invoice Link (only for Notes) */}
                        {isNote && (item.corrected_invoice || item.sale_order || item.purchase_order) && (
                            <Badge 
                                variant="outline" 
                                className="h-6 px-2 gap-1.5 text-[10px] font-bold border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (item.corrected_invoice) {
                                        openHub({ orderId: null, invoiceId: item.corrected_invoice.id, type: 'sale', onActionSuccess })
                                    } else if (item.sale_order || item.purchase_order) {
                                        openHub({ orderId: item.sale_order || item.purchase_order, type: item.sale_order ? 'sale' : 'purchase', onActionSuccess })
                                    }
                                }}
                            >
                                <GitBranch className="size-3" />
                                {item.corrected_invoice?.display_id || item.sale_order_number || item.purchase_order_number || 'Ver Origen'}
                            </Badge>
                        )}

                        {/* Associated Adjustments Links (for regular invoices) */}
                        {!isNote && item.adjustments && item.adjustments.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                {item.adjustments?.map((adj: any) => (
                                    <Badge 
                                        key={adj.id}
                                        variant="outline" 
                                        className="h-6 px-2 gap-1.5 text-[10px] font-bold border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            openHub({ orderId: null, invoiceId: adj.id, type: isSale ? 'sale' : 'purchase', onActionSuccess })
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
                )}

                <div className="flex items-center gap-5">
                    <div className="flex flex-col items-end min-w-[100px]">
                        {visibleColumns?.total !== false && (
                            <>
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-extrabold mb-0.5">
                                    Total
                                </span>
                                <MoneyDisplay
                                    amount={displayTotal}
                                    showColor={false}
                                    className="text-base font-heading font-bold tracking-tight"
                                />
                            </>
                        )}
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
            </div>

            {/* ROW 2: Product Lines & Pending */}
            {(lines.length > 0 || hasPending) && (
                <div className="mt-1.5 pt-1.5 border-t border-border/30 flex items-start justify-between gap-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 flex-1">
                        {lines.map((line: any, idx: number) => (
                            <span key={idx} className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                <span className="font-semibold text-foreground/70">
                                    {Math.round(parseFloat(line.quantity || 0))}
                                </span>
                                <span className="text-muted-foreground/50">×</span>
                                <span className="truncate max-w-[200px]">
                                    {line.product_name || line.description || 'Producto'}
                                </span>
                            </span>
                        ))}
                    </div>

                    {hasPending && visibleColumns?.payment_status !== false && (
                        <div className="flex items-center gap-5 shrink-0 pl-4">
                            <div className="flex flex-col items-end min-w-[100px]">
                                <span className="text-[9px] text-warning/80 uppercase tracking-widest font-extrabold mb-0.5">
                                    Pdte
                                </span>
                                <MoneyDisplay
                                    amount={pending}
                                    showColor={false}
                                    className="text-sm font-heading font-bold tracking-tight text-warning"
                                />
                            </div>
                            <div className="w-5" />
                        </div>
                    )}
                </div>
            )}
        </Card>
    )
}
