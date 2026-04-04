"use client"

import React from "react"
import { Calendar, ArrowRight, ShoppingCart, Package, Monitor, FileBadge, Wand2 } from "lucide-react"
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
    className?: string
}

export function OrderCard({ item, type, onClick, onActionClick, hideStatus = false, className }: OrderCardProps) {
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

    const handleClick = () => {
        if (onActionClick) {
            onActionClick()
        } else if (onClick) {
            onClick()
        }
    }

    return (
        <IndustrialCard
            variant="list"
            className={cn(
                "group flex flex-row items-center justify-between p-4 relative z-10",
                className
            )}
            onClick={handleClick}
        >
            <div className="flex items-center gap-4 min-w-[30%]">
                <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center border transition-all duration-500 group-hover:scale-105", iconBg, iconColor, iconBorder)}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {itemNumber}
                        </span>
                        <h4 className="font-bold text-foreground line-clamp-1 max-w-[150px]">
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
                        {item.warehouse_name && (
                            <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {item.warehouse_name}
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
        </IndustrialCard>
    )
}
