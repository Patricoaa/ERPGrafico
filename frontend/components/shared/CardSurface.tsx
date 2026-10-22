"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { selectableCardClass } from "./SelectableCard"
import { cardAnatomy } from "./card-anatomy"

export interface CardSurfaceProps
    extends Omit<React.ComponentProps<"div">, "onClick" | "onKeyDown"> {
    /** Selection state for the visual language (ribbon + ring + check). */
    selected?: boolean
    /** Cannot be interacted with (disabled by caller or ruled out by data). */
    unavailable?: boolean
    /** ARIA role — "radio" for choices, "button" for object actions. */
    role?: "radio" | "button"
    /** Click handler (only when not unavailable). */
    onClick?: () => void
    /** Keyboard handler — Enter/Space triggers onClick. */
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
    /** Children rendered inside the surface. */
    children: React.ReactNode
    /** Additional className merged after the surface classes. */
    className?: string
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
    ...props
}: CardSurfaceProps) {
    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (onKeyDown) onKeyDown(e)
        if (!e.defaultPrevented && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            onClick?.()
        }
    }

    return (
        <Card
            role={role}
            tabIndex={unavailable ? -1 : 0}
            aria-disabled={unavailable || undefined}
            aria-pressed={role === "button" ? selected : undefined}
            aria-checked={role === "radio" ? selected : undefined}
            className={cn(
                // Base surface: Card's default variant (rounded-md, border, shadow, py-6) is overridden
                // by selectableCardClass (border, bg, shadow-none, rounded-sm via selectableCardClass)
                // and then by our explicit neutralisation of gap/padding/shadow.
                selectableCardClass({ selected, unavailable }),
                "gap-0 p-0 shadow-none",
                className
            )}
            onClick={unavailable ? undefined : onClick}
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
    /** Icon or content centred in the rail (e.g. Settings2, Check). */
    children: React.ReactNode
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