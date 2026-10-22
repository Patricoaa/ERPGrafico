"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { selectableCardClass } from "./SelectableCard"
import { cardAnatomy } from "./card-anatomy"

export type CardLayout = "stacked" | "inline"

export interface CardSurfaceProps
    extends Omit<React.ComponentProps<"div">, "onClick" | "onKeyDown"> {
    /** Selection state for the visual language (ribbon + ring + check). */
    selected?: boolean
    /** Cannot be interacted with (disabled by caller or ruled out by data). */
    unavailable?: boolean
    /**
     * ARIA role — "radio" for choices, "button" for object actions.
     * Only emitted when `selected` is explicitly passed (true or false).
     */
    role?: "radio" | "button"
    /** Click handler (only when not unavailable). */
    onClick?: () => void
    /** Keyboard handler — Enter/Space triggers onClick. */
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
    /** Children rendered inside the surface. */
    children: React.ReactNode
    /** Additional className merged after the surface classes. */
    className?: string
    /**
     * Layout variant. "stacked" = media strip on top (ProductCard, ChoiceCard).
     * "inline" = horizontal row, no media strip (MfgLineCard, VariantSelectorModal).
     * Affects internal padding only; callers still compose anatomy tokens.
     */
    layout?: CardLayout
    /**
     * Whether the card is an interactive target (click/keyboard → action).
     * Derived from `onClick` by default; override only for edge cases.
     * When false: no cursor-pointer, no hover border, no ribbon preview.
     */
    interactive?: boolean
}

/**
 * The shared surface for all interactive/selectable cards in the POS family.
 * Wraps `Card` + `selectableCardClass()` and neutralises the default Card padding/shadow/gap
 * so callers compose *only* anatomy tokens, never raw utility overrides.
 */
export function CardSurface({
    selected = false,
    unavailable = false,
    role = "button",
    onClick,
    onKeyDown,
    children,
    className,
    layout = "stacked",
    interactive,
    ...props
}: CardSurfaceProps) {
    const isInteractive = interactive ?? (onClick !== undefined)
    const hasExplicitSelected = selected !== undefined

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (onKeyDown) onKeyDown(e)
        if (!e.defaultPrevented && isInteractive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            onClick?.()
        }
    }

    const layoutPadding = layout === "inline" ? "p-0" : "gap-0 p-0"

    return (
        <Card
            role={isInteractive ? role : undefined}
            tabIndex={unavailable ? -1 : isInteractive ? 0 : undefined}
            aria-disabled={unavailable || undefined}
            aria-pressed={hasExplicitSelected && role === "button" ? selected : undefined}
            aria-checked={hasExplicitSelected && role === "radio" ? selected : undefined}
            className={cn(
                selectableCardClass({ selected, unavailable, interactive: isInteractive }),
                "shadow-none",
                layoutPadding,
                className
            )}
            onClick={unavailable || !isInteractive ? undefined : onClick}
            onKeyDown={handleKeyDown}
            {...props}
        >
            {children}
        </Card>
    )
}

export interface CardRailProps {
    /** Semantic tone of the rail — drives border/background/text colour. */
    tone: "warning" | "success" | "neutral"
    /** Icon or content centred in the rail (e.g. Settings2, Check). Optional for empty decorative rails. */
    children?: React.ReactNode
    /** Additional className. */
    className?: string
}

/**
 * Side rail (w-14) that encodes state through colour. Used by MfgLineCard and any future
 * card that needs a persistent status strip instead of (or in addition to) the selection ribbon.
 */
export function CardRail({ tone, children, className }: CardRailProps) {
    const tones = {
        warning: "border-warning/20 bg-warning/10 text-warning",
        success: "border-success/20 bg-success/10 text-success",
        neutral: "border-border/20 bg-muted/30 text-muted-foreground",
    } as const

    return (
        <div
            className={cn(
                "flex w-14 shrink-0 items-center justify-center border-l transition-colors",
                tones[tone],
                className
            )}
            aria-hidden="true"
        >
            {children}
        </div>
    )
}

/** Re-export anatomy tokens for consumers that build custom layouts. */
export { cardAnatomy }