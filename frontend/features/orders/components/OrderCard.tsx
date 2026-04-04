"use client"

import React from "react"
import { Calendar, ArrowRight, ArrowLeft, ShoppingCart, Package, Monitor, FileBadge, Wand2 } from "lucide-react"
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
    isHubOpen?: boolean
    className?: string
}

export function OrderCard({ item, type, onClick, onActionClick, hideStatus = false, isSelected = false, isHubOpen = false, className }: OrderCardProps) {
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

    const total = parseFloat(item.total || 0)
    const pending = parseFloat(item.pending_amount || 0)
    const hasPending = !isLedger && !isWorkOrder && total > 0 && pending > 0

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
            data-order-card="true"
            aria-selected={isSelected}
            data-state={isSelected ? 'selected' : undefined}
            className={cn(
                "group flex flex-col p-4 relative z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 transition-all duration-300",
                // SEAMLESS INTEGRATION WITH HUB DOCK
                isSelected && isHubOpen && "rounded-r-none border-r-transparent z-[30] !bg-background",
                // NO SCALE SHIFT - ONLY OPACITY/GRAYSCALE FOR FOCUS
                !isSelected && isHubOpen && "opacity-40 grayscale-[0.2] blur-[0.2px]",
                className
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            {/* ROW 1: Header — Icon + ID + Name + Hub Status + Total + Arrow */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4 min-w-[30%]">
                    <div className={cn("w-12 h-12 rounded flex flex-col items-center justify-center border transition-all duration-500 group-hover:scale-105 shrink-0", iconBg, iconColor, iconBorder)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-heading font-extrabold text-base text-foreground line-clamp-1 max-w-[200px] tracking-tight">
                                {itemName}
                            </h4>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1 text-[11px] font-medium text-muted-foreground">
                            <span className="font-mono font-semibold text-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded-md">
                                {itemNumber}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 opacity-70" />
                                {formatPlainDate(item.date)}
                            </span>
                            {isSale && item.pos_session && (
                                <span className="flex items-center gap-1 text-primary bg-primary/5 px-1.5 py-0.5 rounded-md">
                                    <Monitor className="h-3 w-3" />
                                    #{item.pos_session}
                                </span>
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

                <div className="flex items-center gap-5">
                    <div className="flex flex-col items-end min-w-[100px]">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-extrabold mb-0.5">
                            Total
                        </span>
                        <MoneyDisplay
                            amount={displayTotal}
                            showColor={!isLedger}
                            className={cn("text-base font-heading font-bold tracking-tight", isLedger && "text-destructive dark:text-destructive")}
                        />
                    </div>

                    {isHubOpen && isSelected ? (
                        <ArrowLeft className="h-5 w-5 text-primary animate-in fade-in slide-in-from-right-1 duration-300" />
                    ) : (
                        <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    )}
                </div>
            </div>

            {/* ROW 2: Product Lines — Full list, multiline */}
            {(lines.length > 0 || hasPending) && !isWorkOrder && (
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

                    {hasPending && (
                        <div className="flex items-center gap-5 shrink-0 pl-4">
                            <div className="flex flex-col items-end min-w-[100px]">
                                <span className="text-[9px] text-warning/80 uppercase tracking-widest font-extrabold mb-0.5">
                                    Pendiente
                                </span>
                                <MoneyDisplay
                                    amount={pending}
                                    showColor={false}
                                    className="text-sm font-heading font-bold tracking-tight text-warning"
                                />
                            </div>
                            <div className="w-5" /> {/* Empty spacer to align with arrow in row 1 */}
                        </div>
                    )}
                </div>
            )}


        </IndustrialCard>
    )
}
