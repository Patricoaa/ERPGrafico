import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Eye, CheckCircle2, ChevronDown } from "lucide-react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useState, useEffect, useId } from "react"
import { Card } from "@/components/ui/card"
import { Order, PhaseDocument } from "../../types"
import { Action } from "@/types/actions"
import { LucideIcon } from "lucide-react"

interface PhaseCardProps {
    title: string
    icon: LucideIcon
    children?: React.ReactNode
    actions: Action<Order>[]
    order: Order
    userPermissions: string[]
    onActionSuccess?: () => void
    variant?: 'success' | 'active' | 'neutral' | 'destructive'
    documents?: PhaseDocument[]
    onViewDetail?: (docType: string, id: number | string) => void
    emptyMessage?: string
    showDocProgress?: boolean
    stageId?: string
    isComplete?: boolean
    posSessionId?: number | null
    isTimeline?: boolean
    onModalChange?: (isOpen: boolean) => void
    className?: string
    // Accordion props
    collapsible?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export function PhaseCard({
    title,
    icon: Icon,
    children,
    actions,
    order,
    userPermissions,
    onActionSuccess,
    variant = 'neutral',
    documents = [],
    onViewDetail,
    emptyMessage = "No disponible",
    showDocProgress = false,
    stageId = '',
    isComplete = false,
    posSessionId = null,
    isTimeline = false,
    onModalChange = () => { },
    className,
    // Accordion props
    collapsible = false,
    isOpen: controlledOpen,
    onOpenChange,
}: PhaseCardProps) {
    const { triggerAction } = useHubPanel()
    const isSuccess = variant === 'success' || isComplete
    const isActive = variant === 'active'

    // Internal open state for accordion (used only when collapsible=true)
    const [internalOpen, setInternalOpen] = useState(true)
    const open = collapsible ? (controlledOpen ?? internalOpen) : true
    const contentId = useId()
    const triggerId = useId()

    // Sync with controlled prop
    useEffect(() => {
        if (controlledOpen !== undefined) {
            requestAnimationFrame(() => setInternalOpen(controlledOpen))
        }
    }, [controlledOpen])

    const toggleOpen = () => {
        if (!collapsible) return
        const nextOpen = !open
        setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen)
    }

    const iconStyles: Record<string, string> = {
        success: 'text-success',
        active: 'text-primary',
        neutral: 'text-muted-foreground',
        destructive: 'text-destructive'
    }

    // Separate actions into primary (closing) and secondary
    const categorizedActions = (() => {
        const filtered = actions?.filter((action: Action<Order>) => {
            if (action.requiredPermissions && !action.requiredPermissions.some((p: string) => userPermissions.includes(p))) {
                return false
            }
            if (action.excludedStatus && action.excludedStatus.includes(order?.status)) {
                return false
            }
            if (action.checkAvailability) {
                if (!order) return false
                if (!action.checkAvailability(order)) return false
            }
            return true
        }) || []

        const secondaryIds = ['history', 'note', 'view-']
        const secondary = filtered.filter((a: Action<Order>) => secondaryIds.some(id => a.id.toLowerCase().includes(id)))
        const primary = filtered.filter((a: Action<Order>) => !secondaryIds.some(id => a.id.toLowerCase().includes(id)))

        return { primary, secondary }
    })()

