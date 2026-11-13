"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type BannerTone = "info" | "warning" | "success" | "destructive" | "neutral"

/**
 * Cuánto padding horizontal del host cancela la banda para llegar de borde a borde.
 * `sm` = 8px · `md` = 16px · `lg` = 24px. El texto queda alineado con el contenido del host
 * porque el padding interno repite el mismo valor.
 */
export type BannerBleed = "none" | "sm" | "md" | "lg"

export interface BannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    /** Tono semántico. Tiñe el fondo tenue y el icono; el texto va siempre en tokens neutros. */
    tone?: BannerTone
    /** Icono del tono por defecto; `null` para apagarlo. */
    icon?: LucideIcon | null
    iconClassName?: string
    /** Título de una línea. Sin título, `children` ocupa el lugar del título. */
    title?: React.ReactNode
    /** Dato destacado junto al título (monto, conteo) en `tabular-nums`. */
    value?: React.ReactNode
    /** Texto de apoyo bajo el título. */
    children?: React.ReactNode
    /** Zona derecha: botón, monto o par de acciones. Baja de línea en anchos chicos. */
    actions?: React.ReactNode
    /** Muestra el botón de descarte (ghost X) con `aria-label`. */
    onDismiss?: () => void
    dismissLabel?: string
    /** `status` (default) se anuncia sin interrumpir; `alert` interrumpe; `none` es una nota estática. */
    live?: "status" | "alert" | "none"
    /** Padding del host que la banda cancela para ir de borde a borde. Default `none`. */
    bleed?: BannerBleed
}

const TONE: Record<BannerTone, { surface: string; icon: string; defaultIcon: LucideIcon }> = {
    info: { surface: "bg-info/5", icon: "text-info", defaultIcon: Info },
    warning: { surface: "bg-warning/5", icon: "text-warning", defaultIcon: AlertTriangle },
    success: { surface: "bg-success/5", icon: "text-success", defaultIcon: CheckCircle2 },
    destructive: { surface: "bg-destructive/5", icon: "text-destructive", defaultIcon: AlertTriangle },
    neutral: { surface: "bg-muted/40", icon: "text-muted-foreground", defaultIcon: Info },
}

const BLEED: Record<BannerBleed, string> = {
    none: "px-4",
    sm: "-mx-2 w-[calc(100%+1rem)] px-2",
    md: "-mx-4 w-[calc(100%+2rem)] px-4",
    lg: "-mx-6 w-[calc(100%+3rem)] px-6",
}

/**
 * Aviso o banner de estado con acciones ("Diferencia de caja", "Datos guardados", "Archivo duplicado").
 * Banda recta y sin borde: el estado se lee por el fondo tenue y el icono, nunca por el color del texto.
 * No es una card: nada se abre desde él ni se selecciona (ADR-0097).
 */
export function Banner({
    tone = "info",
    icon,
    iconClassName,
    title,
    value,
    children,
    actions,
    onDismiss,
    dismissLabel = "Descartar aviso",
    live,
    bleed = "none",
    className,
    ...props
}: BannerProps) {
    const config = TONE[tone]
    const Icon = icon === undefined ? config.defaultIcon : icon
    const role = live === "none" ? undefined : live ?? (tone === "destructive" ? "alert" : "status")

    return (
        <div
            role={role}
            className={cn(
                "flex w-full items-start gap-3 rounded-none border-0 py-2.5 text-foreground",
                config.surface,
                BLEED[bleed],
                className
            )}
            {...props}
        >
            {Icon && <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.icon, iconClassName)} aria-hidden />}

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {(title || children) && (
                    <div className="min-w-0">
                        {title && (
                            <p className="text-sm font-medium leading-snug">
                                {title}
                                {value != null && value !== "" && (
                                    <> · <span className="tabular-nums">{value}</span></>
                                )}
                            </p>
                        )}
                        {children && (
                            <div
                                className={cn(
                                    "leading-snug",
                                    title ? "text-xs text-muted-foreground" : "text-sm"
                                )}
                            >
                                {children}
                            </div>
                        )}
                    </div>
                )}

                {(actions || onDismiss) && (
                    <div className="flex shrink-0 items-center gap-2">
                        {actions}
                        {onDismiss && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={onDismiss}
                                aria-label={dismissLabel}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
