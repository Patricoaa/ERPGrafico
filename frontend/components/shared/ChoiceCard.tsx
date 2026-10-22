"use client"

// ChoiceCard — one option of a "pick one" step (tax document, delivery, payment method…).
// Same anatomy as ProductCard: media strip on top (icon or custom media, optional chip), then
// meta · title · description, and a footer pinned to the bottom. Selection language comes from
// SelectableCard (CMYK ribbon + K100 ring + check; hover previews the ribbon; unavailable is muted).
//
// Use inside <ChoiceGroup> so the options form a radiogroup with arrow-key navigation.

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Chip } from "./Chip"
import { SelectionCheck, selectableCardClass } from "./SelectableCard"
import { cardAnatomy } from "./card-anatomy"

export interface ChoiceCardProps {
    selected: boolean
    onSelect: () => void
    /** Cannot be picked. Say why in `description`. */
    disabled?: boolean
    title: string
    description?: string
    /** Monospace line above the title: a code, a number. */
    meta?: string
    /** Icon centred in the media strip (any lucide icon). Ignored when `media` is given. */
    icon?: React.ComponentType<{ className?: string }>
    /** Overrides the icon colour (semantic text token, e.g. `text-success`). Muted when disabled. */
    iconClassName?: string
    /** Replaces the icon: an avatar, an image… (fills the strip, centre-aligned). */
    media?: React.ReactNode
    /** Chip over the top-left of the media strip. */
    badge?: string
    /** `warning` tints the strip amber (e.g. tax-exempt documents). */
    tone?: "default" | "warning"
    /** Bottom-pinned content: amounts, secondary facts. */
    footer?: React.ReactNode
    /** `compact` shortens the media strip for dense grids (payment methods). */
    size?: "default" | "compact"
    /** Extra body content rendered between the description and the footer. */
    children?: React.ReactNode
    className?: string
}

export function ChoiceCard({
    selected,
    onSelect,
    disabled = false,
    title,
    description,
    meta,
    icon: Icon,
    iconClassName,
    media,
    badge,
    tone = "default",
    footer,
    size = "default",
    children,
    className,
}: ChoiceCardProps) {
    const compact = size === "compact"

    return (
        <Button
            type="button"
            variant="ghost"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
                if (!disabled) onSelect()
            }}
            className={cn(
                selectableCardClass({ selected, unavailable: disabled }),
                // Button resets: a card, not a button — natural height, stacked, left-aligned, wrapping text.
                "h-full w-full items-stretch justify-start gap-0 whitespace-normal p-0 text-sm font-normal",
                disabled ? "hover:bg-muted/40 dark:hover:bg-muted/40" : "hover:bg-card dark:hover:bg-card",
                className
            )}
        >
            <span
                className={cn(
                    "relative flex w-full shrink-0 items-center justify-center overflow-hidden bg-muted",
                    compact ? "h-14" : "h-20",
                    tone === "warning" && !disabled && "bg-warning/20",
                    disabled && "bg-muted/60"
                )}
            >
                {media ?? (Icon && (
                    <Icon
                        className={cn(
                            compact ? "size-6" : "size-8",
                            disabled ? "text-muted-foreground/40" : (iconClassName ?? (tone === "warning" ? "text-warning-foreground" : "text-muted-foreground/70"))
                        )}
                        aria-hidden
                    />
                ))}
                {badge && (
                    <Chip size="xs" className="absolute left-2 top-2 border border-border bg-background text-3xs font-normal">
                        {badge}
                    </Chip>
                )}
                {selected && <SelectionCheck />}
            </span>

            <span className={cn(
                "flex w-full flex-1 flex-col gap-1 px-3 pb-3 text-left",
                compact ? "pt-2" : "pt-2.5"
            )}>
                {meta && <span className={cardAnatomy.code}>{meta}</span>}
                <span className={cn(cardAnatomy.title, disabled && "text-muted-foreground")}>{title}</span>
                {description && <span className={cardAnatomy.description}>{description}</span>}
                {children}
                {footer && <span className={cardAnatomy.footer}>{footer}</span>}
            </span>
        </Button>
    )
}

export interface ChoiceGroupProps {
    /** Accessible name of the group ("Documento tributario"). */
    label: string
    /** Tailwind grid-cols classes, e.g. `grid-cols-2 xl:grid-cols-3`. */
    columns?: string
    /**
     * What an arrow key does: `select` moves focus and picks the option (native radio behaviour);
     * `focus` only moves focus (use when picking opens something, like an amount dialog).
     */
    activation?: "select" | "focus"
    className?: string
    children: React.ReactNode
}

const ARROWS: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function ChoiceGroup({ label, columns = "grid-cols-1", activation = "select", className, children }: ChoiceGroupProps) {
    const ref = React.useRef<HTMLDivElement>(null)

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const step = ARROWS[event.key]
        if (!step || !ref.current) return
        const options = Array.from(ref.current.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([aria-disabled="true"])'))
        const current = options.indexOf(document.activeElement as HTMLButtonElement)
        if (current < 0) return
        event.preventDefault()
        const next = options[(current + step + options.length) % options.length]
        next.focus()
        if (activation === "select") next.click()
    }

    return (
        <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn("grid w-full gap-3", columns, className)}>
            {children}
        </div>
    )
}
