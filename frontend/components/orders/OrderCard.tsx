"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ArrowRight, ShoppingCart, Package, Monitor, FileBadge, Wand2, Truck } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { OrderHubStatus } from "./OrderHubStatus"
import { NoteHubStatus } from "./NoteHubStatus"
import { PurchaseOrderHubStatus } from "./PurchaseOrderHubStatus"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"

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
    const isPurchase = type === 'purchase'
    const isWorkOrder = type === 'work_order'
    const isNote = type === 'note'
    const isLedger = type === 'ledger'

    // Determine Icon and Colors
    let Icon = ShoppingCart
    let iconBg = "bg-primary/5"
    let iconColor = "text-primary/60"
    let iconBorder = "border-primary/10"
    let prefix = "NV"

    if (isPurchase) {
        Icon = Package
        iconBg = "bg-indigo-500/5"
        iconColor = "text-indigo-500/60"
        iconBorder = "border-indigo-500/10"
        prefix = "OCS"
    } else if (isWorkOrder) {
        Icon = Wand2
        iconBg = "bg-purple-500/5"
        iconColor = "text-purple-500/60"
        iconBorder = "border-purple-500/10"
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
    const originalTotal = item.total || item.effective_total || displayTotal

    return (
        <div
            className={cn(
                "group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer",
                className
            )}
            onClick={onClick}
        >
            <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center border", iconBg, iconColor, iconBorder)}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {itemNumber}
                        </span>
                        <h4 className="font-bold text-foreground">
                            {itemName}
                        </h4>
                        {isSale && item.pos_session && (
                            <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary border-primary/20">
                                POS #{item.pos_session}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatPlainDate(item.date)}
                        </span>
                        {item.warehouse_name && (
                            <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {item.warehouse_name}
                            </span>
                        )}
                        {isLedger && item.pending_amount && parseFloat(item.pending_amount) > 0 && (
                            <Badge variant="destructive" className="h-4 text-[9px] px-1 font-bold">
                                PENDIENTE
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {!hideStatus && (
                    <div className="hidden sm:flex flex-col items-end">
                        {isSale || isLedger ? (
                            <OrderHubStatus order={item} />
                        ) : isPurchase ? (
                            <PurchaseOrderHubStatus order={item} />
                        ) : isNote ? (
                            <NoteHubStatus note={item} />
                        ) : isWorkOrder ? (
                            <Badge variant={item.status === 'COMPLETED' ? 'success' : 'outline'} className="text-[10px]">
                                {item.status}
                            </Badge>
                        ) : null}
                    </div>
                )}

                <div className="text-right min-w-[120px]">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        {isLedger ? 'Saldo Pendiente' : 'Total'}
                    </div>
                    <MoneyDisplay 
                        amount={displayTotal} 
                        showColor={!isLedger} 
                        className={cn("text-sm", isLedger && "text-red-600 dark:text-red-400")}
                    />
                    {isLedger && originalTotal !== displayTotal && (
                        <div className="text-[10px] text-muted-foreground line-through opacity-50">
                            <MoneyDisplay 
                                amount={originalTotal} 
                                showColor={false} 
                                className="font-medium"
                            />
                        </div>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="group-hover:translate-x-1 transition-transform"
                    onClick={(e) => {
                        if (onActionClick) {
                            e.stopPropagation()
                            onActionClick()
                        }
                    }}
                >
                    <ArrowRight className="h-5 w-5 text-primary" />
                </Button>
            </div>
        </div>
    )
}
