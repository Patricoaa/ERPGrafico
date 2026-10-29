"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, ArrowRightCircle, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, Factory, History, MessageSquare, Paperclip, Pencil, Plus, Printer, RotateCcw, StickyNote, User, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentAttachmentDropzone, EmptyState, LabeledCheckbox, LabeledInput, StatusBadge } from "@/components/shared"
import { cn, formatPlainDate } from "@/lib/utils"
import type { TaskAttachment } from "@/features/workflow"
import type { WorkOrderHistoryEntry, WorkOrderTask } from "../types"
import { STAGES_REGISTRY, type StageId } from "../constants/stages"
import { TASK_TYPE_TO_STAGE } from "../lib/stageEvidence"


interface StageActivityPanelProps {
    /** The stage currently being viewed in the wizard. */
    currentStageId?: string
    /** Approval tasks of the viewed stage (pending AND completed). Only present if the viewed stage has approvals. */
    tasks: WorkOrderTask[]
    /** All tasks across all stages of the work order (used to build full activity history). */
    allTasks?: WorkOrderTask[]
    /** All `stage_history` entries of the work order (across all stages). */
    stageEntries: WorkOrderHistoryEntry[]
    canComplete: (task: WorkOrderTask) => boolean
    /** The stage is the one the order is in and still open: evidence can be added. */
    actionable: boolean
    taskNotes: Record<string | number, string>
    taskFiles: Record<string | number, File | null>
    taskConfirmations: Record<string | number, Record<string, boolean>>
    onNoteChange: (taskId: string | number, note: string) => void
    onFileChange: (taskId: string | number, file: File | null) => void
    onConfirmationChange: (taskId: string | number, key: string, value: boolean) => void
}

const CONFIRMATION_LABELS: Record<string, { label: string; description: string }> = {
    design_approved: { label: "¿El cliente aprobó el diseño?", description: "Marque si existe aprobación del cliente" },
}

interface HistoryItem {
    key: string
    stageId: string
    stageLabel: string
    kind: "approved" | "reopened" | "entered" | "edited" | "note"
    confirmations?: Record<string, boolean>
    userName: string | null
    notes: string
    attachments: TaskAttachment[]
    createdAt: string
}

function getStageMetadata(stageId: string): { label: string; icon: LucideIcon } {
    const meta = STAGES_REGISTRY[stageId as StageId]
    if (meta) {
        return { label: meta.label, icon: meta.icon }
    }
    if (stageId === "ORIGIN_SELECTION") return { label: "Origen de Fabricación", icon: Factory }
    if (stageId === "SALE_ORDER_PRODUCT") return { label: "Selección de OV y Producto", icon: ClipboardCheck }
    if (stageId === "PRODUCT_SELECTION") return { label: "Selección de Producto", icon: Plus }
    if (stageId === "MFG_CONFIG") return { label: "Configurar Fabricación", icon: Printer }
    return { label: stageId, icon: History }
}

const HISTORY_KIND: Record<HistoryItem["kind"], { icon: LucideIcon; label: string; tone: string }> = {
    approved: { icon: CheckCircle2, label: "Aprobada", tone: "text-success" },
    reopened: { icon: RotateCcw, label: "Etapa reabierta", tone: "text-warning" },
    entered: { icon: ArrowRightCircle, label: "Etapa iniciada", tone: "text-muted-foreground" },
    edited: { icon: Pencil, label: "Editada con la etapa cerrada", tone: "text-info" },
    note: { icon: StickyNote, label: "Registro", tone: "text-muted-foreground" },
}

const STATUS_TO_KIND: Record<string, HistoryItem["kind"]> = {
    ENTERED: "entered",
    REOPENED: "reopened",
    EDITED: "edited",
    NOTE: "note",
}

