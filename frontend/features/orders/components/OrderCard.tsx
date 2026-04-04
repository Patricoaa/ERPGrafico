"use client"

import React from "react"
import { Calendar, ArrowRight, ShoppingCart, Package, Monitor, FileBadge, Wand2, Receipt } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { OrderHubStatus } from "./OrderHubStatus"
import { NoteHubStatus } from "./NoteHubStatus"
import { PurchaseOrderHubStatus } from "./PurchaseOrderHubStatus"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { IndustrialCard } from "@/components/shared/IndustrialCard"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface OrderCardProps {
    item: any
    type: 'sale' | 'purchase' | 'work_order' | 'note' | 'ledger'
    onClick?: () => void
    onActionClick?: () => void
    hideStatus?: boolean
    isSelected?: boolean
    className?: string
}

export function OrderCard({ item, type, onClick, onActionClick, hideStatus = false, isSelected = false, className }: OrderCardProps) {
    const isSale = type === 'sale'
    const isNote = type === 'note'
    const isPurchase = type === 'purchase' || (isNote && (item.purchase_order || item.purchase_order_id || item.supplier_name))
    const isWorkOrder = type === 'work_order'
    const isLedger = type === 'ledger'

    // Determine Icon and Colors
    let Icon = ShoppingCart
    let iconBg = "bg-primary/5"
    let iconColor = "text-primary/60"
    let iconBorder = "border-primary/10"
    let prefix = "NV"

    if (isPurchase) {
        Icon = Package
        iconBg = "bg-primary/5"
        iconColor = "text-indigo-500/60"
        iconBorder = "border-primary/20/10"
        prefix = "OCS"
    } else if (isWorkOrder) {
        Icon = Wand2
        iconBg = "bg-primary/5"
        iconColor = "text-purple-500/60"
        iconBorder = "border-primary/20/10"
        prefix = "OT"
    } else if (isNote) {
        Icon = FileBadge
        iconBg = "bg-amber-500/5"
        iconColor = "text-amber-500/60"
        iconBorder = "border-amber-500/10"
        prefix = item.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND'
    } else if (isLedger) {
        Icon = ShoppingCart
        iconBg = "bg-primary/5"
        iconColor = "text-primary/60"
        iconBorder = "border-primary/10"
        prefix = "NV"
    }

    if ((isSale || isLedger) && item.pos_session) {
        Icon = Monitor
    }

    const itemNumber = item.display_id || (item.number ? (item.number.toString().includes(prefix) ? item.number : `${prefix}-${item.number}`) : '---')
    const itemName = item.customer_name || item.supplier_name || item.partner_name || item.name || '---'
    const displayTotal = isLedger ? (item.balance || item.pending_amount || 0) : (item.total || item.effective_total || 0)

    // --- Enrichment Data ---
    const lines = item.lines || item.items || []

    // Invoice badge - find first non-cancelled, non-draft invoice
    const mainInvoice = item.related_documents?.invoices?.find(
        (inv: any) => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && inv.number && inv.number !== 'Draft'
    )

    // Payment progress
    const total = parseFloat(item.total || 0)
    const pending = parseFloat(item.pending_amount || 0)
    const paidPct = total > 0 ? Math.round(((total - pending) / total) * 100) : 0
    const showPaymentProgress = !isLedger && !isWorkOrder && total > 0 && pending > 0

    // Delivery fraction
    const deliveredLines = lines.filter((l: any) =>
        (parseFloat(l.quantity_delivered || l.quantity_received || 0)) >= (parseFloat(l.quantity || 1))
    ).length
    const showDelivery = !isWorkOrder && !isLedger && lines.length > 0

    const handleClick = () => {
        if (onActionClick) {
            onActionClick()
        } else if (onClick) {
            onClick()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
        }
    }

    return (
        <IndustrialCard
            variant="list"
            role="button"
            tabIndex={0}
            aria-selected={isSelected}
            data-state={isSelected ? 'selected' : undefined}
            className={cn(
                "group flex flex-col p-4 relative z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                isSelected && "ring-2 ring-primary/40 bg-primary/5 border-primary/30",
                className
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            {/* ROW 1: Header — Icon + ID + Name + Hub Status + Total + Arrow */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4 min-w-[30%]">
                    <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center border transition-all duration-500 group-hover:scale-105 shrink-0", iconBg, iconColor, iconBorder)}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {itemNumber}
                            </span>
                            <h4 className="font-bold text-foreground line-clamp-1 max-w-[180px]">
                                {itemName}
                            </h4>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatPlainDate(item.date)}
                            </span>
                            {isSale && item.pos_session && (
                                <StatusBadge
                                    status="active"
                                    label={`POS #${item.pos_session}`}
                                    size="sm"
                                    className="h-4 px-1 text-[9px] bg-primary/5 text-primary border-primary/10"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* CENTERED MINI STATES */}
                {!hideStatus && (
                    <div className="flex-1 flex justify-center px-4">
                        {isNote ? (
                            <NoteHubStatus note={item} />
                        ) : isPurchase ? (
                            <PurchaseOrderHubStatus order={item} />
                        ) : isWorkOrder ? (
                            <StatusBadge status={item.status} size="sm" />
                        ) : (
                            <OrderHubStatus order={item} />
                        )}
                    </div>
                )}

                <div className="flex items-center gap-6">
                    <div className="text-right min-w-[100px]">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                            Total
                        </div>
                        <MoneyDisplay
                            amount={displayTotal}
                            showColor={!isLedger}
                            className={cn("text-sm", isLedger && "text-destructive dark:text-destructive")}
                        />
                    </div>

                    <ArrowRight className="h-5 w-5 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>

            {/* ROW 2: Product Lines — Full list, multiline */}
            {lines.length > 0 && !isWorkOrder && (
                <div className="mt-2.5 pt-2 border-t border-border/30">
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
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
                </div>
            )}

            {/* ROW 3: Context Bar — Invoice + Payment Progress + Delivery */}
            {(mainInvoice || showPaymentProgress || showDelivery) && (
                <div className="mt-2 pt-2 border-t border-border/20 flex items-center gap-4 flex-wrap">
                    {/* Invoice Badge */}
                    {mainInvoice && (
                        <div className="flex items-center gap-1.5">
                            <Receipt className="h-3 w-3 text-success/70" />
                            <span className="text-[10px] font-bold text-success/90">
                                {mainInvoice.display_id || mainInvoice.number}
                            </span>
                        </div>
                    )}

                    {/* Payment Progress: pending amount + bar */}
                    {showPaymentProgress && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-medium">
                                Pendiente:
                            </span>
                            <MoneyDisplay
                                amount={pending}
                                showColor={false}
                                className="text-[10px] font-bold text-warning"
                            />
                            <div className="w-12 h-1.5 rounded-full bg-muted/50 overflow-hidden border border-border/20">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        paidPct >= 100 ? "bg-success" : paidPct > 50 ? "bg-primary" : "bg-warning"
                                    )}
                                    style={{ width: `${Math.min(paidPct, 100)}%` }}
                                />
                            </div>
                            <span className="text-[9px] text-muted-foreground/60 font-mono">{paidPct}%</span>
                        </div>
                    )}

                    {/* Delivery Fraction */}
                    {showDelivery && (
                        <div className="flex items-center gap-1.5">
                            <Package className="h-3 w-3 text-muted-foreground/50" />
                            <span className={cn(
                                "text-[10px] font-medium",
                                deliveredLines === lines.length ? "text-success/80" : "text-muted-foreground/70"
                            )}>
                                {deliveredLines}/{lines.length} desp.
                            </span>
                        </div>
                    )}
                </div>
            )}
        </IndustrialCard>
    )
}
