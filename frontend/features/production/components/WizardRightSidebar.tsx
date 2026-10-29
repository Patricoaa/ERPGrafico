"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, History, MessageSquare, Paperclip, Settings2, User } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

import {
    CollapsibleSection,
    DocumentAttachmentDropzone,
    EmptyState,
    LabeledCheckbox,
    LabeledInput,
    ManufacturingSpecsPanel,
    StatusBadge,
    type ManufacturingSpecsView,
} from "@/components/shared"
import { cn } from "@/lib/utils"
import { formatEntityDisplay } from "@/lib/entity-registry"

import type { WorkOrder, WorkOrderHistoryEntry, WorkOrderTask } from "../types"
import { useUoMs } from "../hooks"
import { useWizardStore } from "./WorkOrderWizardStore"
import {
    assignee,
    buildHistory,
    CONFIRMATION_LABELS,
    getStageMetadata,
    HISTORY_KIND,
    type HistoryItem,
} from "../lib/stageHistory"

// ── Specs helpers (unchanged from before) ────────────────────────────────────

export function designFileUrls(order: WorkOrder, names: string[]): Record<string, string> {
    const urls: Record<string, string> = {}
    for (const att of order.attachments ?? []) {
        if (att.original_filename && names.includes(att.original_filename) && att.file) urls[att.original_filename] = att.file
    }
    return urls
}

export function workOrderSpecsView(order: WorkOrder, productName: string, stageData: WorkOrder['stage_data']): ManufacturingSpecsView {
    const designFiles = stageData?.design_attachments ?? []
    return {
        product: {
            name: productName,
            quantity: order.quantity ?? stageData?.quantity ?? null,
            uomName: order.uom_name ?? stageData?.uom_name ?? null,
        },
        productDescription: stageData?.product_description || order.product_description,
        saleOrder: order.sale_order_number
            ? formatEntityDisplay('sales.saleorder', { number: order.sale_order_number })
            : null,
        customer: order.sale_customer_name
            ? { name: order.sale_customer_name, taxId: order.sale_customer_rut }
            : null,
        contact: stageData?.contact_name
            ? { name: stageData.contact_name, taxId: stageData.contact_tax_id }
            : null,
        phases: stageData?.phases,
        specifications: {
            prepress: stageData?.prepress_specs,
            press: stageData?.press_specs,
            postpress: stageData?.postpress_specs,
        },
        designNeeded: stageData?.design_needed,
        designFiles,
        designFileUrls: designFileUrls(order, designFiles),
        folioEnabled: stageData?.folio_enabled,
        folioStart: stageData?.folio_start,
        printType: (stageData?.print_type ?? null) as ManufacturingSpecsView['printType'],
        createdAt: order.created_at ?? order.start_date ?? null,
        requestedDelivery: order.sale_order_delivery_date ? String(order.sale_order_delivery_date) : null,
    }
}

// ── Draft sidebar (unchanged) ─────────────────────────────────────────────────

export function WizardDraftSidebar() {
    const { mfgConfig, selectedContact, productDescription, quantity, uomId } = useWizardStore()
    const { data: uoms = [] } = useUoMs()
    const uomName = uoms.find(u => String(u.id) === uomId)?.name ?? null
    const view = useMemo<ManufacturingSpecsView>(() => ({
        product: { name: productDescription || 'Producto', quantity: quantity || null, uomName },
        productDescription: mfgConfig?.product_description,
        contact: selectedContact ? { name: selectedContact.name, taxId: selectedContact.tax_id } : null,
        phases: mfgConfig?.phases,
        specifications: mfgConfig?.specifications,
        designNeeded: mfgConfig?.design_needed,
        designFiles: [...(mfgConfig?.existing_design_files ?? []), ...(mfgConfig?.design_files.map(f => f.name) ?? [])],
        folioEnabled: mfgConfig?.folio_enabled,
        folioStart: mfgConfig?.folio_start,
        printType: mfgConfig?.print_type,
    }), [mfgConfig, selectedContact, productDescription, quantity, uomName])

    return (
        <div className="hidden lg:flex border-l w-72 shrink-0 flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
                <ManufacturingSpecsPanel view={view} />
            </div>
        </div>
    )
}

