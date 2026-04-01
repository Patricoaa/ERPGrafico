"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Centralized status → color mapping using semantic tokens.
 * Add new statuses here instead of hardcoding colors in each module.
 */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    // Lifecycle
    draft: { label: "Borrador", className: "bg-muted text-muted-foreground border-muted" },
    active: { label: "Activo", className: "bg-success/10 text-success border-success/20" },
    inactive: { label: "Inactivo", className: "bg-muted text-muted-foreground border-muted" },

    // Progress
    pending: { label: "Pendiente", className: "bg-warning/10 text-warning border-warning/20" },
    in_progress: { label: "En Proceso", className: "bg-info/10 text-info border-info/20" },
    completed: { label: "Completado", className: "bg-success/10 text-success border-success/20" },

    // Approval
    approved: { label: "Aprobado", className: "bg-success/10 text-success border-success/20" },
    rejected: { label: "Rechazado", className: "bg-destructive/10 text-destructive border-destructive/20" },
    cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },

    // Financial
    paid: { label: "Pagado", className: "bg-success/10 text-success border-success/20" },
    partial: { label: "Parcial", className: "bg-warning/10 text-warning border-warning/20" },
    overdue: { label: "Vencido", className: "bg-destructive/10 text-destructive border-destructive/20" },
    unpaid: { label: "No Pagado", className: "bg-muted text-muted-foreground border-muted" },

    // Production
    scheduled: { label: "Programado", className: "bg-info/10 text-info border-info/20" },
    manufacturing: { label: "En Fabricación", className: "bg-primary/10 text-primary border-primary/20" },

    // Inventory
    available: { label: "Disponible", className: "bg-success/10 text-success border-success/20" },
    reserved: { label: "Reservado", className: "bg-warning/10 text-warning border-warning/20" },
    out_of_stock: { label: "Sin Stock", className: "bg-destructive/10 text-destructive border-destructive/20" },

    // Documents
    confirmed: { label: "Confirmado", className: "bg-success/10 text-success border-success/20" },
    sent: { label: "Enviado", className: "bg-info/10 text-info border-info/20" },
    received: { label: "Recibido", className: "bg-success/10 text-success border-success/20" },

    // Billing
    emitted: { label: "Emitido", className: "bg-info/10 text-info border-info/20" },
    voided: { label: "Anulado", className: "bg-destructive/10 text-destructive border-destructive/20" },
}

interface StatusBadgeProps {
    /** Status key matching STATUS_CONFIG. Falls back to neutral styling for unknown statuses. */
    status: string
    /** Override the default label for this status */
    label?: string
    /** Size variant */
    size?: "sm" | "md"
    /** Optional className override */
    className?: string
}

/**
 * Semantic status badge with centralized color mapping.
 * Replaces ad-hoc `<Badge className="bg-emerald-600">` patterns.
 *
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="paid" label="Pagado completamente" />
 * <StatusBadge status="pending" size="sm" />
 */
export function StatusBadge({
    status,
    label,
    size = "md",
    className,
}: StatusBadgeProps) {
    const config = STATUS_CONFIG[status]
    const displayLabel = label ?? config?.label ?? status
    const colorClass = config?.className ?? "bg-muted text-muted-foreground border-muted"

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-medium border",
                colorClass,
                size === "sm" && "text-[10px] px-1.5 py-0",
                size === "md" && "text-xs px-2 py-0.5",
                className
            )}
        >
            {displayLabel}
        </Badge>
    )
}

/** Export the config for external use (e.g., in column definitions) */
export { STATUS_CONFIG }