const time = (iso: string) => {
    const d = new Date(iso)
    return `${formatPlainDate(iso.slice(0, 10))} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
}

const assignee = (t: WorkOrderTask) =>
    t.assigned_to_data?.username
    ?? t.assigned_group_name
    ?? (typeof t.data?.candidate_group === "string" ? t.data.candidate_group : null)

/**
 * Docked at the bottom of a step: two independent collapsibles.
 *   1. Aprobación — confirmations, note, evidence upload (auto-opens when mandatory fields present).
 *   2. Historial  — event timeline (approvals, reopenings, stage entries).
 * A permanent border-bottom on the approval panel separates the two visually.
 */
export function StageActivityPanel({
    currentStageId,
    tasks, allTasks, stageEntries, canComplete, actionable, taskNotes, taskFiles, taskConfirmations,
    onNoteChange, onFileChange, onConfirmationChange,
}: StageActivityPanelProps) {
    const pending = tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")
    const requiresApproval = tasks.length > 0
    const isPending = pending.length > 0

    const hasMandatoryFields = pending.some(t => Object.keys(t.requirements ?? {}).length > 0)
    const [approvalExpanded, setApprovalExpanded] = useState(actionable && isPending && hasMandatoryFields)
    const [historyExpanded, setHistoryExpanded] = useState(false)
    const [stageFilter, setStageFilter] = useState<string>(currentStageId ?? "ALL")

    useEffect(() => {
        if (currentStageId) {
            setStageFilter(currentStageId)
        }
    }, [currentStageId])

    const tasksForHistory = allTasks ?? tasks
    const history: HistoryItem[] = useMemo(() => {
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
                const stageId = h.stage
                const meta = getStageMetadata(stageId)
                return {
                    key: `stage-${h.id}`,
                    stageId,
                    stageLabel: meta.label,
                    kind: STATUS_TO_KIND[h.status ?? "ENTERED"] ?? "entered",
                    userName: h.user_name ?? null,
                    notes: h.notes ?? "",
                    attachments: [],
                    createdAt: h.created_at,
                }
            }),
        ]
        return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }, [tasksForHistory, stageEntries])

    const stageGroups = useMemo(() => {
        const groupMap = new Map<string, { stageId: string; stageLabel: string; icon: LucideIcon; items: HistoryItem[]; latestCreatedAt: string }>()

        // Ensure current viewed stage always appears as a filter chip
        if (currentStageId) {
            const meta = getStageMetadata(currentStageId)
            groupMap.set(currentStageId, {
                stageId: currentStageId,
                stageLabel: meta.label,
                icon: meta.icon,
                items: [],
                latestCreatedAt: new Date().toISOString(),
            })
        }

        for (const item of history) {
            let grp = groupMap.get(item.stageId)
            if (!grp) {
                const meta = getStageMetadata(item.stageId)
                grp = {
                    stageId: item.stageId,
                    stageLabel: meta.label,
                    icon: meta.icon,
                    items: [],
                    latestCreatedAt: item.createdAt,
                }
                groupMap.set(item.stageId, grp)
            }
            grp.items.push(item)
        }
        return Array.from(groupMap.values())
    }, [history, currentStageId])

    const selectedGroup = stageGroups.find((g) => g.stageId === stageFilter)
    const visibleCount = stageFilter === "ALL" ? history.length : (selectedGroup?.items.length ?? 0)

    if (tasks.length === 0 && history.length === 0) return null

    const who = requiresApproval ? assignee(tasks[0]) : null

    return (
        <section aria-label="Actividad de la etapa" className="shrink-0 border-t bg-card/95 backdrop-blur-sm">

            {/* ── Collapsible 1: Aprobación (solo se muestra en su propia etapa) ── */}
            {requiresApproval && (
                <div className="border-b border-border">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setApprovalExpanded((v) => !v)}
                        aria-expanded={approvalExpanded}
                        className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-6 py-2.5 text-left font-normal hover:bg-muted/40"
                    >
                        <ClipboardCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Aprobación</span>
                        <StatusBadge
                            status={isPending ? "PENDING" : "COMPLETED"}
                            label={isPending ? "Pendiente" : "Aprobada"}
                            size="sm"
                        />
                        {who && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" /> {who}
                            </span>
                        )}
                        <span className="ml-auto">
                            {approvalExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                        </span>
                    </Button>

                    {approvalExpanded && (
                        <div className="max-h-72 overflow-y-auto px-6 pb-4 pt-1 space-y-3">
                            {pending.map((task) => (
                                <div key={task.id} className="space-y-3">
                                    {(task.description || task.title) && (
                                        <p className="text-xs text-muted-foreground">{task.description || task.title}</p>
                                    )}
                                    {!actionable ? (
                                        <p className="text-xs text-muted-foreground">
                                            La aprobación se registra cuando la orden está en esta etapa.
                                        </p>
                                    ) : canComplete(task) ? (
                                        <>
                                            {Object.keys(task.requirements ?? {}).filter((key) => key !== "evidence").map((key) => (
                                                <LabeledCheckbox
                                                    key={key}
                                                    label={CONFIRMATION_LABELS[key]?.label ?? key}
                                                    description={CONFIRMATION_LABELS[key]?.description ?? (task.requirements?.[key] ?? "")}
                                                    checked={!!taskConfirmations[task.id]?.[key]}
                                                    onCheckedChange={(checked) => onConfirmationChange(task.id, key, checked)}
                                                />
                                            ))}
                                            <LabeledInput
                                                label="Comentarios (opcional)"
                                                as="textarea"
                                                rows={1}
                                                placeholder="Notas u observaciones técnicas…"
                                                value={taskNotes[task.id] ?? ""}
                                                onChange={(e) => onNoteChange(task.id, e.target.value)}
                                            />
                                            <DocumentAttachmentDropzone
                                                label={task.requirements?.evidence ? "Evidencia" : "Evidencia (opcional)"}
                                                requiredOverride={!!task.requirements?.evidence}
                                                file={taskFiles[task.id] ?? null}
                                                onFileChange={(file) => onFileChange(task.id, file)}
                                                accept=".pdf,image/*"
                                            />
                                        </>
                                    ) : (
                                        <p className="flex items-center gap-1.5 text-xs text-destructive">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            Requiere validación por {assignee(task) ?? "otro usuario"}.
                                        </p>
                                    )}
                                </div>
                            ))}
                            {requiresApproval && !isPending && (
                                <p className="flex items-center gap-1.5 text-xs text-success">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    Etapa aprobada{tasks[0].completed_by_data ? ` por ${tasks[0].completed_by_data.username}` : ""}.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Collapsible 2: Historial (muestra todas las actividades segmentadas por stage) ── */}
            <div>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setHistoryExpanded((v) => !v)}
                    aria-expanded={historyExpanded}
                    className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-6 py-2.5 text-left font-normal hover:bg-muted/40"
                >
                    <History className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Historial</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {visibleCount} {visibleCount === 1 ? "registro" : "registros"}
                    </span>
                    <span className="ml-auto">
                        {historyExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                    </span>
                </Button>

                {historyExpanded && (
                    <div className="max-h-80 overflow-y-auto px-6 pb-4 pt-2 space-y-4">
                        {history.length === 0 ? (
                            <EmptyState variant="minimal" icon={History} title="Aún no hay registros en el historial." />
                        ) : (
                            <>
                                {stageGroups.length > 1 && (
                                    <div className="flex flex-wrap items-center gap-1 pb-2 border-b border-border">
                                        <button
                                            type="button"
                                            onClick={() => setStageFilter("ALL")}
                                            className={cn(
                                                "rounded-full px-2 py-0.5 text-3xs font-medium transition-colors",
                                                stageFilter === "ALL"
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            Todas ({history.length})
                                        </button>
                                        {stageGroups.map((grp) => {
                                            const ChipIcon = grp.icon
                                            const isSelected = stageFilter === grp.stageId
                                            return (
                                                <button
                                                    key={grp.stageId}
                                                    type="button"
                                                    onClick={() => setStageFilter(grp.stageId)}
                                                    className={cn(
                                                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-medium transition-colors",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground font-semibold"
                                                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    )}
                                                >
                                                    <ChipIcon className="h-2.5 w-2.5 shrink-0" />
                                                    <span>{grp.stageLabel}</span>
                                                    <span className="tabular-nums">({grp.items.length})</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {visibleCount === 0 ? (
                                    <p className="text-xs text-muted-foreground py-2 italic">
                                        Sin registros de actividad en esta etapa.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {stageGroups
                                            .filter((grp) => (stageFilter === "ALL" || stageFilter === grp.stageId) && grp.items.length > 0)
                                            .map((grp) => {
                                            const GroupIcon = grp.icon
                                            return (
                                                <div key={grp.stageId} className="space-y-2 border-l-2 border-primary/20 pl-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                                        <GroupIcon className="h-3.5 w-3.5 text-primary" />
                                                        <span>{grp.stageLabel}</span>
                                                        <span className="text-3xs text-muted-foreground tabular-nums">
                                                            ({grp.items.length} {grp.items.length === 1 ? "actividad" : "actividades"})
                                                        </span>
                                                    </div>
                                                    <ol className="space-y-2">
                                                        {grp.items.map((e) => {
                                                            const { icon: Icon, label, tone } = HISTORY_KIND[e.kind]
                                                            return (
                                                                <li key={e.key} className="flex gap-2.5 text-xs">
                                                                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone)} />
                                                                    <div className="min-w-0 flex-1 space-y-1">
                                                                        <p className="text-foreground">
                                                                            <span className="font-medium">{label}</span>
                                                                            {e.userName && <> por {e.userName}</>}
                                                                            <span className="ml-1.5 tabular-nums text-muted-foreground">{time(e.createdAt)}</span>
                                                                        </p>
                                                                        {Object.entries(e.confirmations ?? {}).filter(([, v]) => v).map(([key]) => (
                                                                            <p key={key} className="flex items-center gap-1.5 text-success">
                                                                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                                                                {CONFIRMATION_LABELS[key]?.label ?? key}
                                                                            </p>
                                                                        ))}
                                                                        {e.notes && (
                                                                            <p className="flex gap-1.5 text-muted-foreground">
                                                                                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                                                                                <span className="whitespace-pre-line">{e.notes}</span>
                                                                            </p>
                                                                        )}
                                                                        {e.attachments.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {e.attachments.map((a) => (
                                                                                    <a
                                                                                        key={a.id}
                                                                                        href={a.file}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="inline-flex max-w-[12rem] items-center gap-1 rounded border px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                                                                                    >
                                                                                        <Paperclip className="h-3 w-3 shrink-0" />
                                                                                        <span className="truncate">{a.original_filename}</span>
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </li>
                                                            )
                                                        })}
                                                    </ol>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}