// ── Approval section content ──────────────────────────────────────────────────

interface ApprovalContentProps {
    tasks: WorkOrderTask[]
    pending: WorkOrderTask[]
    isPending: boolean
    requiresApproval: boolean
    actionable: boolean
    canComplete: (task: WorkOrderTask) => boolean
    taskNotes: Record<string | number, string>
    taskFiles: Record<string | number, File | null>
    taskConfirmations: Record<string | number, Record<string, boolean>>
    onNoteChange: (taskId: string | number, note: string) => void
    onFileChange: (taskId: string | number, file: File | null) => void
    onConfirmationChange: (taskId: string | number, key: string, value: boolean) => void
}

function ApprovalContent({
    tasks, pending, isPending, requiresApproval,
    actionable, canComplete,
    taskNotes, taskFiles, taskConfirmations,
    onNoteChange, onFileChange, onConfirmationChange,
}: ApprovalContentProps) {
    return (
        <div className="overflow-y-auto px-4 py-3 space-y-3 flex-1">
            {pending.map((task) => (
                <div key={task.id} className="space-y-3">
                    {(task.description || task.title) && (
                        <p className="text-2xs text-muted-foreground">{task.description || task.title}</p>
                    )}
                    {!actionable ? (
                        <p className="text-2xs text-muted-foreground">
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
                        <p className="flex items-center gap-1.5 text-2xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            Requiere validación por {assignee(task) ?? "otro usuario"}.
                        </p>
                    )}
                </div>
            ))}
            {requiresApproval && !isPending && (
                <p className="flex items-center gap-1.5 text-2xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Etapa aprobada{tasks[0].completed_by_data ? ` por ${tasks[0].completed_by_data.username}` : ""}.
                </p>
            )}
        </div>
    )
}

// ── History section content ───────────────────────────────────────────────────

interface HistoryContentProps {
    history: HistoryItem[]
    currentStageId?: string
    stageFilter: string
    onStageFilter: (v: string) => void
}

