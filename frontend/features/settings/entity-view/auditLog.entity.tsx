"use client"

import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { format } from "date-fns"
import {
    LogIn, LogOut, Settings, ShieldAlert, FileDown, Printer, Activity,
    Plus, Minus, RefreshCw,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Chip } from "@/components/shared"

// ─── auditTimestamp: two-line date + time ─────────────────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        auditTimestamp: { value: string | null | undefined; options: Record<never, never> }
    }
}

function AuditTimestampCell({ value }: ValueRenderProps<"auditTimestamp">) {
    if (!value) return null
    const date = new Date(value)
    return (
        <div className="flex flex-col">
            <DataCell.Text>{format(date, "dd/MM/yyyy")}</DataCell.Text>
            <DataCell.Secondary>{format(date, "HH:mm:ss")}</DataCell.Secondary>
        </div>
    )
}

registerValueKind("auditTimestamp", {
    format: (v) => (v ? format(new Date(v), "dd/MM/yyyy HH:mm:ss") : ""),
    render: AuditTimestampCell,
})

// ─── auditAction: icon + intent-colored chip ──────────────────────────────────

export type AuditHistoryType = "+" | "~" | "-" | null

export interface AuditActionValue {
    actionType?: string | null
    historyType?: AuditHistoryType
    source: "action_log" | "history"
    typeLabel?: string | null
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        auditAction: { value: AuditActionValue | null; options: Record<never, never> }
    }
}

function getAuditIcon(actionType: string | null | undefined, source: string, historyType: string | null | undefined): LucideIcon {
    if (source === "action_log") {
        switch (actionType) {
            case "LOGIN": return LogIn
            case "LOGOUT": return LogOut
            case "SETTINGS_CHANGE": return Settings
            case "SECURITY": return ShieldAlert
            case "EXPORT": return FileDown
            case "PRINT": return Printer
            default: return Activity
        }
    }
    switch (historyType) {
        case "+": return Plus
        case "~": return RefreshCw
        case "-": return Minus
        default: return Activity
    }
}

function getAuditIntent(actionType: string | null | undefined, source: string, historyType: string | null | undefined): "neutral" | "success" | "destructive" | "info" | "warning" {
    if (source === "action_log") {
        if (actionType === "LOGIN") return "success"
        if (actionType === "SECURITY") return "destructive"
    } else {
        if (historyType === "+") return "info"
        if (historyType === "~") return "warning"
        if (historyType === "-") return "destructive"
    }
    return "neutral"
}

function AuditActionCell({ value }: ValueRenderProps<"auditAction">) {
    if (!value) return null
    const { actionType, historyType, source, typeLabel } = value
    const icon = getAuditIcon(actionType, source, historyType)
    const intent = getAuditIntent(actionType, source, historyType)
    const label = typeLabel ?? (
        historyType === "+" ? "Creación" :
        historyType === "~" ? "Edición" :
        historyType === "-" ? "Eliminación" : "Cambio"
    )
    return (
        <div className="flex items-center gap-2">
            <DataCell.Icon icon={icon} />
            <Chip size="xs" intent={intent}>{label}</Chip>
        </div>
    )
}

registerValueKind("auditAction", {
    format: (v) => {
        if (!v) return ""
        return v.typeLabel ?? (
            v.historyType === "+" ? "Creación" :
            v.historyType === "~" ? "Edición" :
            v.historyType === "-" ? "Eliminación" : "Cambio"
        )
    },
    render: AuditActionCell,
})

// ─── Entity ──────────────────────────────────────────────────────────────────

export interface AuditLog {
    date: string
    user_name: string | null
    entity_label: string | null
    history_type: AuditHistoryType
    source: "action_log" | "history"
    action_type: string | null
    type_label: string | null
    description: string
}

const fixed = { sortable: false } as const

export const auditLogEntity = defineEntity<AuditLog>()((f) => ({
    title: "Registro de auditoría",
    rowId: (r) => `${r.date}-${r.source}-${r.description.slice(0, 40)}`,
    fields: {
        date: f.value("auditTimestamp", (r) => r.date, { ...fixed, label: "Fecha y Hora" }),
        user: f.tags((r) => [r.user_name ?? "Sistema"], { ...fixed, label: "Usuario" }),
        entity: f.tags((r) => [r.entity_label ?? "Sistema"], { ...fixed, label: "Entidad" }),
        action: f.value("auditAction", (r) => ({
            actionType: r.action_type,
            historyType: r.history_type,
            source: r.source,
            typeLabel: r.type_label,
        }), { ...fixed, label: "Acción" }),
        description: f.text("description", { ...fixed, label: "Descripción" }),
    },
}))

export const auditLogViews = auditLogEntity.views({
    table: { columns: ["date", "user", "entity", "action", "description"] },
})
