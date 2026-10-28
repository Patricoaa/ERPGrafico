"use client"

import { useState } from "react"
import { AlertCircle, ArrowRightCircle, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, History, MessageSquare, Paperclip, Pencil, RotateCcw, StickyNote, User, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentAttachmentDropzone, EmptyState, LabeledCheckbox, LabeledInput, StatusBadge } from "@/components/shared"
import { cn, formatPlainDate } from "@/lib/utils"
import type { TaskAttachment } from "@/features/workflow"
import type { WorkOrderHistoryEntry, WorkOrderTask } from "../types"


interface StageActivityPanelProps {
    /** All tasks of the viewed stage's type (pending AND completed). */
    tasks: WorkOrderTask[]
    /** `stage_history` entries of the viewed stage (entered, reopened, edited while closed…). */
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
    kind: "approved" | "reopened" | "entered" | "edited" | "note"
    confirmations?: Record<string, boolean>
    userName: string | null
    notes: string
    attachments: TaskAttachment[]
    createdAt: string
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
    tasks, stageEntries, canComplete, actionable, taskNotes, taskFiles, taskConfirmations,
    onNoteChange, onFileChange, onConfirmationChange,
}: StageActivityPanelProps) {
    const pending = tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")
    const requiresApproval = tasks.length > 0
    const isPending = pending.length > 0

    const hasMandatoryFields = pending.some(t => Object.keys(t.requirements ?? {}).length > 0)
    const [approvalExpanded, setApprovalExpanded] = useState(actionable && isPending && hasMandatoryFields)
    const [historyExpanded, setHistoryExpanded] = useState(false)

    const history: HistoryItem[] = [
        ...tasks.flatMap((t) => (t.events_data ?? []).map((e): HistoryItem => ({
            key: `event-${e.id}`,
            kind: e.action === "COMPLETED" ? "approved" : "reopened",
            userName: e.user_name,
            notes: e.notes,
            confirmations: e.confirmations,
            attachments: e.attachments_data,
            createdAt: e.created_at,
        }))),
        ...stageEntries.map((h): HistoryItem => ({
            key: `stage-${h.id}`,
            kind: STATUS_TO_KIND[h.status ?? "ENTERED"] ?? "entered",
            userName: h.user_name ?? null,
            notes: h.notes ?? "",
            attachments: [],
            createdAt: h.created_at,
        })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    if (tasks.length === 0 && history.length === 0) return null

    const who = requiresApproval ? assignee(tasks[0]) : null

    return (
        <section aria-label="Actividad de la etapa" className="shrink-0 border-t bg-card/95 backdrop-blur-sm">

            {/* ── Collapsible 1: Aprobación ────────────────────────────────── */}
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

            {/* ── Collapsible 2: Historial ─────────────────────────────────── */}
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
                        {history.length} {history.length === 1 ? "registro" : "registros"}
                    </span>
                    <span className="ml-auto">
                        {historyExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                    </span>
                </Button>

                {historyExpanded && (
                    <div className="max-h-72 overflow-y-auto px-6 pb-4 pt-1">
                        {history.length === 0 ? (
                            <EmptyState variant="minimal" icon={History} title="Aún no hay registros de aprobación." />
                        ) : (
                            <ol className="space-y-2">
                                {history.map((e) => {
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
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}
