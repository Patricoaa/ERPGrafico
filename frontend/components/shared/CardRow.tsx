"use client"

import * as React from "react"
import { Settings2, ChevronRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { CardSurface, CardRail, cardAnatomy } from "./CardSurface"
import { MoneyDisplay } from "./MoneyDisplay"

export interface CardRowProps {
    /** Optional leading slot — photo, icon, avatar (40×40). Omit entirely if no media. */
    lead?: React.ReactNode
    /** Monospace code / RUT / number above the title. */
    code?: string
    /** Primary title line. */
    title: string
    /** Optional secondary description under the title. */
    description?: string
    /** Optional caption (qty, unit, "desde"). */
    caption?: string
    /** Main amount/price, tabular numerals. */
    amount?: string | number
    /** Decorative action glyph at trailing edge. */
    glyph?: React.ReactNode
    /** Optional side rail (status colour). */
    rail?: React.ReactNode
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
    /** Additional className. */
    className?: string
    /** Render a custom trailing section (overrides glyph). */
    trailing?: React.ReactNode
}

/**
 * Horizontal card row — no media strip.
 * Lead (optional 40×40) | code + title + description + footer | optional rail
 * Uses the inline tokens from card-anatomy. If lead is omitted, no placeholder is rendered.
 */
export function CardRow({
    lead,
    code,
    title,
    description,
    caption,
    amount,
    glyph,
    rail,
    selected = false,
    unavailable = false,
    role = "button",
    onClick,
    onKeyDown,
    className,
    trailing,
}: CardRowProps) {
    const hasLead = lead !== undefined && lead !== null
    const hasCaption = caption !== undefined && caption !== null
    const hasAmount = amount !== undefined && amount !== null

    const trailingContent = trailing ?? (glyph ? (
        <span
            className={cn(cardAnatomy.glyph, "flex items-center justify-center")}
            aria-hidden
        >
            {glyph}
        </span>
    ) : null)

    const amountDisplay = hasAmount ? (
        typeof amount === "number"
            ? <MoneyDisplay amount={amount} showColor={false} className={cn(cardAnatomy.amount, "text-sm")} />
            : <span className={cn(cardAnatomy.amount, "text-sm")}>{amount}</span>
    ) : null

    const children = (
        <>
            {hasLead && (
                <div className={cn(cardAnatomy.lead, "flex items-center justify-center")}>
                    {lead}
                </div>
            )}
            <div className={cardAnatomy.inlineBody}>
                {code && <span className={cardAnatomy.inlineCode}>{code}</span>}
                <h3 className={cardAnatomy.inlineTitle}>{title}</h3>
                {description && <span className={cardAnatomy.description}>{description}</span>}
                {(hasCaption || hasAmount || glyph || trailing) && (
                    <div className={cn(cardAnatomy.inlineFooter, "flex items-end justify-between gap-3")}>
                        <div className="flex items-baseline gap-2">
                            {hasCaption && <span className={cardAnatomy.caption}>{caption}</span>}
                            {amountDisplay}
                        </div>
                        {trailingContent}
                    </div>
                )}
            </div>
            {rail && <div className="flex-shrink-0">{rail}</div>}
        </>
    )

    return (
        <CardSurface
            layout="inline"
            selected={selected}
            unavailable={unavailable}
            role={role}
            onClick={onClick}
            onKeyDown={onKeyDown}
            className={cn("flex items-stretch", className)}
        >
            {children}
        </CardSurface>
    )
}

/** Convenience: CardRow with a success/warning/neutral rail. */
export function CardRowWithRail(
    props: CardRowProps & { railTone?: "warning" | "success" | "neutral"; railIcon?: React.ReactNode }
) {
    const { railTone, railIcon, ...rest } = props
    if (!railTone) return React.createElement(CardRow, rest)
    const icon = railIcon ?? React.createElement(Settings2, { className: "h-5 w-5", "aria-hidden": true })
    return React.createElement(CardRow, { ...rest, rail: React.createElement(CardRail, { tone: railTone }, icon) })
}

/** Glyph presets for common actions. */
export function GlyphConfigure() { return React.createElement(Settings2, { className: "h-4 w-4", "aria-hidden": true }) }
export function GlyphAdd() { return React.createElement(Plus, { className: "h-4 w-4", "aria-hidden": true }) }
export function GlyphChevron() { return React.createElement(ChevronRight, { className: "h-4 w-4", "aria-hidden": true }) }