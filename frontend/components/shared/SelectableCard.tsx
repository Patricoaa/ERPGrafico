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

export interface SelectableCardState {
    selected?: boolean
    /** Cannot be picked: disabled by the caller or ruled out by the data. */
    unavailable?: boolean
}

/** Surface classes for a pressable card. Compose with layout classes (`h-full`, `p-0`…) at the call site. */
export function selectableCardClass({ selected = false, unavailable = false }: SelectableCardState = {}): string {
    return cn(
        "group relative flex flex-col overflow-hidden rounded-md border border-border bg-card text-left shadow-none transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        unavailable
            ? "cursor-not-allowed border-border/60 bg-muted/40 opacity-50"
            : "cursor-pointer hover:border-foreground/30 ribbon-cmyk",
        !unavailable && !selected && "ribbon-cmyk-hover",
        selected && "border-primary ring-1 ring-primary"
    )
}

/** Check chip for the media strip of a selected card (bottom-right by default). */
export function SelectionCheck({ className }: { className?: string }) {
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
