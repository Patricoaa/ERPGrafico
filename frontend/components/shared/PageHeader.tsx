"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
    title: string
    description?: string
    titleActions?: React.ReactNode // For buttons next to the title
    children?: React.ReactNode // For actions/buttons on the right
    className?: string
}

/**
 * Reusable Page Header component for consistent titles and descriptions.
 * Supports an optional action area on the right and actions next to the title.
 */
export function PageHeader({ title, description, titleActions, children, className }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 py-2", className)}>
            <div className="space-y-1">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
                    {titleActions && (
                        <div className="flex items-center pt-1">
                            {titleActions}
                        </div>
                    )}
                </div>
                {description && (
                    <p className="text-muted-foreground text-sm md:text-base">
                        {description}
                    </p>
                )}
            </div>
            {children && (
                <div className="flex items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    )
}

interface PageHeaderButtonProps extends React.ComponentProps<typeof Button> {
    icon?: LucideIcon
    label?: string
    circular?: boolean
}

/**
 * A consistent button for the PageHeader.
 * Supports a "circular" variant for icon-only buttons.
 */
export function PageHeaderButton({ icon: Icon, label, circular, className, ...props }: PageHeaderButtonProps) {
    return (
        <Button
            className={cn(
                circular ? "rounded-full aspect-square p-0 w-10 h-10" : "rounded-lg px-4",
                className
            )}
            {...props}
        >
            {Icon && <Icon className={cn("h-4 w-4", label ? "mr-2" : "")} />}
            {label && <span>{label}</span>}
        </Button>
    )
}