    return (
        <Card className={cn(
            "flex flex-col transition-all duration-300 relative group/card border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md rounded-md overflow-hidden py-2 gap-2",
            isSuccess && "opacity-80 grayscale-[0.3] hover:opacity-100 hover:grayscale-0",
            isActive && "border-primary/30 bg-primary/5 shadow-primary/5",
            className
        )}>


            {/* HEADER — Clickable when collapsible */}
            <div
                role={collapsible ? "button" : undefined}
                tabIndex={collapsible ? 0 : undefined}
                id={triggerId}
                aria-expanded={collapsible ? open : undefined}
                aria-controls={collapsible ? contentId : undefined}
                onClick={collapsible ? toggleOpen : undefined}
                onKeyDown={collapsible ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleOpen()
                    }
                } : undefined}
                className={cn(
                    "flex items-center shrink-0 transition-all",
                    "px-3 h-12 gap-2",
                    collapsible && "cursor-pointer select-none"
                )}
            >
                <div className={cn(
                    "transition-all duration-300",
                    "p-1 flex items-center justify-center rounded-md h-7 w-7 shrink-0 border border-border/50 bg-muted/50 shadow-sm shadow-black/5"
                )}>
                    <div className="relative flex items-center justify-center w-full h-full">
                        <Icon className={cn("h-4 w-4", iconStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')])} />

                        {/* Mini Status Badge - Simplified to a Small Dot */}
                        <div className={cn(
                            "absolute -top-1 -right-1 h-2 w-2 rounded-full border shadow-sm",
                            isSuccess && "bg-success border-background",
                            isActive && "bg-primary border-background",
                            variant === 'destructive' && "bg-destructive border-background",
                            variant === 'neutral' && !isActive && !isSuccess && "bg-muted-foreground border-background"
                        )} />
                    </div>
                </div>
                <div className="flex-1 flex items-center gap-2">
                    <h3 className={cn(
                        "font-heading font-black uppercase tracking-[0.2em] text-foreground leading-none",
                        "text-[11.5px]"
                    )}>
                        {title}
                    </h3>
                    {isSuccess && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    )}
                </div>

                {/* Unified Action Icons — Primary + Shortcuts */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Primary actions — prominent style */}
                    {!isSuccess && categorizedActions.primary.map((action: Action<Order>, idx: number) => {
                        const disabled = action.isDisabled?.(order) || false
                        let tooltipText = action.label
                        if (disabled && action.disabledTooltip) {
                            tooltipText = typeof action.disabledTooltip === 'function'
                                ? action.disabledTooltip(order)
                                : action.disabledTooltip
                        }

                        return (
                            <Tooltip key={`p-${idx}`}>
                                <TooltipTrigger asChild>
                                    <div className={disabled ? "cursor-not-allowed opacity-50" : ""}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={disabled}
                                            className={cn(
                                                "h-7 w-7 rounded transition-all active:scale-90",
                                                "border-2 border-primary/40 bg-primary/10 text-primary",
                                                "hover:bg-primary/20 hover:border-primary/60",
                                                action.variant === 'destructive' && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/60",
                                                disabled && "pointer-events-none"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                triggerAction(action.id);
                                            }}
                                        >
                                            <action.icon className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{tooltipText}</p>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}

                    {/* Separator between primary and secondary if both exist */}
                    {!isSuccess && categorizedActions.primary.length > 0 && categorizedActions.secondary.length > 0 && (
                        <div className="h-4 w-[1px] bg-border/20 mx-0.5" />
                    )}

                    {/* Secondary/shortcut actions — ghost style */}
                    {categorizedActions.secondary.map((action: Action<Order>, idx: number) => {
                        const disabled = action.isDisabled?.(order) || false
                        let tooltipText = action.label
                        if (disabled && action.disabledTooltip) {
                            tooltipText = typeof action.disabledTooltip === 'function'
                                ? action.disabledTooltip(order)
                                : action.disabledTooltip
                        }

                        return (
                            <Tooltip key={`s-${idx}`}>
                                <TooltipTrigger asChild>
                                    <div className={disabled ? "cursor-not-allowed opacity-50" : ""}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={disabled}
                                            className={cn(
                                                "h-7 w-7 rounded transition-all active:scale-90 border border-white/5",
                                                "bg-transparent hover:bg-white/5",
                                                (action.id.includes('note')) && "text-warning border-warning/20 hover:bg-warning/10 hover:border-warning/40",
                                                action.id === 'payment-history' && "text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/40",
                                                disabled && "pointer-events-none"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                triggerAction(action.id);
                                            }}
                                        >
                                            <action.icon className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{tooltipText}</p>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>

                {/* Chevron for Accordion */}
                {collapsible && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <ChevronDown
                                className={cn(
                                    "h-4 w-4 text-muted-foreground/50 transition-transform duration-300 shrink-0",
                                    open && "rotate-180"
                                )}
                                aria-hidden="true"
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{open ? 'Contraer' : 'Expandir'}</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* COLLAPSIBLE CONTENT — CSS grid-rows animation */}
            <div
                id={contentId}
                role={collapsible ? "region" : undefined}
                aria-labelledby={collapsible ? triggerId : undefined}
                className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden min-h-0">
                    <div className={cn(
                        "flex flex-col relative z-10 font-sans p-2 px-4 gap-2"
                    )}>
                        {/* Documents List */}
                        <div className={cn("w-full", "space-y-1.5")}>
                            {documents.length > 0 ? (
                                documents.map((doc: PhaseDocument, i: number) => (
                                    <div key={i} className={cn(
                                        "flex items-center justify-between border-border/30 hover:bg-white/5 transition-all duration-300 group/doc",
                                        "rounded-md border-2 min-h-[2.25rem] py-1.5 px-3",
                                        doc.status === 'CANCELLED' && "opacity-50 grayscale contrast-75 cursor-not-allowed",
                                        doc.isWarning && "border-warning/40 hover:bg-warning/5"
                                    )}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="flex flex-col overflow-hidden">
                                                <div className="flex flex-col justify-center">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{doc.type}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "font-black text-foreground/90 truncate",
                                                            "text-[13px] max-w-full"
                                                        )} title={doc.number}>
                                                            {doc.number}
                                                        </span>
                                                        {doc.status === 'CANCELLED' && (
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-muted-foreground/30 text-muted-foreground font-bold uppercase">Anulada</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-0.5 opacity-20 group-hover/doc:opacity-100 transition-opacity">
                                            {doc.actions?.map((action: { title: string, icon: LucideIcon, onClick: () => void, color?: string, isPrimary?: boolean }, idx: number) => (
                                                <Tooltip key={idx}>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn("rounded", action.color, action.isPrimary && "animate-[pulse-glow_2s_infinite] bg-primary/10", "h-7 w-7")}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                action.onClick();
                                                            }}
                                                        >
                                                            <action.icon className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{action.title}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn("text-muted-foreground hover:text-primary hover:bg-primary/20 rounded", "h-7 w-7")}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            if (!doc.disabled) onViewDetail?.(doc.docType, doc.id);
                                                        }}
                                                        disabled={doc.disabled}
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Ver Detalles</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-1.5 border border-dashed border-border/10 rounded-md">
                                    <span className="text-[9px] text-muted-foreground/30 font-black uppercase tracking-widest">{emptyMessage}</span>
                                </div>
                            )}
                        </div>

                        {/* Visual Support Container */}
                        {children && (
                            <div className={cn(
                                "flex-1 flex flex-col justify-center",
                                "px-1 text-[12px]"
                            )}>
                                {children}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    )
}
