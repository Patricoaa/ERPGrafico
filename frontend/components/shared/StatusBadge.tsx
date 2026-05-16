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
    DRAFT: { label: "Borrador", className: "bg-info/10 text-info", type: "info" },
    CONFIRMED: { label: "Confirmado", className: "bg-warning/10 text-warning", type: "warning" },
    PAID: { label: "Pagado", className: "bg-success/10 text-success", type: "success" },
    CANCELLED: { label: "Cancelado", className: "bg-destructive/10 text-destructive", type: "destructive" },
    VOIDED: { label: "Anulado", className: "bg-destructive/10 text-destructive", type: "destructive" },
    POSTED: { label: "Publicado", className: "bg-success/10 text-success", type: "success" },

    // Progress / Logistics
    PARTIAL: { label: "Parcial", className: "bg-warning/10 text-warning", type: "warning" },
    DELIVERED: { label: "Entregado", className: "bg-success/10 text-success", type: "success" },
    SENT: { label: "Enviado", className: "bg-info/10 text-info", type: "info" },
    RECEIVED: { label: "Recibido", className: "bg-success/10 text-success", type: "success" },

    // Production
    IN_PROGRESS: { label: "En Proceso", className: "bg-warning/10 text-warning", type: "warning" },
    FINISHED: { label: "Finalizado", className: "bg-success/10 text-success", type: "success" },
    MANUFACTURING: { label: "Fabricando", className: "bg-primary/10 text-primary", type: "neutral" },

    // Financial / Treasury / Reconciliation
    COMPLETED: { label: "Completado", className: "bg-success/10 text-success", type: "success" },
    UNRECONCILED: { label: "Sin Conciliar", className: "bg-info/10 text-info", type: "info" },
    MATCHED: { label: "Sugerido", className: "bg-info/10 text-info", type: "info" },
    RECONCILED: { label: "Conciliado", className: "bg-success/10 text-success", type: "success" },
    DISPUTED: { label: "Disputado", className: "bg-destructive/10 text-destructive", type: "destructive" },
    EXCLUDED: { label: "Excluido", className: "bg-muted text-muted-foreground", type: "neutral" },
    OPEN: { label: "Abierto", className: "bg-success/10 text-success", type: "success" },
    CLOSED: { label: "Cerrado", className: "bg-info/10 text-info", type: "info" },
    UNDER_REVIEW: { label: "En Revisión", className: "bg-warning/10 text-warning", type: "warning" },
    SETTLED: { label: "Liquidado", className: "bg-success/10 text-success", type: "success" },
    INVOICED: { label: "Facturado", className: "bg-info/10 text-info", type: "info" },
    PENDING: { label: "Pendiente", className: "bg-warning/10 text-warning", type: "warning" },

    // Lowercase fallbacks for legacy code
    active: { label: "Activo", className: "bg-primary/10 text-primary", type: "neutral" },
    inactive: { label: "Inactivo", className: "bg-muted text-muted-foreground", type: "neutral" },

    // Semantic / Hub universals
    SUCCESS: { label: "Completado", className: "bg-success/10 text-success", type: "success" },
    INFO: { label: "Info", className: "bg-info/10 text-info", type: "info" },
    WARNING: { label: "Advertencia", className: "bg-warning/10 text-warning", type: "warning" },
    ERROR: { label: "Error", className: "bg-destructive/10 text-destructive", type: "destructive" },
    DESTRUCTIVE: { label: "Eliminado", className: "bg-destructive/10 text-destructive", type: "destructive" },
    NEUTRAL: { label: "Pendiente", className: "bg-muted text-muted-foreground", type: "neutral" },
    NOT_APPLICABLE: { label: "No aplica", className: "bg-muted/50 text-muted-foreground/50", type: "neutral" },

    // Accounting - Account Types
    ASSET: { label: "Activo", className: "bg-asset/10 text-asset", type: "info" },
    LIABILITY: { label: "Pasivo", className: "bg-liability/10 text-liability", type: "warning" },
    EQUITY: { label: "Patrimonio", className: "bg-muted text-muted-foreground", type: "neutral" },
    INCOME: { label: "Ingreso", className: "bg-income/10 text-income", type: "success" },
    EXPENSE: { label: "Gasto", className: "bg-expense/10 text-expense", type: "destructive" },

    // Credit / Risk
    RISK_LOW: { label: "Riesgo Bajo", className: "bg-success/10 text-success", type: "success" },
    RISK_MEDIUM: { label: "Riesgo Medio", className: "bg-warning/10 text-warning", type: "warning" },
    RISK_HIGH: { label: "Riesgo Alto", className: "bg-warning/10 text-warning", type: "warning" },
    RISK_CRITICAL: { label: "Riesgo Crítico", className: "bg-destructive/10 text-destructive", type: "destructive" },

    // Credit Origins
    ORIGIN_MANUAL: { label: "Manual", className: "bg-info/10 text-info", type: "info" },
    ORIGIN_FALLBACK: { label: "Fallback", className: "bg-warning/10 text-warning", type: "warning" },
    ORIGIN_CREDIT_PORTFOLIO: { label: "Cartera", className: "bg-success/10 text-success", type: "success" },

    // Credit Aging
    WRITTEN_OFF: { label: "Castigado", className: "bg-destructive/10 text-destructive", type: "destructive" },
    WRITE_OFF: { label: "Castigado", className: "bg-destructive/10 text-destructive", type: "destructive" },
    CURRENT: { label: "Vigente", className: "bg-success/10 text-success", type: "success" },
    OVERDUE_30: { label: "1-30 Días", className: "bg-warning/10 text-warning", type: "warning" },
    OVERDUE_60: { label: "31-60 Días", className: "bg-warning/10 text-warning", type: "warning" },
    OVERDUE_90: { label: "61-90 Días", className: "bg-destructive/10 text-destructive", type: "destructive" },
    OVERDUE_90PLUS: { label: "+90 Días", className: "bg-destructive/10 text-destructive", type: "destructive" },

    // HR - Absences
    AUSENTISMO: { label: "Ausentismo", className: "bg-destructive/10 text-destructive", type: "destructive" },
    LICENCIA: { label: "Licencia", className: "bg-info/10 text-info", type: "info" },
    PERMISO_SIN_GOCE: { label: "Permiso s/Goce", className: "bg-warning/10 text-warning", type: "warning" },
    AUSENCIA_HORAS: { label: "Horas", className: "bg-neutral/10 text-neutral", type: "neutral" },

    // HR - General
    DISCOUNTED: { label: "Descontado", className: "bg-success/10 text-success", type: "success" },

    // Contact Types
    CUSTOMER: { label: "Cliente", className: "bg-info/10 text-info", type: "info" },
    SUPPLIER: { label: "Proveedor", className: "bg-primary/10 text-primary", type: "neutral" },
    BOTH: { label: "Ambos", className: "bg-success/10 text-success", type: "success" },
    RELATED: { label: "Relacionado", className: "bg-warning/10 text-warning", type: "warning" },
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
    size = "sm",
    rounded = true,
    className,
}: StatusBadgeProps) {
    const normalizedStatus = status?.toUpperCase() || ""
    const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG[status]
    const displayLabel = label ?? config?.label ?? status
    const colorClass = config?.className ?? "bg-muted text-muted-foreground border-muted"

    const sizeClasses = {
        sm: "h-6 px-3 text-[12px] gap-1.5",
        md: "h-8 px-4 text-[14px] gap-2",
        lg: "h-10 px-6 text-base gap-2.5"
    };

    const iconSizes = {
        sm: "h-3.5 w-3.5",
        md: "h-4 w-4",
        lg: "h-5 w-5"
    };

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
                    "font-mono font-black uppercase tracking-tight leading-none translate-y-[0.5px]",
                    size === "sm" ? "text-[10px]" : "text-[11px] text-muted-foreground"
                )}>
                    {displayLabel}
                </span>
            </div>
        )
    }

    // Default: Standard Badge
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center font-mono font-black uppercase tracking-tight border transition-all duration-200 leading-none",
                colorClass,
                config?.type === 'neutral' ? "border-muted" : `border-current/20`,
                sizeClasses[size],
                rounded ? "rounded-full" : "rounded-sm",
                className
            )}
        >
            {Icon && <Icon className={cn(iconSizes[size], "shrink-0 opacity-80 translate-y-[-0.5px]")} />}
            <span className="translate-y-[0.5px]">{displayLabel}</span>
        </span>
    )
}

export { STATUS_CONFIG }
