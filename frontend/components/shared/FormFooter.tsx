"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface FormFooterProps {
    /** Main action buttons (e.g., Save, Cancel) - Right aligned */
    actions: React.ReactNode
    /** Extra actions (e.g., Delete, Void) - Left aligned */
    leftActions?: React.ReactNode
    /** Additional classes for the container */
    className?: string
}

/**
 * FormFooter
 * 
 * Standardized footer layout for forms and modals.
 * Ensures the primary action is on the right and secondary/danger actions are on the left.
 */
export function FormFooter({ actions, leftActions, className }: FormFooterProps) {
    return (
        <div className={cn("flex items-center justify-between w-full gap-4", className)}>
            <div className="flex items-center gap-2">
                {leftActions}
            </div>
            <div className="flex items-center gap-3">
                {actions}
            </div>
        </div>
    )
}
