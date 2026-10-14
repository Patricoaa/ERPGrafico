"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DynamicIcon } from "@/components/shared"
import { Button } from "@/components/ui/button"

/**
 * Fila base del panel de módulo (patrón ERPNext v16, ADR-0079).
 * Se renderiza como `Link` (href), `button` (onClick) o cabecera de grupo (`expanded`).
 */
interface SidebarNavItemProps extends Omit<React.HTMLAttributes<HTMLElement>, "onClick"> {
    label: string
    href?: string
    onClick?: React.MouseEventHandler<HTMLElement>
    icon?: LucideIcon
    iconName?: string
    isActive?: boolean
    /** Sangría de sub-ítems (0 = raíz). Los sub-ítems no muestran ícono. */
    depth?: number
    /** Si está definido, la fila es cabecera de grupo colapsable. */
    expanded?: boolean
    /** Contenido a la derecha (badge, contador…). */
    trailing?: React.ReactNode
    className?: string
}

export const SidebarNavItem = React.forwardRef<HTMLElement, SidebarNavItemProps>(function SidebarNavItem(
    { label, href, onClick, icon: Icon, iconName, isActive, depth = 0, expanded, trailing, className, ...rest },
    ref,
) {
    const isGroup = expanded !== undefined
    const showIcon = depth === 0 && (Icon || iconName)

    const classes = cn(
        "group/navitem flex w-full items-center gap-2 h-8 rounded-md px-2 text-sm text-left outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/30",
        depth > 0 && "pl-8 text-foreground/75",
        depth > 1 && "pl-11",
        isActive
            ? "bg-card text-foreground font-medium shadow-card"
            : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
        className,
    )

    const content = (
        <>
            {showIcon && (
                Icon
                    ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    : <DynamicIcon name={iconName ?? ""} className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1 min-w-0 truncate">{label}</span>
            {trailing}
            {isGroup && (
                expanded
                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
        </>
    )

    if (href && !isGroup) {
        return (
            <Link
                ref={ref as React.Ref<HTMLAnchorElement>}
                href={href}
                className={classes}
                onClick={onClick}
                aria-current={isActive ? "page" : undefined}
                {...rest}
            >
                {content}
            </Link>
        )
    }

    return (
        <Button
            ref={ref as React.Ref<HTMLButtonElement>}
            type="button"
            variant="ghost"
            onClick={onClick}
            className={cn(classes, "justify-start font-normal has-[>svg]:px-2", isActive && "font-medium")}
            aria-expanded={isGroup ? expanded : undefined}
            {...rest}
        >
            {content}
        </Button>
    )
})
