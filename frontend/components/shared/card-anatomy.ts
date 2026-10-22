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

    // ── Inline / row variant (no media strip) ──────────────────────────────────
    /** Leading slot for photo / icon / avatar — 40×40, shrinks to fit. */
    lead: "flex-shrink-0 w-10 h-10 rounded-sm overflow-hidden bg-muted",

    /** Inline body: code + title + description + footer in a horizontal flow. */
    inlineBody: "flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5",

    /** Code in inline layout — slightly larger, not truncated in same way. */
    inlineCode: "font-mono text-3xs text-muted-foreground",

    /** Title in inline layout — single line, grows to fill. */
    inlineTitle: "line-clamp-1 text-sm font-semibold leading-snug",

    /** Footer in inline layout — flex row with caption + amount + glyph. */
    inlineFooter: "flex items-end justify-between gap-3 mt-auto pt-1",

    /** Caption + amount combined for inline (qty · $price). */
    inlineAmount: "flex items-baseline gap-1 font-semibold tabular-nums text-sm",

} as const

export type CardAnatomyKey = keyof typeof cardAnatomy