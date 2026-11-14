import { defineEntity, type StatusValue } from "@/components/entity-view"
import type { BadgeIntent } from "@/lib/badge-resolvers"
import { RCV_MONTH_NAMES } from "../unifiedSearchDef"
import type {
    RcvAttemptOutcome,
    RcvDirection,
    RcvImport,
    RcvImportAttempt,
    RcvImportStatus,
    RcvImportSummary,
    RcvImportTrigger,
} from "../types/rcv"

export const RCV_DIRECTION_LABELS: Record<RcvDirection, string> = { PURCHASES: "Compras", SALES: "Ventas" }

export const RCV_TRIGGER_LABELS: Record<RcvImportTrigger, string> = { SCHEDULED: "Automática", MANUAL: "Manual" }

const STATUS_LABELS: Record<RcvImportStatus, string> = {
    QUEUED: "En cola",
    RUNNING: "En curso",
    SUCCESS: "Exitosa",
    FAILED: "Fallida",
}

const STATUS_INTENTS: Record<RcvImportStatus, BadgeIntent> = {
    QUEUED: "neutral",
    RUNNING: "info",
    SUCCESS: "success",
    FAILED: "destructive",
}

/** Estado de una importación; una exitosa con avisos se muestra como "Exitosa con avisos". */
export function rcvImportStatus(imp: Pick<RcvImport, "status" | "warnings">): StatusValue {
    if (imp.status === "SUCCESS" && imp.warnings.length > 0) {
        return { status: "success_warnings", label: "Exitosa con avisos", intent: "warning" }
    }
    return { status: imp.status.toLowerCase(), label: STATUS_LABELS[imp.status], intent: STATUS_INTENTS[imp.status] }
}

/** "Octubre 2026" a partir de año y mes (1–12). */
export function formatRcvPeriod(year: number, month: number): string {
    const name = RCV_MONTH_NAMES[month - 1]
    return name ? `${name} ${year}` : `${month}/${year}`
}

function formatSeconds(total: number): string {
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/** "m:ss" entre dos instantes ISO; "—" si falta alguno. */
export function formatRcvDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—"
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (!Number.isFinite(ms) || ms < 0) return "—"
    return formatSeconds(Math.round(ms / 1000))
}

/** "m:ss" a partir de milisegundos. */
export function formatRcvDurationMs(ms: number): string {
    return formatSeconds(Math.round(ms / 1000))
}

/** Error, o (si no hay) los avisos resumidos; cadena vacía si ninguno. */
export function rcvImportDetail(imp: Pick<RcvImport, "error_message" | "warnings">): string {
    if (imp.error_message) return imp.error_message
    return imp.warnings.join(" · ")
}

const fixed = { sortable: false } as const

/** Historial de importaciones del RCV (spec 2026-11-14). Solo lectura. */
export const rcvImportEntity = defineEntity<RcvImport>()((f) => ({
    label: "accounting.rcvimport",
    fields: {
        createdAt: f.date("created_at", { ...fixed, label: "Creada", time: true }),
        period: f.text((i) => formatRcvPeriod(i.year, i.month), { ...fixed, label: "Período" }),
        direction: f.text((i) => RCV_DIRECTION_LABELS[i.direction], { ...fixed, label: "Dirección" }),
        trigger: f.text((i) => RCV_TRIGGER_LABELS[i.trigger], { ...fixed, label: "Origen" }),
        status: f.status((i) => rcvImportStatus(i), { ...fixed, label: "Estado" }),
        received: f.number("received_count", { ...fixed, label: "Recibidos" }),
        created: f.number("created_count", { ...fixed, label: "Nuevos" }),
        updated: f.number("updated_count", { ...fixed, label: "Actualizados" }),
        missing: f.number("missing_count", { ...fixed, label: "Faltantes" }),
        apiKey: f.code((i) => i.masked_key ?? "", { ...fixed, label: "API key" }),
        duration: f.text((i) => formatRcvDuration(i.started_at, i.finished_at), { ...fixed, label: "Duración" }),
        detail: f.text((i) => rcvImportDetail(i), { ...fixed, label: "Detalle", truncate: true }),
    },
}))

