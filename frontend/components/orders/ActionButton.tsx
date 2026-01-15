"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Action } from "@/types/actions"
import { getActionBadgeCount } from "@/lib/actions/utils"
import { cn } from "@/lib/utils"

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

    return (
        <Button
            variant={ghost ? "ghost" : (action.variant || "outline")}
            onClick={onClick}
            className={cn(
                "w-full justify-start text-left font-medium transition-all duration-200 group h-auto",
                compact ? "py-1.5 px-2" : "py-2 px-3",
                ghost ? "hover:bg-transparent border-none shadow-none !text-black" : (action.variant === 'destructive' ? 'hover:bg-destructive/10' : 'hover:border-primary/50 hover:bg-primary/5'),
                className
            )}
        >
            <div className="flex items-center gap-2 w-full overflow-hidden">
                <div className={cn(
                    "rounded-md shrink-0 transition-colors flex items-center justify-center",
                    compact ? "p-1 h-6 w-6" : "p-1.5 h-8 w-8",
                    ghost ? "bg-transparent !text-black" : (action.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground')
                )}>
                    <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", ghost ? "" : "transition-transform duration-200 group-hover:-translate-x-0.5")} />
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                    <span className={cn(
                        "leading-tight block",
                        compact ? "text-[10px]" : "text-xs",
                        ghost && "!text-black font-black uppercase tracking-tighter"
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
}
