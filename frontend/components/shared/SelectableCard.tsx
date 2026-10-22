"use client"

// SelectableCard — the selection language shared by every "pick one of these cards" surface
// (ProductCard, ContactCard, ChoiceCard). One place decides what selected / hover / unavailable look like:
//
//   selected     → CMYK ribbon along the top edge + K100 ring + check chip
//   hover/focus  → the ribbon previews (never the ring)
//   unavailable  → washed surface at 50 % opacity, grey text, not-allowed cursor, no ribbon, no hover
//
// The ribbon replaces CmykRing as the selection mark on cards (CmykRing stays for checkboxes/radios).

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { CardRail } from "./CardRail"

export interface SelectableCardState {
    selected?: boolean
    /** Cannot be picked: disabled by the caller or ruled out by the data. */
    unavailable?: boolean
    /**
     * Whether the card is an interactive target (click/keyboard → action).
     * When false the card is selectable (can show selected state) but not pressable:
     * no cursor-pointer, no hover border, no ribbon preview.
     * Default true for backward compat with ProductCard/ChoiceCard/ContactCard/MfgLineCard.
     */
    interactive?: boolean
    /**
     * Role of the surface (ADR-0097). `choice` (default): pick-one, the CMYK ribbon previews on hover.
     * `item`: opens/navigates (entity cards, inbox) — the ribbon only appears once selected.
     */
    kind?: "choice" | "item"
}

/** Surface classes for a pressable card. Compose with layout classes (`h-full`, `p-0`…) at the call site. */
export function selectableCardClass({ selected = false, unavailable = false, interactive = true, kind = "choice" }: SelectableCardState = {}): string {
    const ribbon = !unavailable && interactive && (selected || kind === "choice")
    return cn(
        // card-family-allow: this is the item surface itself (surface-item + selection language)
        "group relative flex flex-col overflow-hidden rounded-sm border border-border bg-card text-left shadow-none transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        unavailable
            ? "cursor-not-allowed border-border/60 bg-muted/40 opacity-50"
            : interactive
                ? "cursor-pointer hover:border-foreground/30"
                : "cursor-default",
        ribbon && "ribbon-cmyk",
        ribbon && !selected && "ribbon-cmyk-hover",
        selected && "border-primary ring-1 ring-primary"
    )
}

/** Check chip for the media strip of a selected card (bottom-right by default). */
export function SelectionCheck({
    className,
    placement = "overlay",
}: { className?: string; placement?: "overlay" | "inline" }) {
    if (placement === "inline") {
        return (
            <span
                className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                    className
                )}
            >
                <Check className="size-3" aria-hidden />
                <span className="sr-only">Seleccionado</span>
            </span>
        )
    }
    return (
        <span
            className={cn(
                "absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                className
            )}
        >
            <Check className="size-3" aria-hidden />
            <span className="sr-only">Seleccionado</span>
        </span>
    )
}

/**
 * Right rail that hosts the selection marker for the light variant. A `CardRail` that is not
 * decorative, so the SelectionCheck's sr-only "Seleccionado" is announced.
 * When not selected, shows an empty circle (affordance) that fills on selection.
 */
export function SelectionRail({ selected, children }: { selected: boolean; children?: React.ReactNode }) {
    return (
        <CardRail size="sm" tone={selected ? "primary" : "neutral"} decorative={false}>
            {children}
            {!selected && (
                <span
                    className="size-4 rounded-full border border-foreground/25 transition-colors group-hover:border-foreground/50"
                    aria-hidden="true"
                />
            )}
        </CardRail>
    )
}