export const rcvImportViews = rcvImportEntity.views({
    table: {
        columns: [
            "createdAt", "period", "direction", "trigger", "status",
            "received", "created", "updated", "missing", "apiKey", "duration", "detail",
        ],
        primary: "createdAt",
    },
    card: {
        rail: { status: (r) => rcvImportStatus(r).status },
        title: "period",
        subtitle: ["direction", "createdAt"],
        trailing: ["status"],
        meta: ["trigger", "received", "created", "updated", "missing", "duration", "detail"],
    },
})

/** Columna "Detalle" de un resumen del SII: cuadra cuando el detalle trae los mismos documentos y total. */
export function rcvSummaryDetail(
    s: Pick<RcvImportSummary, "has_detail" | "detail_count" | "document_count" | "detail_total" | "total_amount">,
): StatusValue {
    if (!s.has_detail) return { status: "summary_only", label: "Solo resumen", intent: "neutral" }
    const balanced = s.detail_count === s.document_count && Number(s.detail_total) === Number(s.total_amount)
    return balanced
        ? { status: "balanced", label: `${s.detail_count} docs · cuadra`, intent: "success" }
        : { status: "unbalanced", label: `${s.detail_count} docs · no cuadra`, intent: "warning" }
}

export const rcvImportSummaryEntity = defineEntity<RcvImportSummary>()((f) => ({
    title: "Resumen del SII",
    fields: {
        dteType: f.text((s) => (s.dte_type_label ? `${s.dte_type} · ${s.dte_type_label}` : String(s.dte_type)), { ...fixed, label: "Tipo" }),
        documentCount: f.number("document_count", { ...fixed, label: "Docs" }),
        exempt: f.money("exempt_amount", { ...fixed, label: "Exento" }),
        net: f.money("net_amount", { ...fixed, label: "Neto" }),
        vatRecoverable: f.money("vat_recoverable", { ...fixed, label: "IVA" }),
        total: f.money("total_amount", { ...fixed, label: "Total" }),
        detail: f.status((s) => rcvSummaryDetail(s), { ...fixed, label: "Detalle" }),
    },
}))

export const rcvImportSummaryViews = rcvImportSummaryEntity.views({
    table: { columns: ["dteType", "documentCount", "exempt", "net", "vatRecoverable", "total", "detail"] },
})

const OUTCOME_LABELS: Record<RcvAttemptOutcome, string> = {
    OK: "Exitoso",
    QUOTA_EXHAUSTED: "Sin cupo",
    RATE_LIMITED: "Límite por minuto/hora",
    AUTH_KEY: "API key rechazada",
    AUTH_SII: "Clave SII rechazada",
    TRANSIENT: "Sin respuesta",
    OTHER: "Error",
}

const OUTCOME_INTENTS: Record<RcvAttemptOutcome, BadgeIntent> = {
    OK: "success",
    QUOTA_EXHAUSTED: "warning",
    RATE_LIMITED: "warning",
    AUTH_KEY: "destructive",
    AUTH_SII: "destructive",
    TRANSIENT: "warning",
    OTHER: "destructive",
}

export function rcvAttemptOutcome(outcome: RcvAttemptOutcome): StatusValue {
    return { status: outcome.toLowerCase(), label: OUTCOME_LABELS[outcome], intent: OUTCOME_INTENTS[outcome] }
}

export const rcvImportAttemptEntity = defineEntity<RcvImportAttempt>()((f) => ({
    title: "Intentos",
    fields: {
        createdAt: f.date("created_at", { ...fixed, label: "Hora", time: true }),
        apiKey: f.code((a) => a.masked_key ?? "", { ...fixed, label: "API key" }),
        httpStatus: f.number("http_status", { ...fixed, label: "HTTP" }),
        outcome: f.status((a) => rcvAttemptOutcome(a.outcome), { ...fixed, label: "Resultado" }),
        duration: f.text((a) => formatRcvDurationMs(a.duration_ms), { ...fixed, label: "Duración" }),
        error: f.text("error_message", { ...fixed, label: "Error", truncate: true }),
    },
}))

export const rcvImportAttemptViews = rcvImportAttemptEntity.views({
    table: { columns: ["createdAt", "apiKey", "httpStatus", "outcome", "duration", "error"] },
})
