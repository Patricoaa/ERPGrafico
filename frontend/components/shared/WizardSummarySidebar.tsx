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
}

export function WizardSummarySidebar({ header, body, footer, className, width = "w-80" }: WizardSummarySidebarProps) {
    return (
        <div className={cn("border-r bg-transparent flex flex-col h-full overflow-hidden", width, className)}>
            {header && (
                <div className="p-6 border-b bg-transparent flex-shrink-0">
                    {header}
                </div>
            )}

            {body && (
                <div className="flex-1 overflow-y-auto">
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
