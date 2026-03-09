import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { ActionCategory } from "../ActionCategory"
import { Eye, Settings2 } from "lucide-react"

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
    actionEngineRef?: any
    showDocProgress?: boolean
    stageId?: string
    isComplete?: boolean
    posSessionId?: number | null
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
    actionEngineRef,
    showDocProgress = false,
    stageId = '',
    isComplete = false,
    posSessionId = null
}: PhaseCardProps) {
    const isSuccess = variant === 'success' || isComplete
    const isActive = variant === 'active'

    const variantStyles: Record<string, string> = {
        success: 'border-green-500/40 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]',
        active: 'border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]',
        neutral: 'border-white/10 bg-white/5',
        destructive: 'border-red-500/40 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
    }

    const iconStyles: Record<string, string> = {
        success: 'bg-green-500/20 text-green-400',
        active: 'bg-primary/20 text-primary',
        neutral: 'bg-white/10 text-muted-foreground',
        destructive: 'bg-red-500/20 text-red-500'
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

    return (
        <Card className={cn(
            "flex flex-col h-full transition-all duration-500 border-2 rounded-3xl relative overflow-hidden backdrop-blur-sm group/card bg-transparent",
            variantStyles[variant] || variantStyles.neutral,
            "hover:translate-y-[-4px] hover:shadow-2xl hover:border-white/20 shadow-none",
            isSuccess && "animate-in fade-in zoom-in-95 duration-700"
        )}>
            {/* Background Gradient for Success */}
            {isSuccess && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent pointer-events-none" />
            )}

            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
                <div className={cn("p-2 rounded-xl shadow-inner transition-transform duration-500 group-hover/card:scale-110", iconStyles[isSuccess ? 'success' : (isActive ? 'active' : 'neutral')])}>
                    {isSuccess ? <div className="relative">
                        <Icon className="h-4 w-4" />
                        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full border-2 border-background">
                            <svg className="w-2 h-2 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div> : <Icon className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                    <h3 className="font-black text-[12px] uppercase tracking-widest text-foreground/90 leading-none">
                        {title}
                    </h3>
                </div>

                {/* Header Action Icons (Replacing status dots) */}
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
                                        {/* Wrapped in div to allow tooltip on disabled button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={disabled}
                                            className={cn(
                                                "h-8 w-8 rounded-full transition-all active:scale-90 border border-white/10 shadow-sm",
                                                "bg-white/5 hover:bg-white/10",
                                                (action.id.includes('note')) && "text-orange-500 bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/40",
                                                action.id === 'payment-history' && "text-primary bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40",
                                                disabled && "pointer-events-none"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                console.log(`[PhaseCard] Header button clicked: ${action.id}`);
                                                actionEngineRef?.current?.handleActionClick(action.id);
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
            </div>

            <CardContent className="p-5 flex-1 flex flex-col gap-4 relative z-10">
                {/* Documents List - Uniform Row Style */}
                <div className="space-y-2 min-h-[40px]">
                    {documents.length > 0 ? (
                        documents.map((doc: any, i: number) => (
                            <div key={i} className={cn(
                                "flex items-center justify-between p-2.5 bg-muted/5 rounded-2xl border border-border/40 hover:bg-muted/10 transition-all duration-300 group/doc h-12",
                                doc.status === 'CANCELLED' && "opacity-50 grayscale contrast-75 bg-slate-500/5 cursor-not-allowed"
                            )}>
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="h-8 w-8 flex items-center justify-center bg-background rounded-xl border border-border/20 shadow-sm shrink-0">
                                        <doc.icon className="h-4 w-4 text-primary/80" />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-black text-foreground/90 truncate max-w-[120px]" title={doc.number}>
                                                {doc.number}
                                            </span>
                                            {doc.status === 'CANCELLED' && (
                                                <Badge variant="outline" className="text-[7px] h-3 px-1 border-slate-400 text-slate-500 font-bold uppercase">Anulada</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-0.5 opacity-20 group-hover/doc:opacity-100 transition-opacity">
                                    {doc.actions?.map((action: any, idx: number) => (
                                        <Button
                                            key={idx}
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-7 w-7 rounded-lg", action.color, action.isPrimary && "animate-[pulse-glow_2s_infinite] bg-primary/10")}
                                            onClick={(e) => { e.stopPropagation(); action.onClick() }}
                                            title={action.title}
                                        >
                                            <action.icon className="h-4 w-4" />
                                        </Button>
                                    ))}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/20 rounded-lg"
                                        onClick={() => !doc.disabled && onViewDetail?.(doc.docType, doc.id)}
                                        disabled={doc.disabled}
                                        title="Ver Detalles"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-4 border border-dashed border-border/20 rounded-2xl bg-muted/5">
                            <span className="text-[9px] text-muted-foreground/30 font-black uppercase tracking-widest">{emptyMessage}</span>
                        </div>
                    )}
                </div>

                {/* Visual Support Container - FLAT */}
                <div className="flex-1 flex flex-col justify-center min-h-[100px]">
                    {children}
                </div>

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

            {/* Bottom Ghost Actions - Centered and Borderless - FLAT */}
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
        </Card>
    )
}
