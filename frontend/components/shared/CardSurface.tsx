"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { selectableCardClass } from "./SelectableCard"
import { cardAnatomy } from "./card-anatomy"

export type CardLayout = "stacked" | "inline"

export interface CardSurfaceProps
    extends Omit<React.ComponentProps<"div">, "onClick" | "onKeyDown"> {
    /**
     * Selection state for the visual language (ribbon + ring + check). Pass it only when the card
     * can be selected: leaving it `undefined` keeps the card a plain action/link target with no
     * `aria-pressed`/`aria-checked`, so it is not announced as a toggle.
     */
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
    /**
     * Looks pressable (pointer cursor, hover border and ribbon) without being the control: no role,
     * no tabIndex, no keyboard handler. For cards whose real control is a child (stretched link, checkbox).
     */
    pressable?: boolean
    /** Surface role (ADR-0097): `choice` previews the ribbon on hover, `item` only when selected. */
    kind?: "choice" | "item"
}

/**
 * The shared surface for all interactive/selectable cards in the POS family.
 * Wraps `Card` + `selectableCardClass()` and neutralises the default Card padding/shadow/gap
 * so callers compose *only* anatomy tokens, never raw utility overrides.
 */
export function CardSurface({
    selected,
    unavailable = false,
    role = "button",
    onClick,
    onKeyDown,
    children,
    className,
    layout = "stacked",
    interactive,
    pressable = false,
    kind,
    ...props
}: CardSurfaceProps) {
    const isInteractive = interactive ?? (onClick !== undefined)
    const hasExplicitSelected = selected !== undefined

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
        if (onKeyDown) onKeyDown(e)
        // Only the card itself activates: Enter/Space on a nested button (row actions, approve/reject)
        // must keep doing its own thing instead of opening the card.
        if (!e.defaultPrevented && isInteractive && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            onClick?.()
        }
    }

    const layoutPadding = layout === "inline" ? "flex-row gap-0 p-0" : "gap-0 p-0"

    return (
        <Card
            role={isInteractive ? role : undefined}
            tabIndex={unavailable ? -1 : isInteractive ? 0 : undefined}
            aria-disabled={unavailable || undefined}
            aria-pressed={isInteractive && hasExplicitSelected && role === "button" ? selected : undefined}
            aria-checked={isInteractive && hasExplicitSelected && role === "radio" ? selected : undefined}
            className={cn(
                selectableCardClass({ selected: selected === true, unavailable, interactive: isInteractive || pressable, kind }),
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

export { CardLead, type CardLeadProps } from "./CardLead"
export { CardRail, type CardRailProps, type CardRailTone, type CardRailSize } from "./CardRail"

/** Re-export anatomy tokens for consumers that build custom layouts. */
export { cardAnatomy }