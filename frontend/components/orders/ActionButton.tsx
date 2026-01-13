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
}

export function ActionButton({
    action,
    order,
    onClick,
    showBadge = true,
    className
}: ActionButtonProps) {
    const Icon = action.icon
    const badgeCount = getActionBadgeCount(action, order)
    const badge = action.badge

    return (
        <Button
            variant={action.variant || "outline"}
            onClick={onClick}
            className={cn(
                "w-full justify-start text-left font-medium h-auto py-2 px-3 transition-all duration-200 group",
                action.variant === 'destructive' ? 'hover:bg-destructive/10' : 'hover:border-primary/50 hover:bg-primary/5',
                className
            )}
        >
            <div className="flex items-center gap-2.5 w-full overflow-hidden">
                <div className={cn(
                    "p-1.5 rounded-md shrink-0 transition-colors",
                    action.variant === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                )}>
                    <Icon className="h-3.5 w-3.5" />
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-xs">{action.label}</span>
                    {action.description && (
                        <span className="text-[9px] text-muted-foreground font-normal truncate">
                            {action.description}
                        </span>
                    )}
                </div>

                {showBadge && (badgeCount !== undefined || badge) && (
                    <Badge
                        variant={badge?.type as any || "secondary"}
                        className="ml-auto text-[10px] h-5 px-1.5"
                    >
                        {badgeCount !== undefined ? badgeCount : badge?.label}
                    </Badge>
                )}
            </div>
        </Button>
    )
}
