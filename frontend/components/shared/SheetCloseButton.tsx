"use client"

import React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SheetCloseButtonProps {
    onClick: () => void
    className?: string
    /** Accessibility label */
    label?: string
}

/**
 * Standardized close button for Sheets and Modals.
 * Implements the circular ghost style.
 */
export function SheetCloseButton({
    onClick,
    className,
    label = "Cerrar"
}: SheetCloseButtonProps) {
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className={cn(
                "rounded-full h-8 w-8 text-muted-foreground hover:bg-muted transition-all duration-200",
                className
            )}
        >
            <X className="h-4 w-4" />
            <span className="sr-only">{label}</span>
        </Button>
    )
}
