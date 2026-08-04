/**
 * movement-icons.ts — Centralized dynamic icon resolver for movement-type entities.
 *
 * Usage pattern (in renderCard):
 *   const { icon, iconClassName } = resolveTreasuryMovementIcon(m)
 *   <AutoEntityCard icon={icon} iconClassName={iconClassName} ... />
 *
 * Eliminates the inline ternary chains that were duplicated across
 * BankMovementsClientView and TreasuryMovementsClientView.
 */

import {
    ArrowDownToLine,
    ArrowUpFromLine,
    ArrowLeftRight,
    Scale,
    Ban,
    FileEdit,
    RotateCcw,
    FileText,
    PackagePlus,
    PackageMinus,
    RefreshCw,
    type LucideIcon,
} from "lucide-react"

interface MovementIconResult {
    icon: LucideIcon
    iconClassName: string
}

// ─── Treasury / Bank movements ────────────────────────────────────────────────

type TreasuryMovementType = "INBOUND" | "OUTBOUND" | "TRANSFER" | "ADJUSTMENT" | string

interface TreasuryMovementLike {
    movement_type: TreasuryMovementType
    payment_method?: string
}

/**
 * Resolves icon + className for a treasury or bank movement.
 * Covers: INBOUND, OUTBOUND, TRANSFER, ADJUSTMENT, WRITE_OFF.
 */
export function resolveTreasuryMovementIcon(m: TreasuryMovementLike): MovementIconResult {
    const type = m.movement_type
    const isWriteOff = m.payment_method === "WRITE_OFF"

    const icon: LucideIcon = isWriteOff
        ? Ban
        : type === "INBOUND"
            ? ArrowDownToLine
            : type === "OUTBOUND"
                ? ArrowUpFromLine
                : type === "TRANSFER"
                    ? ArrowLeftRight
                    : Scale

    const iconClassName = isWriteOff
        ? "text-muted-foreground/50 bg-muted/50"
        : type === "INBOUND"
            ? "text-success bg-success/10"
            : type === "OUTBOUND"
                ? "text-destructive bg-destructive/10"
                : "text-warning bg-warning/10"

    return { icon, iconClassName }
}

// ─── Accounting / Journal entries ─────────────────────────────────────────────

interface JournalEntryLike {
    is_manual: boolean
    reversal_of?: { id: number } | null
}

/**
 * Resolves icon + className for a journal entry.
 * Manual → pencil (info), Reversal → rotate (warning), Auto → document (success).
 */
export function resolveJournalEntryIcon(e: JournalEntryLike): MovementIconResult {
    const icon: LucideIcon = e.is_manual ? FileEdit : e.reversal_of ? RotateCcw : FileText
    const iconClassName = e.is_manual
        ? "text-info bg-info/10"
        : e.reversal_of
            ? "text-warning bg-warning/10"
            : "text-success bg-success/10"
    return { icon, iconClassName }
}

// ─── Inventory / Stock movements ──────────────────────────────────────────────

type StockMoveDirection = "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT" | "OTHER" | string

interface StockMoveLike {
    direction?: StockMoveDirection
}

/**
 * Resolves icon + className for a stock movement by its `direction`.
 * IN → entry (success), OUT → exit (destructive), TRANSFER → move (info),
 * ADJUSTMENT → refresh (warning), OTHER → neutral.
 */
export function resolveStockMoveIcon(m: StockMoveLike): MovementIconResult {
    const type = m.direction

    const icon: LucideIcon =
        type === "IN"
            ? PackagePlus
            : type === "OUT"
                ? PackageMinus
                : type === "TRANSFER"
                    ? ArrowLeftRight
                    : type === "ADJUSTMENT"
                        ? RefreshCw
                        : ArrowLeftRight

    const iconClassName =
        type === "IN"
            ? "text-success bg-success/10"
            : type === "OUT"
                ? "text-destructive bg-destructive/10"
                : type === "TRANSFER"
                    ? "text-info bg-info/10"
                    : type === "ADJUSTMENT"
                        ? "text-warning bg-warning/10"
                        : "text-muted-foreground bg-muted/10"

    return { icon, iconClassName }
}
