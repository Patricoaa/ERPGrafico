"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface RailNavItem {
    value: string
    label: string
    icon?: LucideIcon
    badge?: number | string
}

export interface RailNavSection {
    label?: string
    items: RailNavItem[]
}

export interface RailNavProps {
    sections: RailNavSection[]
    value: string
    onValueChange: (value: string) => void
    ariaLabel: string
    /** Slot above the navigation (e.g. an entity selector). Hidden on narrow rails. */
    top?: ReactNode
    /** Slot below the navigation (e.g. granularity control). Hidden on narrow rails. */
    bottom?: ReactNode
    className?: string
}

/** Active/inactive surface shared by every rail item. Color of the text is left to the caller. */
export function railItemSurfaceClass(isActive: boolean): string {
    return isActive ? "bg-card shadow-card" : "hover:bg-foreground/5"
}

/** Surface + default text colors for a labelled rail item. */
export function railItemClass(isActive: boolean): string {
    return cn(
        railItemSurfaceClass(isActive),
        isActive ? "font-medium text-foreground" : "text-foreground/80 hover:text-foreground",
    )
}

/**
 * Left navigation rail (selection state, not routing). Collapses to icons-only below `sm`.
 * Extracted from the profile settings sidebar.
 */
export function RailNav({ sections, value, onValueChange, ariaLabel, top, bottom, className }: RailNavProps) {
    return (
        <div className={cn("flex h-full min-h-0 flex-col bg-background px-1.5 py-5 sm:px-4", className)}>
            {top && <div className="mb-4 hidden shrink-0 sm:block">{top}</div>}
            <nav aria-label={ariaLabel} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto custom-scrollbar">
                {sections.map((section, index) => (
                    <section key={section.label ?? index} className="flex flex-col gap-0.5">
                        {section.label && (
                            <h2 className="hidden px-2 pb-1.5 text-xs font-semibold text-foreground sm:block">
                                {section.label}
                            </h2>
                        )}
                        {section.items.map(({ label, value: itemValue, icon: Icon, badge }) => {
                            const isActive = value === itemValue
                            return (
                                <Button
                                    type="button"
                                    key={itemValue}
                                    variant="ghost"
                                    aria-label={label}
                                    aria-current={isActive ? "page" : undefined}
                                    title={label}
                                    onClick={() => onValueChange(itemValue)}
                                    className={cn(
                                        "h-control-sm w-full justify-start gap-2 rounded-sm px-2 text-left text-xs font-normal transition-colors",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                                        railItemClass(isActive),
                                    )}
                                >
                                    {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                                    <span className="hidden truncate sm:inline">{label}</span>
                                    {badge !== undefined && badge !== null && (
                                        <span className="ml-auto hidden rounded-full bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground sm:inline">
                                            {badge}
                                        </span>
                                    )}
                                </Button>
                            )
                        })}
                    </section>
                ))}
            </nav>
            {bottom && <div className="mt-4 hidden shrink-0 border-t border-border/50 pt-3 sm:block">{bottom}</div>}
        </div>
    )
}
