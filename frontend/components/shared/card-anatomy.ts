"use client"

/**
 * Card anatomy tokens — single source for the classes that build the body of every
 * interactive/selectable card in the POS family (ProductCard, ChoiceCard, ContactCard, MfgLineCard…).
 * Keeps the duplicated strings in one place so a design change is a one-file edit.
 */

export const cardAnatomy = {
    /** The flexible column that holds code → title → description → footer, pinned to bottom. */
    body: "flex min-w-0 flex-1 flex-col gap-1 px-3 pb-3 pt-2.5",

    /** Monospace code / RUT / number above the title. */
    code: "truncate font-mono text-3xs text-muted-foreground",

    /** Primary title line, clamped to two lines. */
    title: "line-clamp-2 text-left text-sm font-semibold leading-snug",

    /** Optional secondary description under the title. */
    description: "text-2xs leading-snug text-muted-foreground",

    /** Footer area, anchored to the bottom of the body. */
    footer: "mt-auto pt-2",

    /** Small caption inside the footer (qty, unit, "desde"). */
    caption: "text-3xs text-muted-foreground",

    /** Main amount/price in the footer, tabular numerals. */
    amount: "font-semibold tabular-nums text-lg",

    /** Decorative action glyph (add / configure / chevron) at bottom-right. */
    glyph: "h-4 w-4 shrink-0 transition-colors text-muted-foreground group-hover:text-foreground",
} as const

export type CardAnatomyKey = keyof typeof cardAnatomy