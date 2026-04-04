"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Action } from "@/types/actions"
import { getActionBadgeCount } from "@/lib/actions/utils"
import { cn } from "@/lib/utils"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ActionButtonProps {
    action: Action
    order: any
    userPermissions: string[]
    onClick: () => void
    showBadge?: boolean
    className?: string
    compact?: boolean
    ghost?: boolean
}

export function ActionButton({
    action,
    order,
    onClick,
    showBadge = true,
    className,
    compact = false,
    ghost = false
}: ActionButtonProps) {
    const Icon = action.icon
    const badgeCount = getActionBadgeCount(action, order)
    const badge = action.badge
    const isDisabled = action.isDisabled?.(order) || false

    const buttonElement = (
        <Button
            variant={ghost ? "ghost" : (action.variant || "outline")}
            onClick={isDisabled ? undefined : onClick}
            disabled={isDisabled}
            className={cn(
                "w-full justify-start text-left font-medium transition-all duration-200 group h-auto rounded",
                compact ? "py-1 px-1.5" : "py-2 px-3",
                ghost ? "hover:bg-black/5 dark:hover:bg-white/5 border-none shadow-none active:scale-[0.98] transition-all duration-200" : (action.variant === 'destructive' ? 'hover:bg-destructive/10' : 'hover:border-primary/50 hover:bg-primary/5 shadow-sm'),
                isDisabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            <div className="flex items-center gap-2 w-full overflow-hidden">
                <div className={cn(
                    "rounded shrink-0 transition-colors flex items-center justify-center border border-transparent",
                    compact ? "p-0.5 h-5 w-5" : "p-1.5 h-8 w-8",
                    ghost ? "bg-transparent" : (action.variant === 'destructive' ? 'bg-destructive/10 text-destructive border-destructive/10' : 'bg-primary/10 text-primary border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary')
                )}>
                    <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", ghost ? "" : "transition-transform duration-200 group-hover:-translate-x-0.5")} />
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                    <span className={cn(
                        "leading-tight block",
                        compact ? "text-[9px]" : "text-xs",
                        ghost ? "font-heading font-extrabold uppercase tracking-widest text-[9px]" : "font-semibold"
                    )} style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                        {action.label}
                    </span>
                    {action.description && !compact && !ghost && (
                        <span className="text-[9px] text-muted-foreground font-normal truncate mt-0.5">
                            {action.description}
                        </span>
                    )}
                </div>

                {showBadge && !ghost && (badgeCount !== undefined || badge) && (
                    <Badge
                        variant={badge?.type as any || "secondary"}
                        className={cn(
                            "ml-auto shrink-0",
                            compact ? "text-[9px] h-4 px-1 min-w-[16px] justify-center" : "text-[10px] h-5 px-1.5"
                        )}
                    >
                        {badgeCount !== undefined ? badgeCount : badge?.label}
                    </Badge>
                )}
            </div>
        </Button>
    )

    if (isDisabled && action.disabledTooltip) {
        const tooltipText = typeof action.disabledTooltip === 'function'
            ? action.disabledTooltip(order)
            : action.disabledTooltip

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="w-full cursor-not-allowed">
                            {buttonElement}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltipText}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return buttonElement
}
