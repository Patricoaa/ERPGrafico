"use client"

import React, { useMemo } from "react"
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
    const Icon = useMemo(() => getEntityIcon(label), [label])
    
    // ─── Identity ─────────────────────────────────────────────────────────────
    const partnerName = getPartnerName(label, data)
    const displayId = data.display_id || formatEntityDisplay(label, data)
    
    // ─── Values ───────────────────────────────────────────────────────────────
    const total = parseFloat(String(data.total || data.effective_total || data.balance || 0))
    const pending = parseFloat(String(data.pending_amount || 0))
    const hasPending = total > 0 && pending > 0

    // ─── Aesthetics ───────────────────────────────────────────────────────────
    let iconColor = "text-primary/60"

    if (label === 'purchasing.purchaseorder' || label === 'inventory.product') {
        iconColor = "text-info/60"
    } else if (label === 'billing.invoice' && ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(data.dte_type)) {
        iconColor = "text-warning/60"
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
                        {React.createElement(Icon, { className: cn("h-5 w-5 shrink-0", iconColor) })}
                        <div className="flex flex-col min-w-0">
                            {visibleColumns?.partner_name !== false && (
                                <span className="font-heading font-extrabold text-base text-foreground truncate leading-tight">
                                    {partnerName}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60 flex-wrap leading-tight">
                                <span>{displayId}</span>
                                <span className="text-muted-foreground/20">·</span>
                                {visibleColumns?.date !== false && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 opacity-50" />
                                        {formatPlainDate(data.date)}
                                    </span>
                                )}
                                {label === 'sales.saleorder' && data.pos_session && (
                                    <span className="flex items-center gap-1 text-primary bg-primary/5 px-1.5 py-0.5 rounded-md">
                                        <Monitor className="h-3 w-3" />
                                        #{data.pos_session}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                }
                subtitle={undefined}
                trailing={
                    <div className="flex items-center gap-4">
                        {visibleColumns?.status !== false && (
                            <div className="hidden sm:flex items-center gap-3">
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

            {/* ROW 2: Product Lines & Totals */}
            {(data.lines || data.items || []).length > 0 && (
                <EntityCard.Body className="flex items-start justify-between gap-4 pt-2 border-t border-border/30 mt-1">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 flex-1">
                        {(data.lines || data.items || []).map((line: any, idx: number) => (
                            <span key={idx} className="text-sm text-foreground/70 flex items-center gap-1.5">
                                <span className="font-medium text-foreground">
                                    {Math.round(parseFloat(line.quantity || 0))}
                                </span>
                                <span className="text-muted-foreground/40">×</span>
                                <span className="text-foreground/70 truncate max-w-[240px]">
                                    {line.product_name || line.description || 'Producto'}
                                </span>
                            </span>
                        ))}
                    </div>

                    {visibleColumns?.total !== false && (
                        <div className="flex items-start gap-4 shrink-0">
                            {hasPending && visibleColumns?.payment_status !== false && (
                                <div className="flex flex-col items-end min-w-[80px]">
                                    <span className="text-[9px] text-warning/80 uppercase tracking-widest font-extrabold mb-0.5">
                                        Pendiente
                                    </span>
                                    <MoneyDisplay
                                        amount={pending}
                                        showColor={false}
                                        className="text-sm font-heading font-semibold tracking-tight text-warning"
                                    />
                                </div>
                            )}
                            <div className="flex flex-col items-end min-w-[80px]">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-extrabold mb-0.5">
                                    Total
                                </span>
                                <MoneyDisplay
                                    amount={total}
                                    showColor={false}
                                    className="text-sm font-heading font-semibold tracking-tight"
                                />
                            </div>
                        </div>
                    )}
                </EntityCard.Body>
            )}
        </EntityCard>
    )
}
