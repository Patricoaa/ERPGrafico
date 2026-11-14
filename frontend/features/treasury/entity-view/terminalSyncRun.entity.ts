import { defineEntity, formatDate, type StatusValue } from "@/components/entity-view"
import type { BadgeIntent } from "@/lib/badge-resolvers"
import type { TerminalSyncRun, TerminalSyncRunStatus, TerminalSyncTrigger } from "../types"

export const TERMINAL_SYNC_TRIGGER_LABELS: Record<TerminalSyncTrigger, string> = {
    SCHEDULED: "Automática",
    MANUAL: "Manual",
}

export const TERMINAL_SYNC_RUN_STATUS_LABELS: Record<TerminalSyncRunStatus, string> = {
    RUNNING: "En curso",
    SUCCESS: "Exitosa",
    PARTIAL: "Parcial",
    FAILED: "Fallida",
}

const STATUS_INTENTS: Record<TerminalSyncRunStatus, BadgeIntent> = {
    RUNNING: "info",
    SUCCESS: "success",
    PARTIAL: "warning",
    FAILED: "destructive",
}

export function terminalSyncRunStatus(status: TerminalSyncRunStatus): StatusValue {
    return { status: status.toLowerCase(), label: TERMINAL_SYNC_RUN_STATUS_LABELS[status], intent: STATUS_INTENTS[status] }
}

/** Error message, or (when empty) the run warnings summarized; empty string when neither. */
export function terminalSyncRunDetail(run: { error_message: string; warnings: string[] }): string {
    if (run.error_message) return run.error_message
    if (run.warnings.length === 0) return ""
    return `${run.warnings.length} aviso(s): ${run.warnings.join(" · ")}`
}

const fixed = { sortable: false } as const

/** Read-only history of TUU sync runs (spec 2026-11-13). */
export const terminalSyncRunEntity = defineEntity<TerminalSyncRun>()((f) => ({
    title: "Ejecuciones de sincronización",
    fields: {
        startedAt: f.date("started_at", { ...fixed, label: "Inicio", time: true }),
        provider: f.text("provider_name", { ...fixed, label: "Proveedor" }),
        trigger: f.text((r) => TERMINAL_SYNC_TRIGGER_LABELS[r.trigger], { ...fixed, label: "Origen" }),
        range: f.text((r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`, { ...fixed, label: "Rango" }),
        status: f.status((r) => terminalSyncRunStatus(r.status), { ...fixed, label: "Estado" }),
        fetched: f.number("fetched_count", { ...fixed, label: "Traídas" }),
        created: f.number("created_count", { ...fixed, label: "Nuevas" }),
        updated: f.number("updated_count", { ...fixed, label: "Actualizadas" }),
        error: f.text((r) => terminalSyncRunDetail(r), { ...fixed, label: "Detalle", truncate: true }),
    },
}))

export const terminalSyncRunViews = terminalSyncRunEntity.views({
    table: {
        columns: ["startedAt", "provider", "trigger", "range", "status", "fetched", "created", "updated", "error"],
        primary: "startedAt",
    },
})
