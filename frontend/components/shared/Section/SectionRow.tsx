"use client"

import * as React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SectionRowExpand {
    /** Texto del botón que despliega el detalle. */
    label: string
    expanded: boolean
    onToggle: () => void
    /** Contenido del detalle desplegado. */
    content: React.ReactNode
}

export interface SectionRowProps {
    /** Opcional cuando la fila es solo un `control` con su propia etiqueta. */
    title?: React.ReactNode
    /** Texto secundario bajo el título. */
    description?: React.ReactNode
    /** Etiqueta breve junto al título (estado, tipo…). */
    meta?: React.ReactNode
    /** Icono o indicador a la izquierda. */
    leading?: React.ReactNode
    /** Dato financiero, contable o de negocio alineado a la derecha. */
    value?: React.ReactNode
    valueClassName?: string
    strong?: boolean
    /** Valor de texto (no cifra): tipografía base en lugar de monoespaciada. */
    plain?: boolean
    /** Selector o input con etiqueta y lógica propia, controlado por quien lo usa. */
    control?: React.ReactNode
    /** Acciones a la derecha (`Section.Action`). */
    actions?: React.ReactNode
    expand?: SectionRowExpand
    /** Hace toda la fila pulsable (opciones seleccionables); usa `pressed` para su estado. */
    onClick?: () => void
    pressed?: boolean
    /**
     * `item` (default): fila con título. `stat`: etiqueta apagada y valor monoespaciado (clave–valor).
     * `total`: cifra destacada (saldo final, efectivo esperado…) con línea superior.
     */
    variant?: "item" | "stat" | "total"
    className?: string
}

/** Fila de `Section`: slots para estado, texto, dato, control y acciones, con detalle desplegable opcional. */
export function SectionRow({
    title, description, meta, leading, value, valueClassName, strong, plain, control, actions, expand, onClick, pressed, variant = "item", className,
}: SectionRowProps) {
    if (variant === "stat") {
        return (
            <li className={cn("flex items-baseline justify-between gap-4 py-2.5 text-sm", className)}>
                <span className="text-muted-foreground">{title}</span>
                <span className={cn(plain ? "text-right" : "font-mono tabular-nums", strong && "font-bold", valueClassName)}>{value}</span>
            </li>
        )
    }

    if (variant === "total") {
        return (
            <li className={cn("flex items-baseline justify-between gap-4 py-4", className)}>
                <span className="text-lg font-bold text-foreground">{title}</span>
                <span className={cn("font-mono text-2xl font-black tabular-nums", valueClassName)}>{value}</span>
            </li>
        )
    }

    const Chevron = expand?.expanded ? ChevronDown : ChevronRight
    const interactive = onClick
        ? {
            role: "button" as const,
            tabIndex: 0,
            "aria-pressed": pressed,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onClick()
                }
            },
        }
        : undefined

    return (
        <li className={cn("py-2.5", className)}>
            <div
                {...interactive}
                className={cn(
                    "flex items-start gap-3",
                    onClick && "-mx-1 cursor-pointer rounded-sm px-1 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                )}
            >
                {leading && <span className="mt-0.5 shrink-0">{leading}</span>}
                {(title || description) && (
                    <div className="min-w-0 flex-1">
                        {title && (
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-foreground">{title}</span>
                                {meta && <span className="text-2xs text-muted-foreground">{meta}</span>}
                            </div>
                        )}
                        {description && <div className="text-xs text-muted-foreground">{description}</div>}
                    </div>
                )}
                {control && <div className={cn(!(title || description) && "min-w-0 flex-1")}>{control}</div>}
                {value != null && <span className={cn("shrink-0 text-sm", plain ? "text-right" : "font-mono tabular-nums", strong && "font-bold", valueClassName)}>{value}</span>}
                {expand && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={expand.onToggle} aria-expanded={expand.expanded}>
                        <Chevron className="h-3.5 w-3.5" aria-hidden />
                        {expand.label}
                    </Button>
                )}
                {actions}
            </div>
            {expand?.expanded && <div className="mt-2 ml-7 border-l border-border pl-3">{expand.content}</div>}
        </li>
    )
}
