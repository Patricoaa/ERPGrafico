"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface SummarySectionProps {
    /** Sin título la sección es solo la lista (paso de una única sección). */
    title?: string
    action?: React.ReactNode
    children: React.ReactNode
}

/** Sección de resumen de un wizard: cabecera en mayúsculas y filas separadas por líneas (mismo estilo que el checklist de cierre). */
export function SummarySection({ title, action, children }: SummarySectionProps) {
    return (
        <section>
            {title && (
                <div className="flex items-center justify-between border-b border-border pb-1">
                    <h3 className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
                    {action}
                </div>
            )}
            <ul className="divide-y divide-border">{children}</ul>
        </section>
    )
}

interface SummaryRowProps {
    label: string
    value: React.ReactNode
    strong?: boolean
    valueClassName?: string
}

export function SummaryRow({ label, value, strong, valueClassName }: SummaryRowProps) {
    return (
        <li className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("font-mono tabular-nums", strong && "font-bold", valueClassName)}>{value}</span>
        </li>
    )
}

interface SummaryNoteProps {
    children: React.ReactNode
    /** `warning` (default) para advertencias; `success` para efectos/logros confirmados. */
    tone?: "warning" | "success"
}

export function SummaryNote({ children, tone = "warning" }: SummaryNoteProps) {
    const Icon = tone === "success" ? CheckCircle2 : AlertTriangle
    return (
        <li className="flex items-start gap-3 py-2.5 text-sm text-muted-foreground">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "success" ? "text-success" : "text-warning")} aria-hidden />
            <span>{children}</span>
        </li>
    )
}
