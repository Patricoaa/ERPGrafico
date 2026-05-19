import React from 'react'
import { LucideIcon } from 'lucide-react'
import { SheetCloseButton } from '@/components/shared/SheetCloseButton'
import { cn } from '@/lib/utils'

export interface PanelHeaderProps {
    title: React.ReactNode
    description?: React.ReactNode
    icon: LucideIcon
    onClose?: () => void
    closeTooltipText?: string
    className?: string
}

export function PanelHeader({
    title,
    description,
    icon: Icon,
    onClose,
    closeTooltipText = "Cerrar Panel",
    className
}: PanelHeaderProps) {
    return (
        <div className={cn("flex items-start justify-between px-6 py-6 bg-transparent border-b border-border/10 shrink-0", className)}>
            <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center justify-center bg-primary/10 rounded-lg h-10 w-10 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0 justify-center">
                    <h2 className="font-heading font-black text-sm text-foreground leading-none truncate">
                        {title}
                    </h2>
                    {description && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium leading-none truncate">
                            {description}
                        </div>
                    )}
                </div>
            </div>
            {onClose && (
                <div className="flex items-start shrink-0 ml-4">
                    <SheetCloseButton onClick={onClose} showTooltip tooltipText={closeTooltipText} />
                </div>
            )}
        </div>
    )
}
