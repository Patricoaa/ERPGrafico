"use client"

import { useMemo } from "react"
import { Calendar, ArrowRight, ArrowLeft, Monitor, GitBranch, type LucideIcon } from "lucide-react"
import { cn, formatPlainDate } from "@/lib/utils"
import { MoneyDisplay } from "./MoneyDisplay"
import { EntityCard } from "./EntityCard"
import { DomainHubStatus } from "./HubStatus"
import { getEntityIcon, formatEntityDisplay, getPartnerName } from "@/lib/entity-registry"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

interface DomainCardProps {
    label: string
    data: object
    onClick?: () => void
    onActionClick?: () => void
    isSelected?: boolean
    isHubOpen?: boolean
    className?: string
    visibleColumns?: Record<string, boolean>
    /** Whether it is being used in a detail view header */
    isDetailView?: boolean
    /** Image URL — renders an <img> in the icon slot, taking precedence over icon */
    imageSrc?: string
    /** Override the auto-derived entity icon */
    icon?: LucideIcon
    /** Override the auto-derived icon container styling */
    iconClassName?: string
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
    isDetailView = false,
    imageSrc,
    icon: iconOverride,
    iconClassName: iconClassNameOverride
}: DomainCardProps) {
    const { openHub } = useHubPanel()
    const Icon = useMemo(() => iconOverride ?? getEntityIcon(label), [label, iconOverride])
    
    // ─── Identity ─────────────────────────────────────────────────────────────
    const d = data as { display_id?: string; total?: number; effective_total?: number; balance?: number; pending_amount?: number; date?: string; pos_session?: number; dte_type?: string; lines?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>>; adjustments?: Array<Record<string, unknown>>; work_orders?: Array<Record<string, unknown>>; [key: string]: unknown }
    const partnerName = getPartnerName(label, d)
    const displayId = d.display_id || formatEntityDisplay(label, d)
    
    // ─── Values ───────────────────────────────────────────────────────────────
    const total = parseFloat(String(d.total || d.effective_total || d.balance || 0))
    const pending = parseFloat(String(d.pending_amount || 0))
    const hasPending = total > 0 && pending > 0

    // ─── Aesthetics ───────────────────────────────────────────────────────────
    let iconClassName = "bg-muted"

    if (label === 'purchasing.purchaseorder' || label === 'inventory.product') {
        iconClassName = "text-info bg-info/10"
    } else if (label === 'billing.invoice' && ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(d.dte_type ?? '')) {
        iconClassName = "text-warning bg-warning/10"
    }

    if (iconClassNameOverride) iconClassName = iconClassNameOverride

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
                isHubOpen && isSelected && "accent-visible",
                !isSelected && isHubOpen && "opacity-40 grayscale-[0.2] blur-[0.2px]",
                isDetailView && "cursor-default shadow-card",
                className
            )}
        >
            <EntityCard.Header
                imageSrc={imageSrc}
                icon={imageSrc ? undefined : Icon}
                iconClassName={iconClassName}
                title={visibleColumns?.partner_name !== false ? partnerName : undefined}
                subtitle={
                    <span className="flex items-center gap-1.5 flex-wrap">
                        <span>{displayId}</span>
                        <span className="text-muted-foreground/20">·</span>
                        {visibleColumns?.date !== false && (
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 opacity-50" />
                                {formatPlainDate(d.date)}
                            </span>
                        )}
                        {label === 'sales.saleorder' && d.pos_session && (
                            <span className="flex items-center gap-1 text-primary bg-primary/5 px-1.5 py-0.5 rounded-md">
                                <Monitor className="h-3 w-3" />
                                #{d.pos_session}
                            </span>
                        )}
                    </span>
                }
                trailing={
                    <div className="flex items-center gap-4">
                        {visibleColumns?.status !== false && (
                            <div className="hidden sm:flex items-center gap-3">
                                {label === 'billing.invoice' && d.adjustments && d.adjustments.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        {d.adjustments?.map((adj) => {
                                            const adjId = adj.id as number | undefined
                                            return (
                                            <span 
                                                key={adjId}
                                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/5 text-primary border border-primary/10 cursor-pointer hover:bg-primary/10"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openHub({ invoiceId: adjId, type: 'sale' })
                                                }}
                                            >
                                                <GitBranch className="h-3 w-3" />
                                                {formatEntityDisplay(label, adj)}
                                            </span>
                                        )
                                    })}
                                    </div>
                                )}
                                <DomainHubStatus label={label} data={d} />
                            </div>
                        )}

                        {!isDetailView && (
                            isHubOpen && isSelected ? (
                                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                            ) : (
                                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100" />
                            )
                        )}
                    </div>
                }
            />

            {/* ROW 2: Product Lines & Totals */}
            {(d.lines || d.items || []).length > 0 && (
                <EntityCard.Body className="flex items-start justify-between gap-4 pt-2 border-t border-border/30 mt-1">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 flex-1">
                        {(d.lines || d.items || []).map((raw, idx: number) => {
                            const line = raw as { quantity?: number | string; product_name?: string; description?: string }
                            return (
                            <span key={idx} className="text-sm text-foreground/70 flex items-center gap-1.5">
                                <span className="font-medium text-foreground">
                                    {Math.round(parseFloat(String(line.quantity || 0)))}
                                </span>
                                <span className="text-muted-foreground/40">×</span>
                                <span className="text-foreground/70 truncate max-w-[240px]">
                                    {line.product_name || line.description || 'Producto'}
                                </span>
                            </span>
                            )
                        })}
                    </div>

                    {visibleColumns?.total !== false && (
                        <div className={cn("flex items-start gap-4 shrink-0", !isDetailView && "pr-9")}>
                            {hasPending && visibleColumns?.payment_status !== false && (
                                <div className="flex flex-col items-end min-w-[80px]">
                                    <span className="text-[9px] text-warning/80 uppercase tracking-widest font-extrabold mb-0.5">
                                        Pendiente
                                    </span>
                                    <MoneyDisplay
                                        amount={pending}
                                        showColor={false}
                                        className="text-sm font-heading tracking-tight text-warning"
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
                                    className="text-sm font-heading tracking-tight"
                                />
                            </div>
                        </div>
                    )}
                </EntityCard.Body>
            )}
        </EntityCard>
    )
}
