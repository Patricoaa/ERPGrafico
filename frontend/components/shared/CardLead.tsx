"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { cardAnatomy } from "./card-anatomy"

export interface CardLeadProps {
    /** `md` 40px (default), `sm` 32px for dense items. */
    size?: "sm" | "md"
    /**
     * `false` (default): a square of `size`. `true`: fixed width, grows to the height of the
     * text block beside it (entity item headers).
     */
    stretch?: boolean
    /** Tone classes for the container (e.g. `bg-success/10 text-success`). Defaults to muted. */
    className?: string
    /** Icon, image (`fill`) or avatar. */
    children?: React.ReactNode
}

/**
 * The single leading slot of the card family (icon / photo / avatar). Always `rounded-sm` and
 * clipped, so a `fill` image or avatar never breaks the corner. Content is decorative: the card's
 * title already names the entity.
 */
export function CardLead({ size = "md", stretch = false, className, children }: CardLeadProps) {
    return (
        <div
            className={cn(
                cardAnatomy.leadBase,
                cardAnatomy.leadSize[size],
                stretch ? "self-stretch" : size === "sm" ? "h-8" : "h-10",
                "bg-muted text-muted-foreground",
                className
            )}
        >
            {children}
        </div>
    )
}
