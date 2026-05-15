"use client"

import React from "react"
import { Calendar, ArrowRight, ArrowLeft, Monitor, GitBranch } from "lucide-react"
import { cn, formatPlainDate } from "@/lib/utils"
import { MoneyDisplay } from "./MoneyDisplay"
import { EntityCard } from "./EntityCard"
import { DomainHubStatus } from "./HubStatus"
import { getEntityIcon, formatEntityDisplay, getPartnerName } from "@/lib/entity-registry"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

interface DomainCardProps {
    label: string
    data: any
    onClick?: () => void
    onActionClick?: () => void
    isSelected?: boolean
    isHubOpen?: boolean
    className?: string
    visibleColumns?: Record<string, boolean>
    /** Whether it is being used in a detail view header */
    isDetailView?: boolean
}

/**
 * Universal Domain Card.
 * Eliminates the need for entity-specific cards (OrderCard, InvoiceCard, etc.)
 * by using the ENTITY_REGISTRY and DomainHubStatus.
 */
export function DomainCard({
    label,
    data,
    onClick,
    onActionClick,
    isSelected = false,
    isHubOpen = false,
    className,
    visibleColumns,
    isDetailView = false
}: DomainCardProps) {
    const { openHub } = useHubPanel()
    const Icon = getEntityIcon(label)
    
    // ─── Identity ─────────────────────────────────────────────────────────────
    const partnerName = getPartnerName(label, data)
    const displayId = data.display_id || formatEntityDisplay(label, data)
    
    // ─── Values ───────────────────────────────────────────────────────────────
    const total = parseFloat(String(data.total || data.effective_total || data.balance || 0))
    const pending = parseFloat(String(data.pending_amount || 0))
    const hasPending = total > 0 && pending > 0

    // ─── Aesthetics ───────────────────────────────────────────────────────────
    let iconBg = "bg-primary/5"
    let iconColor = "text-primary/60"
    let iconBorder = "border-primary/10"

    if (label === 'purchasing.purchaseorder' || label === 'inventory.product') {
        iconColor = "text-info/60"
        iconBorder = "border-primary/20"
    } else if (label === 'billing.invoice' && ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(data.dte_type)) {
        iconBg = "bg-warning/5"
        iconColor = "text-warning/60"
        iconBorder = "border-warning/10"
    }

    const handleClick = () => {
        if (isDetailView) return
        if (onActionClick) onActionClick()
        else if (onClick) onClick()
    }

    return (
        <EntityCard
            isSelected={isSelected && (isHubOpen || !isDetailView)}
            onClick={isDetailView ? undefined : handleClick}
            className={cn(
                !isSelected && isHubOpen && "opacity-40 grayscale-[0.2] blur-[0.2px]",
                isDetailView && "cursor-default shadow-sm",
                className
            )}
        >
            <EntityCard.Header
                title={
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded flex flex-col items-center justify-center border transition-all duration-300 group-hover:scale-105 shrink-0",
                            iconBg, iconColor, iconBorder
                        )}>
                            <Icon className="h-4 w-4" />
                        </div>
                        {visibleColumns?.partner_name !== false && (
                            <span className="font-heading font-extrabold text-base text-foreground line-clamp-1 max-w-[240px] tracking-tight">
                                {partnerName}
                            </span>
                        )}
                    </div>
                }
                subtitle={
                    <div className="flex items-center gap-2.5 text-[11px] font-medium text-muted-foreground flex-wrap pl-[52px]">
                        <span className="font-mono font-semibold text-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded-md">
                            {displayId}
                        </span>
                        {visibleColumns?.date !== false && (
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 opacity-70" />
                                {formatPlainDate(data.date)}
                            </span>
                        )}
                        {/* Domain Extra: POS Session */}
                        {label === 'sales.saleorder' && data.pos_session && (
                            <span className="flex items-center gap-1 text-primary bg-primary/5 px-1.5 py-0.5 rounded-md">
                                <Monitor className="h-3 w-3" />
                                #{data.pos_session}
                            </span>
                        )}
                    </div>
                }
                trailing={
                    <div className="flex items-center gap-4">
                        {/* Status Hub */}
                        {visibleColumns?.status !== false && (
                            <div className="hidden sm:flex items-center gap-3">
                                {/* Domain Extra: Invoice Adjustments Links */}
                                {label === 'billing.invoice' && data.adjustments && data.adjustments.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        {data.adjustments.map((adj: any) => (
                                            <span 
                                                key={adj.id}
                                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/5 text-primary border border-primary/10 cursor-pointer hover:bg-primary/10"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openHub({ invoiceId: adj.id, type: 'sale' })
                                                }}
                                            >
                                                <GitBranch className="h-3 w-3" />
                                                {formatEntityDisplay(label, adj)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <DomainHubStatus label={label} data={data} />
                            </div>
                        )}

                        {/* Total */}
                        {visibleColumns?.total !== false && (
                            <div className="flex flex-col items-end min-w-[90px]">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-extrabold mb-0.5">
                                    Total
                                </span>
                                <MoneyDisplay
                                    amount={total}
                                    showColor={false}
                                    className="text-base font-heading font-bold tracking-tight"
                                />
                            </div>
                        )}

                        {!isDetailView && (
                            isHubOpen && isSelected ? (
                                <ArrowLeft className="h-5 w-5 text-primary animate-in fade-in slide-in-from-right-1 duration-300" />
                            ) : (
                                <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            )
                        )}
                    </div>
                }
            />

            {/* ROW 2: Product Lines & Pending Amount */}
            {((data.lines || data.items || []).length > 0 || hasPending) && (
                <EntityCard.Body className="flex items-start justify-between gap-4 pt-2 border-t border-border/30 mt-1">
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 flex-1">
                        {(data.lines || data.items || []).map((line: any, idx: number) => (
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
