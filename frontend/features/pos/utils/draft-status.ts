"use client"

/**
 * Shared helpers for displaying draft status across the POS UI
 * (top strip + DraftCartsClientView list).
 * Single source of truth for: number formatting, state priority, chip config.
 */

import { Lock, Wallet, ShieldAlert, CheckCircle2, ShoppingCart, User, FileWarning, Factory, Truck } from "lucide-react"
import type { SyncDraft } from "../hooks/useDraftSync"
import type { LucideIcon } from "lucide-react"

export interface DraftPhase {
    id: string
    label: string
    icon: LucideIcon
}

export const DRAFT_PHASES: DraftPhase[] = [
    { id: "cart", label: "Carrito", icon: ShoppingCart },
    { id: "customer", label: "Cliente", icon: User },
    { id: "dte", label: "Documento", icon: FileWarning },
    { id: "manufacturing", label: "Fabricación", icon: Factory },
    { id: "delivery", label: "Entrega", icon: Truck },
    { id: "payment", label: "Pago", icon: Wallet },
]

export interface DraftStatus {
    icon: LucideIcon
    tone: "destructive" | "warning" | "success" | "muted" | "primary"
    label: string
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
 * Resolve the phase for a draft.
 * Uses phaseId (exact, from wizard); fallback to step-based heuristic for legacy drafts.
 */
export function resolveDraftPhase(draft: SyncDraft): DraftPhase | null {
    const ws = draft.wizard_state
    if (ws?.phaseId) {
        const phase = DRAFT_PHASES.find(p => p.id === ws.phaseId)
        if (phase) return phase
    }
    // Legacy fallback based on step
    if (ws?.step) {
        const stepMap: Record<number, string> = {
            1: "customer",
            2: "dte",
            3: "delivery",
            4: "payment",
            5: "payment",
        }
        // Adjust for manufacturing step if present (step 3=manufacturing, 4=delivery, 5=payment)
        // We can't know for sure without phaseId, so assume no manufacturing for legacy
        const legacyPhaseId = stepMap[ws.step]
        if (legacyPhaseId) {
            const phase = DRAFT_PHASES.find(p => p.id === legacyPhaseId)
            if (phase) return phase
        }
    }
    return null
}

/**
 * Resolve the single highest-priority status for a draft.
 * Priority:
 *   1. Locked by another user → En uso (destructive, Lock)
 *   2. Waiting for approval → Esperando aprobación (warning, ShieldAlert)
 *   3. Approved → Aprobado (success, CheckCircle2)
 *   4. Phase = payment & isWaitingPayment → Pendiente de pago (warning, Wallet)
 *   5. Other phase → fase (muted, icono de fase)
 *   6. None → null
 *
 * Lock propio ("Tú") is intentionally omitted — shown only in the full list.
 */
export function resolveDraftStatus(
    draft: SyncDraft,
    opts?: { isOwnLock?: boolean }
): DraftStatus | null {
    const ws = draft.wizard_state

    // 1. Locked by someone else — strongest signal
    if (draft.is_locked && draft.locked_by_name && !opts?.isOwnLock) {
        return {
            icon: Lock,
            tone: "destructive",
            label: `En uso por ${draft.locked_by_name}`
        }
    }

    // 2. Waiting for approval
    if (ws?.isWaitingApproval) {
        return {
            icon: ShieldAlert,
            tone: "warning",
            label: "Esperando aprobación"
        }
    }

    // 3. Approved
    if (ws?.isApproved) {
        return {
            icon: CheckCircle2,
            tone: "success",
            label: "Aprobado"
        }
    }

    // 4. Phase = payment & waiting for payment
    const phase = resolveDraftPhase(draft)
    if (ws?.isWaitingPayment && phase?.id === "payment") {
        return {
            icon: Wallet,
            tone: "warning",
            label: "Pendiente de pago"
        }
    }

    // 5. Other phase
    if (phase) {
        return {
            icon: phase.icon,
            tone: "muted",
            label: `Fase: ${phase.label}`
        }
    }

    return null
}

/**
 * Resolve all status chips for the full list view (DraftCartsClientView).
 * Returns array ordered by priority. Includes own-lock chip ("Tú").
 */
export function resolveDraftStatusChips(
    draft: SyncDraft,
    opts?: { isOwnLock?: boolean }
): Array<{ key: string; icon: LucideIcon; intent: "destructive" | "warning" | "success" | "primary" | "neutral"; label: string }> {
    const ws = draft.wizard_state
    const chips: Array<{ key: string; icon: LucideIcon; intent: "destructive" | "warning" | "success" | "primary" | "neutral"; label: string }> = []

    // 1. Locked by another user
    if (draft.is_locked && draft.locked_by_name && !opts?.isOwnLock) {
        chips.push({ key: "locked", icon: Lock, intent: "destructive", label: `En uso por ${draft.locked_by_name}` })
    }

    // 2. Own lock
    if (opts?.isOwnLock) {
        chips.push({ key: "own_lock", icon: Lock, intent: "primary", label: "Tú" })
    }

    // 3. Waiting for approval
    if (ws?.isWaitingApproval) {
        chips.push({ key: "waiting_approval", icon: ShieldAlert, intent: "warning", label: "Esperando aprobación" })
    }

    // 4. Approved
    if (ws?.isApproved) {
        chips.push({ key: "approved", icon: CheckCircle2, intent: "success", label: "Aprobado" })
    }

    // 5. Phase-based
    const phase = resolveDraftPhase(draft)
    if (ws?.isWaitingPayment && phase?.id === "payment") {
        // "Por Pagar" replaces the phase chip when in payment phase
        chips.push({ key: "waiting_payment", icon: Wallet, intent: "warning", label: "Por Pagar" })
    } else if (phase) {
        chips.push({ key: `phase_${phase.id}`, icon: phase.icon, intent: "neutral", label: phase.label })
    }

    return chips
}

/**
 * Map tone string to background CSS class for the top strip button.
 */
export function statusToneBg(tone: DraftStatus["tone"]): string {
    switch (tone) {
        case "destructive": return "bg-destructive/10"
        case "warning": return "bg-warning/10"
        case "success": return "bg-success/10"
        case "primary": return "bg-primary/10"
        case "muted":
        default: return "bg-muted/40"
    }
}

/**
 * Map tone string to text/icon color class.
 */
export function statusToneText(tone: DraftStatus["tone"]): string {
    switch (tone) {
        case "destructive": return "text-destructive"
        case "warning": return "text-warning"
        case "success": return "text-success"
        case "primary": return "text-primary"
        case "muted":
        default: return "text-muted-foreground"
    }
}