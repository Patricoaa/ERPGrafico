"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CardLead } from "./CardLead"

export type InfoBlockTone = "info" | "success" | "warning" | "destructive" | "neutral"

export interface InfoBlockProps {
    tone?: InfoBlockTone
    /** Icon in the lead slot. Decorative: the title already carries the meaning. */
    icon: LucideIcon
    /** Extra classes for the icon (e.g. `animate-spin motion-reduce:animate-none`). */
    iconClassName?: string
    title: React.ReactNode
    /** The sentence under the title. */
    children?: React.ReactNode
    /** Buttons on the trailing edge. */
    actions?: React.ReactNode
    /**
     * `status` (default) is announced politely, `alert` interrupts (blocking errors). Use `none` for
     * static notes that are not a state change.
     */
    live?: "status" | "alert" | "none"
    className?: string
}

const TONE: Record<InfoBlockTone, string> = {
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-muted-foreground",
}

/**
 * A notice or a state banner with optional actions ("Autorización requerida", "Crédito aprobado").
 * It is not a card: nothing opens from it and it is never selected. Use it instead of a hand-made
 * `border rounded bg-card` block (card family §5, ADR-0097). The tone only tints the icon; the text
 * stays on neutral tokens so contrast does not depend on the tone.
 */
export function InfoBlock({ tone = "neutral", icon: Icon, iconClassName, title, children, actions, live = "status", className }: InfoBlockProps) {
    return (
        <div
            role={live === "none" ? undefined : live}
            className={cn("surface-item flex items-start gap-3 p-4", className)}
        >
            <CardLead className={cn("h-10", TONE[tone])}>
                <Icon className={cn("size-5", iconClassName)} aria-hidden />
            </CardLead>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-tight text-foreground">{title}</p>
                {children && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{children}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-start gap-2">{actions}</div>}
        </div>
    )
}
