import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { ActionCategory } from "../ActionCategory"
import { Eye, Settings2, CheckCircle2, PlayCircle, MinusCircle, XCircle, ChevronDown } from "lucide-react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useState, useEffect, useId } from "react"

interface PhaseCardProps {
    title: string
    icon: any
    children?: React.ReactNode
    actions: any[]
    order: any
    userPermissions: string[]
    onActionSuccess?: () => void
    variant?: 'success' | 'active' | 'neutral' | 'destructive'
    documents?: any[]
    onViewDetail?: (docType: string, id: number | string) => void
    emptyMessage?: string
    showDocProgress?: boolean
    stageId?: string
    isComplete?: boolean
    posSessionId?: number | null
    isTimeline?: boolean
    onModalChange?: (isOpen: boolean) => void
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
            setInternalOpen(controlledOpen)
        }
    }, [controlledOpen])

    const toggleOpen = () => {
        if (!collapsible) return
        const nextOpen = !open
        setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen)
    }

    const variantStyles: Record<string, string> = {
        success: 'border-success/40 bg-success/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]',
        active: 'border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]',
        neutral: 'border-white/10 bg-white/5',
        destructive: 'border-destructive/40 bg-destructive/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
    }

    const iconStyles: Record<string, string> = {
        success: 'bg-success/20 text-success',
        active: 'bg-primary/20 text-primary',
        neutral: 'bg-white/10 text-muted-foreground',
        destructive: 'bg-destructive/20 text-destructive'
    }

    // Separate actions into primary (closing) and secondary
    const categorizedActions = (() => {
        const filtered = actions?.filter((action: any) => {
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
        const secondary = filtered.filter((a: any) => secondaryIds.some(id => a.id.toLowerCase().includes(id)))
        const primary = filtered.filter((a: any) => !secondaryIds.some(id => a.id.toLowerCase().includes(id)))

        return { primary, secondary }
    })()

    // Collapsed summary for accordion mode
    const collapsedDocCount = documents.length
    const collapsedActionCount = categorizedActions.primary.length

    return (
        <Card className={cn(
            "flex flex-col transition-all duration-500 border rounded-2xl relative overflow-hidden backdrop-blur-md group/card flex-shrink-0",
            (variantStyles[variant] || variantStyles.neutral),
            "hover:translate-y-[-1px] hover:shadow-xl hover:border-primary/30 shadow-md min-h-[auto] bg-background",
            isSuccess && "animate-in fade-in zoom-in-95 duration-700"
        )}>
            {/* Premium Glow Effect */}
            <div className="absolute -inset-px bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Background Gradient for Success */}
            {isSuccess && (
                <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent pointer-events-none" />
            )}

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
                    "border-b border-white/10 flex items-center shrink-0 transition-all",
                    "bg-white/5 p-3 px-4 gap-3",
                    collapsible && "cursor-pointer hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset select-none",
                    collapsible && !open && "border-b-0"
                )}
            >
                <div className={cn(
                    "p-1 shadow-inner transition-transform duration-500 group-hover/card:scale-110",
                    iconStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')],
                    "p-2 flex items-center justify-center rounded h-9 w-9 shrink-0 shadow-sm border border-white/5"
                )}>
                    <div className="relative flex items-center justify-center w-full h-full">
                        <Icon className="h-5 w-5 opacity-90" />

                        {/* Mini Status Badge */}
                        <div className={cn(
                            "absolute -top-2 -right-2 rounded-sm bg-background border shadow-sm",
                            isSuccess && "text-success border-success/30",
                            isActive && "text-primary border-primary/30",
                            variant === 'destructive' && "text-destructive border-destructive/30",
                            variant === 'neutral' && !isActive && !isSuccess && "text-muted-foreground border-muted-foreground/30"
                        )}>
                            {isSuccess && <CheckCircle2 className="size-3.5 bg-success/10 rounded-sm" />}
                            {isActive && <PlayCircle className="size-3.5 bg-primary/10 rounded-sm" />}
                            {variant === 'destructive' && <XCircle className="size-3.5 bg-destructive/10 rounded-sm" />}
                            {variant === 'neutral' && !isActive && !isSuccess && <MinusCircle className="size-3.5 bg-muted/10 rounded-sm" />}
                        </div>
                    </div>
                </div>
                <div className="flex-1">
                    <h3 className={cn(
                        "font-heading font-black uppercase tracking-widest text-foreground leading-none",
                        "text-[10px]"
                    )}>
                        {title}
                    </h3>
                    {/* Collapsed summary — visible only when collapsed */}
                    {collapsible && !open && (
                        <p className="text-[9px] text-muted-foreground/60 mt-1 tracking-wide">
                            {collapsedDocCount > 0 && `${collapsedDocCount} doc${collapsedDocCount > 1 ? 's' : ''}`}
                            {collapsedDocCount > 0 && collapsedActionCount > 0 && ' · '}
                            {collapsedActionCount > 0 && `${collapsedActionCount} acción${collapsedActionCount > 1 ? 'es' : ''}`}
                            {collapsedDocCount === 0 && collapsedActionCount === 0 && emptyMessage}
                        </p>
                    )}
                </div>

                {/* Header Action Icons */}
                <div className="flex items-center gap-1.5">
                    {categorizedActions.secondary.filter((a: any) =>
                        ['create-note', 'create-credit-note', 'create-debit-note', 'payment-history'].includes(a.id)
                    ).map((action: any, idx: number) => {
                        const disabled = action.isDisabled?.(order) || false
                        let tooltipText = action.label
                        if (disabled && action.disabledTooltip) {
                            tooltipText = typeof action.disabledTooltip === 'function'
                                ? action.disabledTooltip(order)
                                : action.disabledTooltip
                        }

                        return (
                            <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                    <div className={disabled ? "cursor-not-allowed opacity-50" : ""}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={disabled}
                                            className={cn(
                                                "h-7 w-7 rounded transition-all active:scale-90 border border-white/10 shadow-sm",
                                                "bg-white/5 hover:bg-white/10",
                                                (action.id.includes('note')) && "text-warning bg-warning/5 border-warning/20 hover:bg-warning/10 hover:border-warning/40",
                                                action.id === 'payment-history' && "text-primary bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40",
                                                disabled && "pointer-events-none"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                console.log(`[PhaseCard] Triggering global action: ${action.id}`);
                                                triggerAction(action.id);
                                            }}
                                        >
                                            <action.icon className="h-4 w-4" />
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
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 text-muted-foreground/50 transition-transform duration-300 shrink-0",
                            open && "rotate-180"
                        )}
                        aria-hidden="true"
                    />
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
                <div className="overflow-hidden">
                    <CardContent className={cn(
                        "flex-1 flex flex-col relative z-10 font-sans",
                        "p-4 px-5 gap-3"
                    )}>
                        {/* Documents List */}
                        <div className={cn("w-full", "space-y-2")}>
                            {documents.length > 0 ? (
                                documents.map((doc: any, i: number) => (
                                    <div key={i} className={cn(
                                        "flex items-center justify-between bg-muted/5 border-border/40 hover:bg-muted/10 transition-all duration-300 group/doc",
                                        "rounded-2xl border min-h-[2.5rem] py-2 px-3 shadow-sm",
                                        doc.status === 'CANCELLED' && "opacity-50 grayscale contrast-75 bg-muted0/5 cursor-not-allowed",
                                        doc.isWarning && "bg-warning/5 border-warning/20 hover:bg-warning/15"
                                    )}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={cn(
                                                "flex items-center justify-center bg-background rounded-sm border border-border/20 shadow-sm shrink-0",
                                                "h-8 w-8"
                                            )}>
                                                <doc.icon className="text-primary/80 h-4 w-4" />
                                            </div>
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
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-slate-400 text-muted-foreground font-bold uppercase">Anulada</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-0.5 opacity-20 group-hover/doc:opacity-100 transition-opacity">
                                            {doc.actions?.map((action: any, idx: number) => (
                                                <Button
                                                    key={idx}
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn("rounded", action.color, action.isPrimary && "animate-[pulse-glow_2s_infinite] bg-primary/10", "h-8 w-8")}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        action.onClick();
                                                    }}
                                                    title={action.title}
                                                >
                                                    <action.icon className="h-4 w-4" />
                                                </Button>
                                            ))}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn("text-muted-foreground hover:text-primary hover:bg-primary/20 rounded", "h-8 w-8")}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    if (!doc.disabled) onViewDetail?.(doc.docType, doc.id);
                                                }}
                                                disabled={doc.disabled}
                                                title="Ver Detalles"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-2 border border-dashed border-border/20 rounded-2xl bg-muted/5">
                                    <span className="text-[8px] text-muted-foreground/30 font-black uppercase tracking-widest">{emptyMessage}</span>
                                </div>
                            )}
                        </div>

                        {/* Visual Support Container */}
                        {children && (
                            <div className={cn(
                                "flex-1 flex flex-col justify-center",
                                "my-2 px-1 text-[12px]"
                            )}>
                                {children}
                            </div>
                        )}

                        {/* Actions Section */}
                        <div className="mt-auto">
                            {!isSuccess && categorizedActions.primary.length > 0 && (
                                <ActionCategory
                                    category={{ actions: categorizedActions.primary } as any}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    layout="grid"
                                    compact={true}
                                    showBadge={false}
                                    posSessionId={posSessionId}
                                />
                            )}

                            {isSuccess && (
                                <div className="flex flex-col items-center justify-center py-2 opacity-30">
                                    <Settings2 className="h-3 w-3 text-muted-foreground mb-1" />
                                    <span className="text-[7px] text-muted-foreground font-black uppercase tracking-widest">Etapa Completada</span>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    {/* Bottom Ghost Actions */}
                    {categorizedActions.secondary.filter((a: any) =>
                        !['create-note', 'create-credit-note', 'create-debit-note', 'payment-history'].includes(a.id)
                    ).length > 0 && (
                            <div className="pb-1 px-4">
                                <ActionCategory
                                    category={{
                                        actions: categorizedActions.secondary.filter((a: any) =>
                                            !['create-note', 'create-credit-note', 'create-debit-note', 'payment-history'].includes(a.id)
                                        )
                                    } as any}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    layout="flex"
                                    compact={true}
                                    ghost={true}
                                    showBadge={false}
                                    posSessionId={posSessionId}
                                />
                            </div>
                        )}
                </div>
            </div>
        </Card>
    )
}
