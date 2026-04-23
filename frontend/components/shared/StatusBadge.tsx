"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

/**
 * Metadata for business statuses using centralized semantic tokens.
 */
interface StatusStyle {
    label: string
    className: string
    type: "success" | "warning" | "destructive" | "info" | "neutral"
}

const STATUS_CONFIG: Record<string, StatusStyle> = {
    // Lifecycle & Documents
    DRAFT: { label: "Borrador", className: "bg-info/10 text-info border-info/20", type: "info" },
    CONFIRMED: { label: "Confirmado", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    PAID: { label: "Pagado", className: "bg-success/10 text-success border-success/20", type: "success" },
    CANCELLED: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    VOIDED: { label: "Anulado", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    POSTED: { label: "Publicado", className: "bg-success/10 text-success border-success/20", type: "success" },

    // Progress / Logistics
    PARTIAL: { label: "Parcial", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    DELIVERED: { label: "Entregado", className: "bg-success/10 text-success border-success/20", type: "success" },
    SENT: { label: "Enviado", className: "bg-info/10 text-info border-info/20", type: "info" },
    RECEIVED: { label: "Recibido", className: "bg-success/10 text-success border-success/20", type: "success" },

    // Production
    PLANNED: { label: "Planificado", className: "bg-info/10 text-info border-info/20", type: "info" },
    IN_PROGRESS: { label: "En Proceso", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    FINISHED: { label: "Finalizado", className: "bg-success/10 text-success border-success/20", type: "success" },
    MANUFACTURING: { label: "Fabricando", className: "bg-primary/10 text-primary border-primary/20", type: "neutral" },

    // Financial / Treasury / Reconciliation
    COMPLETED: { label: "Completado", className: "bg-success/10 text-success border-success/20", type: "success" },
    UNRECONCILED: { label: "Sin Conciliar", className: "bg-info/10 text-info border-info/20", type: "info" },
    MATCHED: { label: "Sugerido", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    RECONCILED: { label: "Conciliado", className: "bg-success/10 text-success border-success/20", type: "success" },
    DISPUTED: { label: "Disputado", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    EXCLUDED: { label: "Excluido", className: "bg-muted text-muted-foreground border-muted", type: "neutral" },
    OPEN: { label: "Abierto", className: "bg-success/10 text-success border-success/20", type: "success" },
    CLOSED: { label: "Cerrado", className: "bg-info/10 text-info border-info/20", type: "info" },
    UNDER_REVIEW: { label: "En Revisión", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    SETTLED: { label: "Liquidado", className: "bg-success/10 text-success border-success/20", type: "success" },
    INVOICED: { label: "Facturado", className: "bg-info/10 text-info border-info/20", type: "info" },
    PENDING: { label: "Pendiente", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },

    // Lowercase fallbacks for legacy code
    active: { label: "Activo", className: "bg-primary/10 text-primary border-primary/20", type: "neutral" },
    inactive: { label: "Inactivo", className: "bg-muted text-muted-foreground border-muted", type: "neutral" },

    // Semantic / Hub universals
    SUCCESS: { label: "Completado", className: "bg-success/10 text-success border-success/20", type: "success" },
    INFO: { label: "Info", className: "bg-info/10 text-info border-info/20", type: "info" },
    WARNING: { label: "Advertencia", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    ERROR: { label: "Error", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    DESTRUCTIVE: { label: "Eliminado", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    NEUTRAL: { label: "Pendiente", className: "bg-muted text-muted-foreground border-muted", type: "neutral" },
    NOT_APPLICABLE: { label: "No aplica", className: "bg-muted/50 text-muted-foreground/50 border-muted", type: "neutral" },

    // Accounting - Account Types
    ASSET: { label: "Activo", className: "bg-asset/10 text-asset border-asset/20", type: "info" },
    LIABILITY: { label: "Pasivo", className: "bg-liability/10 text-liability border-liability/20", type: "warning" },
    EQUITY: { label: "Patrimonio", className: "bg-muted text-muted-foreground border-muted", type: "neutral" },
    INCOME: { label: "Ingreso", className: "bg-income/10 text-income border-income/20", type: "success" },
    EXPENSE: { label: "Gasto", className: "bg-expense/10 text-expense border-expense/20", type: "destructive" },

    // Credit / Risk
    RISK_LOW: { label: "Riesgo Bajo", className: "bg-success/10 text-success border-success/20", type: "success" },
    RISK_MEDIUM: { label: "Riesgo Medio", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    RISK_HIGH: { label: "Riesgo Alto", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    RISK_CRITICAL: { label: "Riesgo Crítico", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },

    // Credit Origins
    ORIGIN_MANUAL: { label: "Manual", className: "bg-info/10 text-info border-info/20", type: "info" },
    ORIGIN_FALLBACK: { label: "Fallback", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    ORIGIN_CREDIT_PORTFOLIO: { label: "Cartera", className: "bg-success/10 text-success border-success/20", type: "success" },

    // Credit Aging
    WRITTEN_OFF: { label: "Castigado", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    WRITE_OFF: { label: "Castigado", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    CURRENT: { label: "Vigente", className: "bg-success/10 text-success border-success/20", type: "success" },
    OVERDUE_30: { label: "1-30 Días", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    OVERDUE_60: { label: "31-60 Días", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    OVERDUE_90: { label: "61-90 Días", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    OVERDUE_90PLUS: { label: "+90 Días", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },

    // HR - Absences
    AUSENTISMO: { label: "Ausentismo", className: "bg-destructive/10 text-destructive border-destructive/20", type: "destructive" },
    LICENCIA: { label: "Licencia", className: "bg-info/10 text-info border-info/20", type: "info" },
    PERMISO_SIN_GOCE: { label: "Permiso s/Goce", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
    AUSENCIA_HORAS: { label: "Horas", className: "bg-neutral/10 text-neutral border-neutral/20", type: "neutral" },

    // HR - General
    DISCOUNTED: { label: "Descontado", className: "bg-success/10 text-success border-success/20", type: "success" },

    // Contact Types
    CUSTOMER: { label: "Cliente", className: "bg-info/10 text-info border-info/20", type: "info" },
    SUPPLIER: { label: "Proveedor", className: "bg-primary/10 text-primary border-primary/20", type: "neutral" },
    BOTH: { label: "Ambos", className: "bg-success/10 text-success border-success/20", type: "success" },
    RELATED: { label: "Relacionado", className: "bg-warning/10 text-warning border-warning/20", type: "warning" },
}

interface StatusBadgeProps {
    /** Status key matching STATUS_CONFIG. Case-insensitive. */
    status: string
    /** Override the default label for this status */
    label?: string
    /** Visual variant: Standard badge, Hub (circular icon), Dot, or Subtle */
    variant?: "default" | "hub" | "dot" | "subtle"
    /** Icon to display (required for variant="hub") */
    icon?: LucideIcon
    /** Custom tooltip (used for variant="hub") */
    tooltip?: string
    /** Size variant */
    size?: "sm" | "md" | "lg"
    /** Whether to use fully rounded (pill) style */
    rounded?: boolean
    /** Optional className override */
    className?: string
}

/**
 * Semantic status badge with centralized color mapping and industrial design standards.
 * Supports standard labels, circular hub icons, and status dots.
 */
export function StatusBadge({
    status,
    label,
    variant = "default",
    icon: Icon,
    tooltip,
    size = "md",
    rounded = false,
    className,
}: StatusBadgeProps) {
    const normalizedStatus = status?.toUpperCase() || ""
    const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG[status]
    const displayLabel = label ?? config?.label ?? status
    const colorClass = config?.className ?? "bg-muted text-muted-foreground border-muted"

    // Variant: Hub (Circular icon for order status dashboards)
    if (variant === "hub" && Icon) {
        let hubColor = "text-muted-foreground bg-muted border-muted-foreground/20"
        if (config?.type === 'success') hubColor = "text-success bg-success/10 border-success/20"
        if (config?.type === 'warning') hubColor = "text-warning bg-warning/10 border-warning/20"
        if (config?.type === 'destructive') hubColor = "text-destructive bg-destructive/10 border-destructive/20"
        if (config?.type === 'info') hubColor = "text-info bg-info/10 border-info/20"

        // Special case for "Active" and "Manufacturing"
        if (['ACTIVE', 'MANUFACTURING'].includes(normalizedStatus) || ['active', 'manufacturing'].includes(status)) {
            hubColor = "text-primary bg-primary/10 border-primary/20"
        }

        const hubInner = (
            <div className={cn(
                "flex items-center justify-center rounded-full border transition-all duration-200",
                hubColor,
                size === "sm" ? "w-6 h-6" : "w-8 h-8",
                className
            )}>
                <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
            </div>
        )

        if (tooltip) {
            return (
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            {hubInner}
                        </TooltipTrigger>
                        <TooltipContent side="top" className="font-heading font-extrabold uppercase text-[10px] tracking-tighter">
                            {tooltip}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )
        }
        return hubInner
    }

    // Variant: Dot (Compact dot + label)
    if (variant === "dot") {
        let dotColor = "bg-muted-foreground"
        if (config?.type === 'success') dotColor = "bg-success"
        if (config?.type === 'warning') dotColor = "bg-warning"
        if (config?.type === 'destructive') dotColor = "bg-destructive"
        if (config?.type === 'info') dotColor = "bg-info"

        return (
            <div className={cn("flex items-center gap-1.5", className)}>
                <div className={cn("h-2 w-2 rounded-full animate-pulse", dotColor)} />
                <span className={cn(
                    "font-heading font-extrabold uppercase tracking-tighter",
                    size === "sm" ? "text-[10px]" : "text-xs text-muted-foreground"
                )}>
                    {displayLabel}
                </span>
            </div>
        )
    }

    // Default: Standard Badge
    return (
        <Badge
            variant="outline"
            className={cn(
                "inline-flex items-center font-heading font-extrabold uppercase tracking-tighter border shadow-sm",
                colorClass,
                size === "sm" && "text-[9px] px-1.5 py-0 gap-1",
                size === "md" && "text-[10px] px-2 py-0.5 gap-1",
                size === "lg" && "h-7 text-xs px-2.5 gap-1.5",
                rounded && "rounded-full px-3",
                className
            )}
        >
            {Icon && <Icon className={cn(size === "sm" ? "h-2 w-2" : size === "md" ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0")} />}
            {displayLabel}
        </Badge>
    )
}

export { STATUS_CONFIG }
