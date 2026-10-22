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

    // ── Entity item (EntityCard header + data pairs) ──────────────────────────────
    /** Lead container shared by every card (CardLead): rounded-sm, clipped, positioned for fill images. */
    leadBase: "relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm",
    /** CardLead sizes. `md` matches `lead` (40px), `sm` is for dense items (32px). */
    leadSize: { sm: "w-8", md: "w-10" },
    /** Title of an entity item header — one line, semibold like every other card title. */
    entityTitle: "truncate text-sm font-semibold leading-tight tracking-tight",
    /** Secondary line under an entity title. */
    entitySubtitle: "mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground",
    /** Label of a label/value pair (EntityCard.Field / Meta / Metrics). Full muted contrast, no /60 wash. */
    eyebrow: "text-3xs font-semibold uppercase tracking-wider text-muted-foreground",
    /** Footer value slot: the amount of an entity card, same scale as `amount` (whatever the cell renders). */
    amountSlot: "tabular-nums [&_*]:text-lg! [&_*]:font-semibold! [&_*]:justify-start!",
    /** Value of a label/value pair. */
    fieldValue: "text-xs font-medium tabular-nums tracking-tight text-foreground",

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

    // ── Light variant (no media strip, icon lead + text + right rail) ──────────────
    /** Leading slot for icon — full-height transparent column (w-10), icon centered. */
    lightLead: "flex w-10 shrink-0 items-center justify-center self-stretch",
    /** Light body: title + description in a compact column. */
    lightBody: "flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pl-3 pr-2",
    /** Title in light variant — single line, clamped. */
    lightTitle: "line-clamp-1 text-left text-sm font-semibold leading-snug",
    /** Description in light variant — up to 2 lines, muted. */
    lightDescription: "line-clamp-2 text-2xs leading-snug text-muted-foreground",
    // ── Rail (trailing full-height column, see CardRail) ───────────────────────────
    /** Base of every rail: hairline divider on its leading edge, centered content. */
    rail: "flex shrink-0 items-center justify-center self-stretch border-l transition-colors",
    /** Rail widths: `sm` hosts a selection marker, `md` a state icon. */
    railSize: { sm: "w-9", md: "w-14" },
    /** Surface for light variant — visible border + subtle shadow (control-level, not card-level). */
    lightSurface: "border-foreground/20 shadow-xs",

} as const

export type CardAnatomyKey = keyof typeof cardAnatomy