function HistoryContent({ history, currentStageId, stageFilter, onStageFilter }: HistoryContentProps) {
    const stageGroups = useMemo(() => {
        const groupMap = new Map<string, { stageId: string; stageLabel: string; items: HistoryItem[] }>()
        if (currentStageId) {
            const meta = getStageMetadata(currentStageId)
            groupMap.set(currentStageId, { stageId: currentStageId, stageLabel: meta.label, items: [] })
        }
        for (const item of history) {
            let grp = groupMap.get(item.stageId)
            if (!grp) {
                const meta = getStageMetadata(item.stageId)
                grp = { stageId: item.stageId, stageLabel: meta.label, items: [] }
                groupMap.set(item.stageId, grp)
            }
            grp.items.push(item)
        }
        return Array.from(groupMap.values())
    }, [history, currentStageId])

    const visibleItems = stageFilter === "ALL"
        ? history
        : (stageGroups.find(g => g.stageId === stageFilter)?.items ?? [])

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Stage filter chips — compact */}
            {stageGroups.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 px-4 pt-2 pb-1.5 border-b border-border/50 shrink-0">
                    <button
                        type="button"
                        onClick={() => onStageFilter("ALL")}
                        className={cn(
                            "rounded-full px-1 py-0 text-3xs font-medium transition-colors leading-3",
                            stageFilter === "ALL"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        Todas
                    </button>
                    {stageGroups.map((grp) => {
                        const isSelected = stageFilter === grp.stageId
                        return (
                            <button
                                key={grp.stageId}
                                type="button"
                                onClick={() => onStageFilter(grp.stageId)}
                                className={cn(
                                    "rounded-full px-1 py-0 text-3xs font-medium transition-colors leading-3 max-w-[7rem] truncate",
                                    isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {grp.stageLabel}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Timeline */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                {history.length === 0 ? (
                    <EmptyState variant="minimal" icon={History} title="Sin registros aún." />
                ) : visibleItems.length === 0 ? (
                    <p className="text-2xs text-muted-foreground italic">Sin actividad en esta etapa.</p>
                ) : (
                    <ol className="space-y-0">
                        {visibleItems.map((e, idx) => {
                            const { icon: Icon, label, toneClasses } = HISTORY_KIND[e.kind]
                            const isLast = idx === visibleItems.length - 1
                            return (
                                <li key={e.key} className="flex gap-3">
                                    {/* Marker column */}
                                    <div className="flex w-5 shrink-0 flex-col items-center">
                                        <span className={cn(
                                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                            toneClasses
                                        )}>
                                            <Icon className="h-2.5 w-2.5" aria-hidden />
                                        </span>
                                        {!isLast && (
                                            <span aria-hidden="true" className="w-0 flex-1 border-l border-dashed border-border/60" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pb-3 space-y-0.5">
                                        <div className="flex items-baseline justify-between gap-1">
                                            <span className="text-2xs font-semibold text-foreground truncate">{label}</span>
                                            <time className="shrink-0 text-3xs text-muted-foreground/60">
                                                {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: es })}
                                            </time>
                                        </div>
                                        {e.userName && (
                                            <p className="text-2xs text-muted-foreground/80 flex items-center gap-1">
                                                <User className="h-2.5 w-2.5 shrink-0" aria-hidden />
                                                {e.userName}
                                            </p>
                                        )}
                                        {Object.entries(e.confirmations ?? {}).filter(([, v]) => v).map(([key]) => (
                                            <p key={key} className="flex items-center gap-1.5 text-2xs text-success">
                                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                                {CONFIRMATION_LABELS[key]?.label ?? key}
                                            </p>
                                        ))}
                                        {e.notes && (
                                            <p className="flex gap-1.5 text-2xs text-muted-foreground">
                                                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                                                <span className="whitespace-pre-line">{e.notes}</span>
                                            </p>
                                        )}
                                        {e.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {e.attachments.map((a) => (
                                                    <a
                                                        key={a.id}
                                                        href={a.file}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex max-w-[10rem] items-center gap-1 rounded border px-1.5 py-0.5 text-3xs text-muted-foreground hover:text-foreground"
                                                    >
                                                        <Paperclip className="h-2.5 w-2.5 shrink-0" />
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
        </div>
    )
}

// ── Main WizardRightSidebar ───────────────────────────────────────────────────

interface WizardRightSidebarProps {
    order: WorkOrder
    productName: string
    stageData: WorkOrder['stage_data']
    // Activity
    currentStageId?: string
    tasks: WorkOrderTask[]
    allTasks?: WorkOrderTask[]
    stageEntries: WorkOrderHistoryEntry[]
    canComplete: (task: WorkOrderTask) => boolean
    actionable: boolean
    taskNotes: Record<string | number, string>
    taskFiles: Record<string | number, File | null>
    taskConfirmations: Record<string | number, Record<string, boolean>>
    onNoteChange: (taskId: string | number, note: string) => void
    onFileChange: (taskId: string | number, file: File | null) => void
    onConfirmationChange: (taskId: string | number, key: string, value: boolean) => void
    // Collapse
    collapsed?: boolean
    onToggleCollapse?: () => void
}

export function WizardRightSidebar({
    order, productName, stageData,
    currentStageId, tasks, allTasks, stageEntries,
    canComplete, actionable,
    taskNotes, taskFiles, taskConfirmations,
    onNoteChange, onFileChange, onConfirmationChange,
    collapsed = false,
    onToggleCollapse,
}: WizardRightSidebarProps) {
    const specsView = useMemo(() => workOrderSpecsView(order, productName, stageData), [order, productName, stageData])

    const tasksForHistory = allTasks ?? tasks
    const history = useMemo(() => buildHistory(tasksForHistory, stageEntries), [tasksForHistory, stageEntries])

    const pending = tasks.filter(t => t.status === "PENDING" || t.status === "IN_PROGRESS")
    const requiresApproval = tasks.length > 0
    const isPending = pending.length > 0
    const hasMandatoryFields = pending.some(t => Object.keys(t.requirements ?? {}).length > 0)
    const who = requiresApproval ? assignee(tasks[0]) : null

    const [specsOpen, setSpecsOpen] = useState(true)
    const [approvalOpen, setApprovalOpen] = useState(actionable && isPending && hasMandatoryFields)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [stageFilter, setStageFilter] = useState<string>(currentStageId ?? "ALL")

    // Auto-open approval when navigating to a stage with mandatory fields
    useEffect(() => {
        if (actionable && isPending && hasMandatoryFields) {
            setApprovalOpen(true)
        }
        if (currentStageId) setStageFilter(currentStageId)
    }, [currentStageId, actionable, isPending, hasMandatoryFields])

    // Collapsed: show only the toggle strip
    if (collapsed) {
        return (
            <div className="hidden lg:flex border-l w-8 shrink-0 flex-col items-center pt-2 bg-background">
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    title="Expandir panel de información"
                    aria-label="Expandir panel de información"
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
            </div>
        )
    }

    return (
        <div className="relative hidden lg:flex border-l w-72 shrink-0 flex-col h-full bg-background">
            {/* Toggle tab — anchored to the left edge, extends into the center column */}
            <button
                type="button"
                onClick={onToggleCollapse}
                className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-10 flex h-6 w-4 items-center justify-center rounded-l border border-r-0 border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Colapsar panel de información"
                aria-label="Colapsar panel de información"
            >
                <ChevronRight className="h-3 w-3" aria-hidden />
            </button>

            {/* Sections */}
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <CollapsibleSection
                    title="Especificaciones"
                    icon={Settings2}
                    open={specsOpen}
                    onOpenChange={setSpecsOpen}
                >
                    <div className="overflow-y-auto px-4 py-3 flex-1">
                        <ManufacturingSpecsPanel view={specsView} />
                    </div>
                </CollapsibleSection>

                {requiresApproval && (
                    <CollapsibleSection
                        title="Aprobación"
                        icon={ClipboardCheck}
                        open={approvalOpen}
                        onOpenChange={setApprovalOpen}
                        badge={
                            <div className="flex items-center gap-1.5">
                                <StatusBadge
                                    status={isPending ? "PENDING" : "COMPLETED"}
                                    label={isPending ? "Pendiente" : "Aprobada"}
                                    size="sm"
                                />
                                {who && (
                                    <span className="text-3xs text-muted-foreground truncate max-w-[5rem]">{who}</span>
                                )}
                            </div>
                        }
                    >
                        <ApprovalContent
                            tasks={tasks}
                            pending={pending}
                            isPending={isPending}
                            requiresApproval={requiresApproval}
                            actionable={actionable}
                            canComplete={canComplete}
                            taskNotes={taskNotes}
                            taskFiles={taskFiles}
                            taskConfirmations={taskConfirmations}
                            onNoteChange={onNoteChange}
                            onFileChange={onFileChange}
                            onConfirmationChange={onConfirmationChange}
                        />
                    </CollapsibleSection>
                )}

                <CollapsibleSection
                    title="Historial"
                    icon={History}
                    open={historyOpen}
                    onOpenChange={setHistoryOpen}
                    badge={
                        <span className="text-3xs text-muted-foreground/60 tabular-nums">
                            {history.length}
                        </span>
                    }
                >
                    <HistoryContent
                        history={history}
                        currentStageId={currentStageId}
                        stageFilter={stageFilter}
                        onStageFilter={setStageFilter}
                    />
                </CollapsibleSection>
            </div>
        </div>
    )
}
