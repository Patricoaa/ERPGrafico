"use client"

import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import { ReactNode } from "react"

type ChipSize = "xs" | "sm" | "md"
type ChipIntent = "neutral" | "info" | "success" | "warning" | "destructive" | "primary"

const SIZE_CLASSES: Record<ChipSize, string> = {
    xs: "h-[18px] px-2   text-[9px]  gap-1",
    sm: "h-[22px] px-2.5 text-[10px] gap-1",
    md: "h-[26px] px-3   text-[11px] gap-1.5",
}

const ICON_SIZES: Record<ChipSize, string> = {
    xs: "h-2.5 w-2.5",
    sm: "h-3   w-3",
    md: "h-3.5 w-3.5",
}

const INTENT_CLASSES: Record<ChipIntent, string> = {
    neutral:     "bg-muted/60         text-muted-foreground  border-border/40",
    info:        "bg-info/10          text-info              border-info/20",
    success:     "bg-success/10       text-success           border-success/20",
    warning:     "bg-warning/10       text-warning           border-warning/20",
    destructive: "bg-destructive/10   text-destructive       border-destructive/20",
    primary:     "bg-primary/10       text-primary           border-primary/20",
}

interface ChipProps {
    children: ReactNode
    /** Visual size. Default: 'sm' (tablas, cards, listas densas) */
    size?: ChipSize
    /** Semantic color intent. Default: 'neutral' */
    intent?: ChipIntent
    /** Optional leading icon */
    icon?: LucideIcon
    /** Only for layout/positioning (margin, flex). Never override typography or colors here. */
    className?: string
}

/**
 * Chip — Label informativo centralizado para tags, categorías, tipos y conteos.
 *
 * USAR cuando: el label NO es un estado de workflow/entidad (eso es StatusBadge)
 * y NO es un identificador de documento (eso es EntityBadge).
 *
 * Ejemplos: "BOM ACTIVA", "IVA", "SERVICIO", "3 ítems", "Almacenable"
 *
 * Tipografía siempre: font-mono font-black uppercase tracking-widest
 * Padding siempre: definido por `size`, no overrideable por className
 */
export function Chip({ children, size = "sm", intent = "neutral", icon: Icon, className }: ChipProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center rounded-full border leading-none",
                "font-mono font-black uppercase tracking-widest",
                SIZE_CLASSES[size],
                INTENT_CLASSES[intent],
                className
            )}
        >
            {Icon && <Icon className={cn("shrink-0", ICON_SIZES[size])} />}
            <span className="translate-y-[0.5px]">{children}</span>
        </span>
    )
}
