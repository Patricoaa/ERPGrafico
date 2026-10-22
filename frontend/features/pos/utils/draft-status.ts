"use client"

/**
 * Shared helpers for displaying draft status across the POS UI
 * (top strip + DraftCartsClientView list).
 * Single source of truth for: number formatting, state priority, chip config.
 */

import { Lock, Wallet, ClipboardCheck, Loader2 } from "lucide-react"
import type { SyncDraft } from "../hooks/useDraftSync"
import type { LucideIcon } from "lucide-react"

export interface DraftStatusChip {
    key: string
    label: string
    intent: "destructive" | "warning" | "primary" | "success" | "neutral"
    icon: LucideIcon
}

/**
 * Format the display number for a draft.
 * Uses session_local_id (1, 2, 3...) when available (>0), falls back to DB id.
 * Returns e.g. "#3"
 */
export function formatDraftNumber(draft: SyncDraft | { session_local_id?: number; id: number }): string {
    // Treat 0 or undefined/null as missing — legacy rows may have 0
    const n = (draft.session_local_id && draft.session_local_id > 0) ? draft.session_local_id : draft.id
    return `#${n}`
}

/**
 * Resolve the ordered list of status chips for a draft.
 * Priority (highest first):
 *   1. Locked by another user  → En uso (destructive, Lock)
 *   2. isWaitingPayment        → Por Pagar (warning, Wallet)
 *   3. wizard_state.step       → P{n} (warning, ClipboardCheck) — shown even when waiting payment
 *   4. isWaitingApproval       → Auth (primary, Loader2)
 *   5. isApproved              → OK (success, ClipboardCheck)
 *
 * The "Tú" chip (own lock) is intentionally omitted — it's shown
 * only in the full list view (DraftCartsClientView) where there's room.
 */
export function resolveDraftStatuses(
    draft: SyncDraft,
    _opts?: { isOwnLock?: boolean }
): DraftStatusChip[] {
    const ws = draft.wizard_state
    const chips: DraftStatusChip[] = []

    // 1. Locked by someone else — strongest signal
    if (draft.is_locked && draft.locked_by_name) {
        chips.push({
            key: "locked",
            label: "En uso",
            intent: "destructive",
            icon: Lock,
        })
    }

    // 2. Waiting for payment
    if (ws?.isWaitingPayment) {
        chips.push({
            key: "waiting_payment",
            label: "Por Pagar",
            intent: "warning",
            icon: Wallet,
        })
    }

    // 3. Wizard step (P1, P2, P3...) — shown even when waiting for payment
    if (ws?.step) {
        chips.push({
            key: `step_${ws.step}`,
            label: `P${ws.step}`,
            intent: "warning",
            icon: ClipboardCheck,
        })
    }

    // 4. Waiting for approval
    if (ws?.isWaitingApproval) {
        chips.push({
            key: "waiting_approval",
            label: "Auth",
            intent: "primary",
            icon: Loader2,
        })
    }

    // 5. Approved
    if (ws?.isApproved) {
        chips.push({
            key: "approved",
            label: "OK",
            intent: "success",
            icon: ClipboardCheck,
        })
    }

    return chips
}

/**
 * Get the single highest-priority chip for compact contexts (top strip).
 * Returns null if no status applies.
 */
export function getPrimaryDraftStatus(
    draft: SyncDraft
): DraftStatusChip | null {
    return resolveDraftStatuses(draft)[0] ?? null
}