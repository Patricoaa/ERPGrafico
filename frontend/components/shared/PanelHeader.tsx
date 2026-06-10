"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { SheetCloseButton } from '@/components/shared'

// ──────────────────────────────────────────
// Shared props for both BaseModal and Drawer
// ──────────────────────────────────────────

export interface PanelBaseProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode
    title: string | React.ReactNode
    subtitle?: string | React.ReactNode
    description?: string | React.ReactNode
    headerActions?: React.ReactNode
    children?: React.ReactNode
    footer?: React.ReactNode
    className?: string
    contentClassName?: string
    headerClassName?: string
    footerClassName?: string
    titleClassName?: string
    descriptionClassName?: string
}

// ──────────────────────────────────────────
// PanelHeader — visual layout, no Radix deps
// ──────────────────────────────────────────

export interface PanelHeaderProps {
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode
    title: React.ReactNode
    subtitle?: React.ReactNode
    description?: React.ReactNode
    headerActions?: React.ReactNode
    className?: string
    titleClassName?: string
    descriptionClassName?: string
    /** If provided, renders a close button at the right side */
    onClose?: () => void
    /** Tooltip text for the close button (defaults to "Cerrar") */
    closeTooltip?: string
    /** ClassName for the close button (e.g. to match title color) */
    closeButtonClassName?: string
}

export function PanelHeader({
    icon,
    title,
    subtitle,
    description,
    headerActions,
    className,
    titleClassName,
    descriptionClassName,
    onClose,
    closeTooltip,
    closeButtonClassName,
}: PanelHeaderProps) {
    const resolvedIcon = React.isValidElement(icon)
        ? icon
        : icon && React.createElement(icon as React.ComponentType<{ className?: string }>, { className: "h-8 w-8" })

    return (
        <div className={cn("flex items-center justify-between gap-4 w-full", className)}>
            <div className="flex flex-row items-center gap-4 min-w-0 flex-1">
                {resolvedIcon && (
                    <div className="flex-shrink-0">
                        {resolvedIcon}
                    </div>
                )}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className={cn("min-w-0 truncate", titleClassName)}>
                        {title}
                    </div>
                    {(subtitle || description) && (
                        <div className={cn("min-w-0 truncate", descriptionClassName)}>
                            {subtitle || description}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {headerActions}
                {onClose && (
                    <SheetCloseButton
                        onClick={onClose}
                        showTooltip
                        tooltipText={closeTooltip}
                        className={cn("text-foreground hover:text-foreground", closeButtonClassName)}
                    />
                )}
            </div>
        </div>
    )
}
