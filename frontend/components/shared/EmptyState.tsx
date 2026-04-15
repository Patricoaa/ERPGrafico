"use client"
import React from "react"
import { LucideIcon, Inbox, SearchX, Receipt, Package, Users, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { IndustryMark } from "@/components/shared/IndustryMark"

export type EmptyStateContext = 'search' | 'inventory' | 'finance' | 'users' | 'generic' | 'database' | 'production'
export type EmptyStateVariant = 'full' | 'compact' | 'minimal'

interface EmptyStateProps {
    /** Override the default context icon */
    icon?: LucideIcon
    /** Main message (auto-generated if not provided and context is set) */
    title?: string
    /** Detailed description */
    description?: string
    /** Semantic context for the empty state */
    context?: EmptyStateContext
    /** Visual density variant */
    variant?: EmptyStateVariant
    /** Dynamic entity name for personalized messages (e.g., "Orden #123") */
    entityName?: string
    /** Primary Action (Right/Bottom) */
    action?: React.ReactNode
    /** Secondary Action (Left/Top) */
    secondaryAction?: React.ReactNode
    /** Custom container classes */
    className?: string
}

const CONTEXT_CONFIG: Record<EmptyStateContext, { icon: LucideIcon; title: string }> = {
    generic: { icon: Inbox, title: "Sin datos disponibles" },
    search: { icon: SearchX, title: "Sin resultados encontrados" },
    inventory: { icon: Package, title: "Sin productos en inventario" },
    finance: { icon: Receipt, title: "Sin movimientos registrados" },
    users: { icon: Users, title: "Sin contactos o usuarios" },
    database: { icon: Database, title: "Error de conexión o base vacía" },
    production: { icon: Package, title: "Sin órdenes o procesos activos" },
}

/**
 * Standardized Industrial Empty State
 * 
 * Follows the "Industrial Premium" aesthetic:
 * - Typography: font-heading (Syne) + uppercase + extrabold
 * - Palette: muted-foreground / subtle borders
 * - Layouts: full, compact, minimal
 */
export function EmptyState({
    icon,
    title,
    description,
    context = 'generic',
    variant = 'full',
    entityName,
    action,
    secondaryAction,
    className,
}: EmptyStateProps) {
    const config = CONTEXT_CONFIG[context] || CONTEXT_CONFIG.generic
    const Icon = icon || config.icon
    const displayTitle = title || (entityName ? `No hay ${config.title.toLowerCase()} para ${entityName}` : config.title)

    if (variant === 'minimal') {
        return (
            <div className={cn("flex items-center gap-3 py-4 px-2 text-muted-foreground", className)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-heading font-black uppercase tracking-wider">{displayTitle}</span>
                {action && <div className="ml-auto">{action}</div>}
            </div>
        )
    }

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500",
                variant === 'full' ? "py-16 px-8" : "py-8 px-4",
                className
            )}
        >
            {/* Precision Icon Container */}
            <div className={cn(
                "relative flex items-center justify-center rounded-none border border-border/40 bg-muted/10 mb-6",
                variant === 'full' ? "h-20 w-20" : "h-14 w-14"
            )}>
                {/* Decorative corners */}
                <IndustryMark 
                    positions={['top-left', 'bottom-right']} 
                    active 
                    className="opacity-40" 
                />
                
                <Icon className={cn(
                    "text-muted-foreground/40",
                    variant === 'full' ? "h-10 w-10" : "h-6 w-6"
                )} />
            </div>

            {/* Content Section */}
            <div className="max-w-md space-y-2">
                <h3 className={cn(
                    "font-heading font-black uppercase tracking-tighter text-foreground/90",
                    variant === 'full' ? "text-lg" : "text-sm"
                )}>
                    {displayTitle}
                </h3>
                
                {description && (
                    <p className={cn(
                        "text-muted-foreground leading-relaxed mx-auto",
                        variant === 'full' ? "text-sm max-w-[320px]" : "text-[11px] max-w-[240px]"
                    )}>
                        {description}
                    </p>
                )}
            </div>

            {/* Actions Dock */}
            {(action || secondaryAction) && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                    {secondaryAction}
                    {action}
                </div>
            )}
        </div>
    )
}
