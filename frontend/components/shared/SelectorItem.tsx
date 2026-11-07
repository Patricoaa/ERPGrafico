"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface SelectorItemProps {
    /** Leading inline icon, e.g. <Tag className="h-3.5 w-3.5 text-muted-foreground" /> */
    icon?: ReactNode
    /** Inline element before the title on the same row (e.g. an account code chip) */
    prefix?: ReactNode
    /** Main label */
    title: ReactNode
    /** Second-line detail */
    subtitle?: ReactNode
    /** Right-aligned label on the title row (e.g. account type) */
    badge?: ReactNode
    /** Extra trailing slot (e.g. a DataCell.Action button) */
    trailing?: ReactNode
    /** Renders a trailing check with opacity toggle when provided */
    selected?: boolean
}

export function SelectorItem({ icon, prefix, title, subtitle, badge, trailing, selected }: SelectorItemProps) {
    return (
        <>
            {icon && <div className="shrink-0 mr-2 flex items-center">{icon}</div>}
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {prefix && <div className="shrink-0">{prefix}</div>}
                        <span className="font-medium truncate">{title}</span>
                    </div>
                    {badge && <span className="text-xs text-muted-foreground shrink-0">{badge}</span>}
                </div>
                {subtitle && <div className="text-3xs text-muted-foreground truncate">{subtitle}</div>}
            </div>
            {trailing && <div className="ml-2 shrink-0 flex items-center">{trailing}</div>}
            {selected !== undefined && (
                <Check
                    className={cn(
                        "ml-2 h-4 w-4 shrink-0 transition-opacity text-primary",
                        selected ? "opacity-100" : "opacity-0"
                    )}
                />
            )}
        </>
    )
}
