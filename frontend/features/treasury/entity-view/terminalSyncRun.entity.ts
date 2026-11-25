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

/** "m:ss" entre dos instantes ISO; "—" si falta alguno (la ejecución sigue en curso). */
export function formatTerminalSyncDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—"
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (!Number.isFinite(ms) || ms < 0) return "—"
    const total = Math.round(ms / 1000)
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

const fixed = { sortable: false } as const

/** Historial de importaciones (ejecuciones de sincronización) de ventas TUU. Solo lectura. */
export const terminalSyncRunEntity = defineEntity<TerminalSyncRun>()((f) => ({
    label: "treasury.terminalsyncrun",
    fields: {
        startedAt: f.date("started_at", { ...fixed, label: "Inicio", time: true }),
        provider: f.text("provider_name", { ...fixed, label: "Proveedor" }),
        trigger: f.text((r) => TERMINAL_SYNC_TRIGGER_LABELS[r.trigger], { ...fixed, label: "Origen" }),
        range: f.text((r) => `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`, { ...fixed, label: "Rango" }),
        status: f.status((r) => terminalSyncRunStatus(r.status), { ...fixed, label: "Estado" }),
        fetched: f.number("fetched_count", { ...fixed, label: "Traídas" }),
        created: f.number("created_count", { ...fixed, label: "Nuevas" }),
        updated: f.number("updated_count", { ...fixed, label: "Actualizadas" }),
        attempts: f.number("attempts", { ...fixed, label: "Intentos" }),
        duration: f.text((r) => formatTerminalSyncDuration(r.started_at, r.finished_at), { ...fixed, label: "Duración" }),
        error: f.text((r) => terminalSyncRunDetail(r), { ...fixed, label: "Detalle", truncate: true }),
    },
    // ADR-0158 §3. No `sort`: the sync runs endpoint has no server ordering. `provider` options come from the screen.
    query: {
        // The endpoint has no text search.
        search: false,
        filters: {
            provider: { field: "provider", control: "single", options: "remote" },
            status: { field: "status", control: "single", options: [{ value: "RUNNING", label: "En curso" }, { value: "SUCCESS", label: "Exitosa" }, { value: "PARTIAL", label: "Parcial" }, { value: "FAILED", label: "Fallida" }] },
            trigger: { field: "trigger", control: "single", options: [{ value: "SCHEDULED", label: "Automática" }, { value: "MANUAL", label: "Manual" }] },
        },
        views: [
            { id: "all", label: "Todas" },
            { id: "failed", label: "Fallidas", filters: { status: "FAILED" } },
        ],
    },
}))

export const terminalSyncRunViews = terminalSyncRunEntity.views({
    table: {
        columns: ["startedAt", "provider", "trigger", "range", "status", "fetched", "created", "updated", "duration", "error"],
        primary: "startedAt",
    },
    card: {
        rail: { status: (r) => terminalSyncRunStatus(r.status).status },
        title: "provider",
        subtitle: ["range", "startedAt"],
        trailing: ["status"],
        meta: ["trigger", "fetched", "created", "updated", "duration", "error"],
    },
})
