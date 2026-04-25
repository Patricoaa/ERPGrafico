"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

interface FormSectionProps {
    title: string
    icon?: LucideIcon | React.ElementType
    className?: string
}

/**
 * FormSection
 * 
 * Standardized section separator for ERPGrafico forms.
 * Implements the Level 1 Hierarchy: 11px, Black weight, 0.25em tracking.
 */
export function FormSection({ title, icon: Icon, className }: FormSectionProps) {
    return (
        <div className={cn("flex items-center gap-4 pt-4 pb-1 select-none", className)}>
            <div className="flex-1 h-px bg-border/40" />
            <div className="flex items-center gap-2.5">
                {Icon && (
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                )}
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/70 whitespace-nowrap">
                    {title}
                </span>
            </div>
            <div className="flex-1 h-px bg-border/40" />
        </div>
    )
}
