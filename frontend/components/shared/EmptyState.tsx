"use client"

import React from "react"
import { LucideIcon, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
    /** Icon displayed above the title */
    icon?: LucideIcon
    /** Main message */
    title: string
    /** Optional description below the title */
    description?: string
    /** Optional action element (e.g., a Button) */
    action?: React.ReactNode
    /** Optional className for the container */
    className?: string
}

/**
 * Standardized empty state component for lists, tables, and views.
 * Use this instead of ad-hoc "No hay datos" divs.
 *
 * @example
 * <EmptyState
 *   icon={Package}
 *   title="Sin productos"
 *   description="No se encontraron productos con los filtros seleccionados."
 *   action={<Button onClick={handleReset}>Limpiar filtros</Button>}
 * />
 */
export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-12 px-4 text-center",
                className
            )}
        >
            <div className="rounded-full bg-muted/50 p-4 mb-4">
                <Icon className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground normal-case tracking-normal mb-1">
                {title}
            </h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
