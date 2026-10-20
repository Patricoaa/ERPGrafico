"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface WizardSummarySidebarProps {
    /** Header zone: progress bar, type badge, reference label, etc. */
    header?: ReactNode
    /** Scrollable body: product list, attribute rows, impact info, etc. */
    body?: ReactNode
    /** Sticky footer: totals summary */
    footer?: ReactNode
    className?: string
    /** Width class override. Defaults to 'w-80' */
    width?: string
    /**
     * Which edge the sidebar sits on. Drives the separator border.
     * Defaults to 'left' (border on the right edge, next to the content).
     */
    side?: "left" | "right"
    /** Extra classes for the scrollable body container */
    scrollAreaClassName?: string
}

export function WizardSummarySidebar({
    header,
    body,
    footer,
    className,
    width = "w-80",
    side = "left",
    scrollAreaClassName,
}: WizardSummarySidebarProps) {
    return (
        <div className={cn(
            "bg-transparent flex flex-col h-full overflow-hidden",
            side === "right" ? "border-l" : "border-r",
            width,
            className
        )}>
            {header && (
                <div className="p-6 border-b bg-transparent flex-shrink-0">
                    {header}
                </div>
            )}

            {body && (
                <div className={cn("flex-1 overflow-y-auto", scrollAreaClassName)}>
                    <div className="p-6 space-y-6">
                        {body}
                    </div>
                </div>
            )}

            {footer && (
                <div className="p-6 bg-transparent border-t mt-auto shadow-[0_-5px_25px_-5px_oklch(0.12_0.02_240_/_0.05)] flex-shrink-0">
                    {footer}
                </div>
            )}
        </div>
    )
}
