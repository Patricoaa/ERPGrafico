"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface SheetCloseButtonProps {
    onClick: () => void
    className?: string
    /** Accessibility label */
    label?: string
    /** Whether to show a tooltip on hover */
    showTooltip?: boolean
    /** Custom tooltip text (defaults to label) */
    tooltipText?: string
}

/**
 * Standardized close button for Sheets, Modals and Panels.
 * Implements a circular ghost style with optional tooltip support.
 */
export function SheetCloseButton({
    onClick,
    className,
    label = "Cerrar",
    showTooltip = false,
    tooltipText
}: SheetCloseButtonProps) {
    const button = (
        <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            type="button"
            className={cn(
                "rounded-full h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200",
                className
            )}
        >
            <X className="h-4 w-4" />
            <span className="sr-only">{label}</span>
        </Button>
    )

    if (showTooltip) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {button}
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                    {tooltipText || label}
                </TooltipContent>
            </Tooltip>
        )
    }

    return button
}
