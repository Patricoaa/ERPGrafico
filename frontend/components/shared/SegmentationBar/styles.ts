// ─── Shared typography & layout tokens for DataTable toolbar / segmentation ───
// All consumers (shared + route-specific) MUST import from here.
// This is the single source of truth — never inline these values.

export const SEG_TEXT = 'text-xs font-semibold'

export const SEG_WRAPPER =
  'flex items-center shrink-0 bg-background rounded-sm px-1 h-9'

export const SEG_TRIGGER =
  'h-7 px-2 text-xs font-semibold tracking-tight gap-1 rounded-sm shrink-0'

export const SEG_ACTIVE = 'bg-accent/50 text-foreground'
export const SEG_INACTIVE = 'text-muted-foreground hover:text-foreground'

export const SEG_DROPDOWN_ITEM = 'text-xs font-semibold'

export const SEG_MENU_ITEM =
  'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs font-semibold outline-none hover:bg-accent hover:text-accent-foreground transition-colors'

export const SEG_CHECKBOX =
  'mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-all'

export const SEG_INPUT =
  'h-7 text-xs font-semibold rounded-sm border-border/60 px-2'

export const TOOLBAR_ICON_BTN = 'h-9 w-9 shrink-0'

export const TOOLBAR_MENU_ITEM =
  'relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-xs font-semibold outline-none transition-colors'

export const TAB_TOOLBAR_TRIGGER =
  'h-7 px-2.5 text-xs font-semibold tracking-tight gap-1.5'
