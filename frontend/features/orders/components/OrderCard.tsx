"use client"

import React from "react"
import { Calendar, ArrowRight, ArrowLeft, ShoppingCart, Package, Monitor, FileBadge, Wand2 } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { OrderHubStatus } from "./OrderHubStatus"
import { NoteHubStatus } from "./NoteHubStatus"
import { PurchaseOrderHubStatus } from "./PurchaseOrderHubStatus"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { EntityCard } from "@/components/shared/EntityCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Order, OrderLine } from "../types"

interface OrderCardProps {
    item: Order
    type: 'sale' | 'purchase' | 'work_order' | 'note' | 'ledger'
    onClick?: () => void
    onActionClick?: () => void
    hideStatus?: boolean
    isSelected?: boolean
    isHubOpen?: boolean
    className?: string
    visibleColumns?: Record<string, boolean>
}

export function OrderCard({ item, type, onClick, onActionClick, hideStatus = false, isSelected = false, isHubOpen = false, className, visibleColumns }: OrderCardProps) {
    const isSale = type === 'sale'
    const isNote = type === 'note'
    const isPurchase = type === 'purchase' || (isNote && ((item as unknown as Record<string, unknown>).purchase_order || (item as unknown as Record<string, unknown>).purchase_order_id || item.supplier_name))
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
        iconColor = "text-info/60"
        iconBorder = "border-primary/20/10"
        prefix = "OCS"
    } else if (isWorkOrder) {
        Icon = Wand2
        iconBg = "bg-primary/5"
        iconColor = "text-primary/60"
        iconBorder = "border-primary/20/10"
        prefix = "OT"
    } else if (isNote) {
        Icon = FileBadge
        iconBg = "bg-warning/5"
        iconColor = "text-warning/60"
        iconBorder = "border-warning/10"
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

    const itemNumber = item.display_id || (item.number ? (String(item.number).includes(prefix) ? item.number : `${prefix}-${item.number}`) : '---')
    const itemName = (typeof item.customer_name === 'object' ? (item.customer_name as any)?.name : item.customer_name) || item.supplier_name || item.partner_name || item.name || '---'
    const displayTotal = isLedger ? (Number(item.balance || 0) || Number(item.pending_amount || 0) || 0) : (Number(item.total || 0) || Number(item.effective_total || 0) || 0)

    // --- Enrichment Data ---
    const lines = item.lines || item.items || []

    const total = parseFloat(String(item.total || 0))
    const pending = parseFloat(String(item.pending_amount || 0))
    const hasPending = !isLedger && !isWorkOrder && total > 0 && pending > 0

    const handleClick = () => {
        if (onActionClick) {
            onActionClick()
        } else if (onClick) {
            onClick()
        }
    }

    return (
        <EntityCard
            isSelected={isSelected && isHubOpen}
            onClick={handleClick}
            className={cn(
                // Hub de-emphasis: greyed out when hub open but not selected
                !isSelected && isHubOpen && "opacity-40 grayscale-[0.2] blur-[0.2px]",
                className
            )}
        >
            <EntityCard.Header
                title={
                    <div className="flex items-center gap-3">
                        {/* Document icon */}
                        <div className={cn(
                            "w-10 h-10 rounded flex flex-col items-center justify-center border transition-all duration-500 group-hover:scale-105 shrink-0",
                            iconBg, iconColor, iconBorder
                        )}>
                            <Icon className="h-4 w-4" />
                        </div>
                        {/* Entity name */}
                        {(visibleColumns?.customer_name !== false && visibleColumns?.partner_name !== false) && (
                            <span className="font-heading font-extrabold text-base text-foreground line-clamp-1 max-w-[240px] tracking-tight">
                                {itemName}
                            </span>
                        )}
                    </div>
                }
                subtitle={
                    <div className="flex items-center gap-2.5 text-[11px] font-medium text-muted-foreground pl-[52px]">
                        <span className="font-mono font-semibold text-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded-md">
                            {itemNumber}
                        </span>
                        {visibleColumns?.date !== false && (
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 opacity-70" />
                                {formatPlainDate(item.date)}
                            </span>
                        )}
                        {isSale && item.pos_session && (
                            <span className="flex items-center gap-1 text-primary bg-primary/5 px-1.5 py-0.5 rounded-md">
                                <Monitor className="h-3 w-3" />
                                #{item.pos_session}
                            </span>
                        )}
                    </div>
                }
                trailing={
                    <div className="flex items-center gap-5">
                        {/* Hub status — centered between left and right */}
                        {!hideStatus && visibleColumns?.status !== false && (
                            <div className="hidden sm:flex flex-1 justify-center px-4">
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

                        {/* Total amount */}
                        {visibleColumns?.total !== false && (
                            <div className="flex flex-col items-end min-w-[90px]">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-extrabold mb-0.5">
                                    Total
                                </span>
                                <MoneyDisplay
                                    amount={displayTotal}
                                    showColor={!isLedger}
                                    className={cn("text-base font-heading font-bold tracking-tight", isLedger && "text-destructive dark:text-destructive")}
                                />
                            </div>
                        )}

                        {/* Arrow indicator */}
                        {isHubOpen && isSelected ? (
                            <ArrowLeft className="h-5 w-5 text-primary animate-in fade-in slide-in-from-right-1 duration-300" />
                        ) : (
                            <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        )}
                    </div>
                }
            />

            {/* ROW 2: Product Lines & Pending Amount */}
            {(lines.length > 0 || hasPending) && !isWorkOrder && (
                <EntityCard.Body className="flex items-start justify-between gap-4 pt-2 border-t border-border/30 mt-1">
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 flex-1">
                        {lines.map((line: OrderLine, idx: number) => (
                            <span key={idx} className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                <span className="font-semibold text-foreground/70">
                                    {Math.round(parseFloat(line.quantity as string || '0'))}
                                </span>
                                <span className="text-muted-foreground/50">×</span>
                                <span className="truncate max-w-[200px]">
                                    {line.product_name || line.description || 'Producto'}
                                </span>
                            </span>
                        ))}
                    </div>

                    {hasPending && visibleColumns?.payment_status !== false && (
                        <div className="flex flex-col items-end min-w-[90px] shrink-0">
                            <span className="text-[9px] text-warning/80 uppercase tracking-widest font-extrabold mb-0.5">
                                Pendiente
                            </span>
                            <MoneyDisplay
                                amount={pending}
                                showColor={false}
                                className="text-sm font-heading font-bold tracking-tight text-warning"
                            />
                        </div>
                    )}
                </EntityCard.Body>
            )}
        </EntityCard>
    )
}
