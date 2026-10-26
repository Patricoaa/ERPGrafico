"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { cardAnatomy } from "./card-anatomy"

export type CardRailTone = "warning" | "success" | "info" | "destructive" | "neutral" | "primary"
export type CardRailSize = "sm" | "md"

export interface CardRailProps {
    /** Semantic tone of the rail — drives border/background/text colour. */
    tone: CardRailTone
    /** `md` (w-14) for state rails with an icon, `sm` (w-9) for selection markers. */
    size?: CardRailSize
    /** Edge the rail sits on: `right` (default, selection markers) or `left` (document state, entity cards). */
    side?: "left" | "right"
    /**
     * `true` (default): purely visual, hidden from assistive tech — the state must also be
     * announced elsewhere (StatusBadge, label). `false`: the content is meaningful (e.g. the
     * sr-only "Seleccionado" of a SelectionCheck) and stays exposed.
     */
    decorative?: boolean
    /** Icon or content centred in the rail. Optional for empty decorative rails. */
    children?: React.ReactNode
    className?: string
}

const TONE_CLASS: Record<CardRailTone, string> = {
    warning: "border-warning/20 bg-warning/10 text-warning",
    success: "border-success/20 bg-success/10 text-success",
    info: "border-info/20 bg-info/10 text-info",
    destructive: "border-destructive/20 bg-destructive/10 text-destructive",
    neutral: "border-border/60 bg-muted/20 text-muted-foreground",
    primary: "border-primary/30 bg-primary/5 text-primary",
}

/**
 * The single side rail of the card family: a full-height column on the trailing edge that encodes
 * state through colour (MfgLineCard) or hosts the selection marker (ChoiceCard light).
 * Colour is never the only carrier — pair it with an icon and with the card's own text/StatusBadge.
 */
export function CardRail({ tone, size = "md", side = "right", decorative = true, children, className }: CardRailProps) {
    return (
        <div
            className={cn(cardAnatomy.rail, cardAnatomy.railSize[size], TONE_CLASS[tone], side === "left" ? "border-l-0 border-r" : "order-last", className)}
            aria-hidden={decorative ? true : undefined}
        >
            {children}
        </div>
    )
}
