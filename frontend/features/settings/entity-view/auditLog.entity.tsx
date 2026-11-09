"use client"

import { DataCell } from "@/components/shared"
import { defineEntity, registerValueKind, type ValueRenderProps } from "@/components/entity-view"
import { format } from "date-fns"
import {
    LogIn, LogOut, Settings, ShieldAlert, FileDown, Printer, Activity,
    Plus, Minus, RefreshCw, Briefcase, Wrench, ExternalLink,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Chip } from "@/components/shared"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import type { AuditCategory } from "../hooks/useAuditLogs"

// ─── Slug → ENTITY_DRAWERS key map ───────────────────────────────────────────
// Maps the backend entity_type slug to the ENTITY_DRAWERS key ("app.model" format)

const ENTITY_TYPE_TO_DRAWER_KEY: Record<string, string> = {
    contact: "contacts.contact",
    account: "accounting.account",
    fiscal_year: "accounting.fiscalyear",
    product: "inventory.product",
    product_category: "inventory.category",
    uom: "inventory.uom",
    product_attribute: "inventory.attribute",
    warehouse: "inventory.warehouse",
    stock_move: "inventory.stockmove",
    inventory_document: "inventory.inventorydocument",
    pricing_rule: "inventory.pricingrule",
    work_order: "production.workorder",
    treasury_movement: "treasury.treasurymovement",
    treasury_account: "treasury.treasuryaccount",
    bank_statement: "treasury.bankstatement",
    pos_session: "pos.session",
    terminal_batch: "treasury.terminalbatch",
    check: "treasury.check",
    employee: "hr.employee",
    payroll: "hr.payroll",
    absence: "hr.absence",
    f29_declaration: "tax.f29declaration",
    accounting_period: "tax.accountingperiod",
}

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

// ─── auditCategory: category chip ────────────────────────────────────────────

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        auditCategory: { value: AuditCategory | null | undefined; options: Record<never, never> }
    }
}

const CATEGORY_LABEL: Record<AuditCategory, string> = {
    business: "Negocio",
    security: "Seguridad",
    technical: "Técnico",
    config: "Config",
}

const CATEGORY_INTENT: Record<AuditCategory, "neutral" | "success" | "destructive" | "info" | "warning"> = {
    business: "info",
    security: "destructive",
    technical: "neutral",
    config: "warning",
}

function AuditCategoryCell({ value }: ValueRenderProps<"auditCategory">) {
    if (!value) return null
    return (
        <Chip size="xs" intent={CATEGORY_INTENT[value]}>
            {CATEGORY_LABEL[value]}
        </Chip>
    )
}

registerValueKind("auditCategory", {
    format: (v) => (v ? CATEGORY_LABEL[v] : ""),
    render: AuditCategoryCell,
})

// ─── auditEntityLink: clickable entity cell that opens the drawer ─────────────

export interface AuditEntityValue {
    entityType: string | null
    entityId: number | null
    entityLabel: string | null
    source: "action_log" | "history"
}

declare module "@/components/entity-view/core/value-kinds" {
    interface ValueKinds {
        auditEntityLink: { value: AuditEntityValue | null; options: Record<never, never> }
    }
}

function AuditEntityLinkCell({ value }: ValueRenderProps<"auditEntityLink">) {
    const actions = useOptionalGlobalModalActions()

    if (!value) return <DataCell.Empty />

    const { entityType, entityId, entityLabel, source } = value

    // Only show for history entries or action_logs with explicit entity linkage
    const hasLabel = !!entityLabel
    if (!hasLabel) return <DataCell.Empty />

    const drawerKey = entityType ? ENTITY_TYPE_TO_DRAWER_KEY[entityType] : undefined
    const canOpen = !!(drawerKey && entityId && hasEntityDrawer(drawerKey) && actions && source === "history")

    if (canOpen && drawerKey && entityId) {
        return (
            <button
                type="button"
                className="flex items-center gap-1.5 text-left group"
                onClick={(e) => {
                    e.stopPropagation()
                    actions.openEntity(drawerKey, entityId)
                }}
            >
                <DataCell.Text className="group-hover:text-primary transition-colors underline-offset-2 group-hover:underline">
                    {entityLabel}
                </DataCell.Text>
                <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
        )
    }

    return <DataCell.Text>{entityLabel}</DataCell.Text>
}

registerValueKind("auditEntityLink", {
    format: (v) => v?.entityLabel ?? "",
    render: AuditEntityLinkCell,
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
            case "BUSINESS": return Briefcase
            case "TECHNICAL": return Wrench
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
        if (actionType === "BUSINESS") return "info"
        if (actionType === "TECHNICAL") return "neutral"
        if (actionType === "EXPORT" || actionType === "PRINT") return "info"
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
    entity_type: string | null
    entity_id: number | null
    history_type: AuditHistoryType
    source: "action_log" | "history"
    action_type: string | null
    type_label: string | null
    description: string
    category: AuditCategory
}

const fixed = { sortable: false } as const

export const auditLogEntity = defineEntity<AuditLog>()((f) => ({
    title: "Registro de auditoría",
    rowId: (r) => `${r.date}-${r.source}-${r.description.slice(0, 40)}`,
    fields: {
        date: f.value("auditTimestamp", (r) => r.date, { ...fixed, label: "Fecha y Hora" }),
        user: f.tags((r) => [r.user_name ?? "Sistema"], { ...fixed, label: "Usuario" }),
        category: f.value("auditCategory", (r) => r.category, { ...fixed, label: "Categoría" }),
        entity: f.value(
            "auditEntityLink",
            (r) => ({
                entityType: r.entity_type,
                entityId: r.entity_id,
                entityLabel: r.entity_label,
                source: r.source,
            }),
            { ...fixed, label: "Entidad" }
        ),
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
    table: { columns: ["date", "user", "category", "entity", "action", "description"] },
})
