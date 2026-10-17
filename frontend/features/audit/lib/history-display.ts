import { Plus, Edit, Trash2, type LucideIcon } from "lucide-react"
import type { BadgeIntent } from "@/lib/badge-resolvers"
import { type HistoricalRecord } from "@/types/audit"
import {
    translateStatus,
    translateProductionStage,
    translateSalesChannel,
    translateReceivingStatus,
    translateProductType,
    translatePaymentMethod
} from "@/lib/utils"

/**
 * history-display.ts
 *
 * Single source of truth for how a django-simple-history record is presented:
 * operation semantics (intent/icon) and value formatting.
 *
 * Pure data + pure functions — no JSX, no styles.
 * Consumers: ActivitySidebar, AuditTimeline.
 */

export interface HistoryOperation {
    /** Semantic status key handed to StatusBadge (intent below overrides its resolution) */
    status: string
    intent: BadgeIntent
    icon: LucideIcon
    /** Uppercase noun, e.g. "Creación" */
    label: string
    /** Past-tense verb as it reads in a sentence, e.g. "creó" */
    verb: string
}

export const HISTORY_OPERATIONS: Record<string, HistoryOperation> = {
    '+': { status: 'CREATED', intent: 'success', icon: Plus, label: 'Creación', verb: 'creó' },
    '~': { status: 'UPDATED', intent: 'info', icon: Edit, label: 'Edición', verb: 'editó' },
    '-': { status: 'DELETED', intent: 'destructive', icon: Trash2, label: 'Eliminación', verb: 'eliminó' },
}

export const FALLBACK_HISTORY_OPERATION: HistoryOperation = {
    status: 'CHANGED',
    intent: 'neutral',
    icon: Edit,
    label: 'Cambio',
    verb: 'modificó',
}

export function resolveHistoryOperation(type: string): HistoryOperation {
    return HISTORY_OPERATIONS[type] ?? FALLBACK_HISTORY_OPERATION
}

export const IGNORED_HISTORY_FIELDS = [
    'id', 'created_at', 'updated_at',
    'history_id', 'history_date', 'history_type',
    'history_user_id', 'history_user_username', 'history_change_reason',
]

/**
 * Compares two snapshots and returns the field names that differ.
 * Objects/arrays are compared by serialized value so unchanged JSON
 * payloads do not register as edits.
 */
export function getChangedFields(
    current: HistoricalRecord,
    previous?: HistoricalRecord,
    ignoredFields: string[] = IGNORED_HISTORY_FIELDS
): string[] {
    if (!previous) return []

    const changed: string[] = []
    Object.keys(current).forEach(key => {
        if (ignoredFields.includes(key)) return

        const next = current[key]
        const prev = previous[key]
        const serializedNext = next !== null && typeof next === 'object' ? JSON.stringify(next) : next
        const serializedPrev = prev !== null && typeof prev === 'object' ? JSON.stringify(prev) : prev

        if (serializedNext !== serializedPrev) changed.push(key)
    })
    return changed
}

/**
 * Renders a raw history value for display: empty sentinels, booleans and the
 * enum-ish fields that have human translations. No truncation — callers
 * truncate with CSS and expose the full value via title.
 */
export function formatHistoryValue(fieldName: string, val: unknown): string {
    if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) return 'vacío'
    if (typeof val === 'boolean') return val ? 'Sí' : 'No'

    let displayVal = String(val)
    if (typeof val === 'string') {
        const f = fieldName.toLowerCase()
        if (f.includes('status') || f.includes('state')) displayVal = translateStatus(val)
        else if (f.includes('stage')) displayVal = translateProductionStage(val)
        else if (f.includes('channel')) displayVal = translateSalesChannel(val)
        else if (f.includes('method')) displayVal = translatePaymentMethod(val)
        else if (f.includes('receiving')) displayVal = translateReceivingStatus(val)
        else if (f.includes('type') && val.match(/^[A-Z_]+$/)) displayVal = translateProductType(val)
    }

    return displayVal
}
