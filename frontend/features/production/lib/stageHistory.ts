import { type LucideIcon, ArrowRightCircle, CheckCircle2, ClipboardCheck, Factory, History, Pencil, Plus, Printer, RotateCcw, StickyNote } from "lucide-react"
import { STAGES_REGISTRY, type StageId } from "../constants/stages"
import { TASK_TYPE_TO_STAGE } from "./stageEvidence"
import type { WorkOrderHistoryEntry, WorkOrderTask } from "../types"

export interface HistoryItem {
    key: string
    stageId: string
    stageLabel: string
    kind: "approved" | "reopened" | "entered" | "edited" | "note"
    confirmations?: Record<string, boolean>
    userName: string | null
    notes: string
    attachments: { id: number; file: string; original_filename: string }[]
    createdAt: string
}

export const HISTORY_KIND: Record<HistoryItem["kind"], { icon: LucideIcon; label: string; toneClasses: string; tone: string }> = {
    approved: { icon: CheckCircle2, label: "Aprobada", toneClasses: "border-success/40 bg-success/10 text-success", tone: "text-success" },
    reopened: { icon: RotateCcw, label: "Etapa reabierta", toneClasses: "border-warning/40 bg-warning/10 text-warning", tone: "text-warning" },
    entered: { icon: ArrowRightCircle, label: "Etapa iniciada", toneClasses: "border-border bg-muted text-muted-foreground", tone: "text-muted-foreground" },
    edited: { icon: Pencil, label: "Editada con la etapa cerrada", toneClasses: "border-info/40 bg-info/10 text-info", tone: "text-info" },
    note: { icon: StickyNote, label: "Registro", toneClasses: "border-border bg-muted text-muted-foreground", tone: "text-muted-foreground" },
}

const EVENT_TO_KIND: Record<string, HistoryItem["kind"]> = {
    ENTERED: "entered",
    REOPENED: "reopened",
    EDITED: "edited",
    NOTE: "note",
}

export const CONFIRMATION_LABELS: Record<string, { label: string; description: string }> = {
    design_approved: { label: "¿El cliente aprobó el diseño?", description: "Marque si existe aprobación del cliente" },
}

export function getStageMetadata(stageId: string): { label: string; icon: LucideIcon } {
    const meta = STAGES_REGISTRY[stageId as StageId]
    if (meta) return { label: meta.label, icon: meta.icon }
    if (stageId === "ORIGIN_SELECTION") return { label: "Origen de Fabricación", icon: Factory }
    if (stageId === "SALE_ORDER_PRODUCT") return { label: "Selección de OV y Producto", icon: ClipboardCheck }
    if (stageId === "PRODUCT_SELECTION") return { label: "Selección de Producto", icon: Plus }
    if (stageId === "MFG_CONFIG") return { label: "Configurar Fabricación", icon: Printer }
    return { label: stageId, icon: History }
}

export function assignee(t: WorkOrderTask): string | null {
    return t.assigned_to_data?.username
        ?? t.assigned_group_name
        ?? (typeof t.data?.candidate_group === "string" ? t.data.candidate_group : null)
}

export function buildHistory(
    tasksForHistory: WorkOrderTask[],
    stageEntries: WorkOrderHistoryEntry[],
): HistoryItem[] {
    const items: HistoryItem[] = [
        ...tasksForHistory.flatMap((t) => {
            const stageId = TASK_TYPE_TO_STAGE[t.task_type]
                ?? (t.task_type === "OT_CREATION" ? "MATERIAL_ASSIGNMENT"
                : t.task_type.startsWith("OT_") && t.task_type.endsWith("_APPROVAL") ? t.task_type.slice(3, -9)
                : t.task_type)
            const meta = getStageMetadata(stageId)
            return (t.events_data ?? []).map((e): HistoryItem => ({
                key: `event-${e.id}`,
                stageId,
                stageLabel: meta.label,
                kind: e.action === "COMPLETED" ? "approved" : "reopened",
                userName: e.user_name,
                notes: e.notes,
                confirmations: e.confirmations,
                attachments: e.attachments_data,
                createdAt: e.created_at,
            }))
        }),
        ...stageEntries.map((h): HistoryItem => {
            const meta = getStageMetadata(h.stage)
            return {
                key: `stage-${h.id}`,
                stageId: h.stage,
                stageLabel: meta.label,
                kind: EVENT_TO_KIND[h.event ?? "ENTERED"] ?? "entered",
                userName: h.user_name ?? null,
                notes: h.notes ?? "",
                attachments: [],
                createdAt: h.created_at,
            }
        }),
    ]
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
