"use client"

import { useMemo, useState } from "react"
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
        <div className="hidden lg:flex border-l w-88 shrink-0 flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
                <ManufacturingSpecsPanel view={view} />
            </div>
        </div>
    )
}

// ── Approval section content ──────────────────────────────────────────────────

interface ApprovalContentProps {
    pending: WorkOrderTask[]
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
    pending,
    actionable, canComplete,
    taskNotes, taskFiles, taskConfirmations,
    onNoteChange, onFileChange, onConfirmationChange,
}: ApprovalContentProps) {
    return (
        <div className="overflow-y-auto px-4 py-3 space-y-3 flex-1">
            {pending.map((task) => (
                <div key={task.id} className="space-y-3">
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
                            "rounded-sm h-4 px-1.5 text-3xs font-medium transition-colors leading-none inline-flex items-center justify-center",
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
                                    "rounded-sm h-4 px-1.5 text-3xs font-medium transition-colors leading-none inline-flex items-center justify-center max-w-[7rem] truncate",
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
                    <p className="text-xs text-muted-foreground italic">Sin actividad en esta etapa.</p>
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
                                            <span className="text-xs font-medium text-foreground truncate">{label}</span>
                                            <time className="shrink-0 text-3xs text-muted-foreground/60">
                                                {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: es })}
                                            </time>
                                        </div>
                                        {e.userName && (
                                            <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                                <User className="h-2.5 w-2.5 shrink-0" aria-hidden />
                                                {e.userName}
                                            </p>
                                        )}
                                        {Object.entries(e.confirmations ?? {}).filter(([, v]) => v).map(([key]) => (
                                            <p key={key} className="flex items-center gap-1.5 text-xs text-success">
                                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                                {key === "design_approved" ? "Cliente aprobó el diseño" : (CONFIRMATION_LABELS[key]?.label ?? key)}
                                            </p>
                                        ))}
                                        {e.notes && (
                                            <p className="flex gap-1.5 text-xs text-muted-foreground">
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
    const [userFilter, setUserFilter] = useState<string | null>(null)
    const [prevStageId, setPrevStageId] = useState(currentStageId)

    if (currentStageId !== prevStageId) {
        setPrevStageId(currentStageId)
        setUserFilter(null)
        setSpecsOpen(true)
        setApprovalOpen(actionable && isPending && hasMandatoryFields)
        setHistoryOpen(false)
    }
    const stageFilter = userFilter ?? currentStageId ?? "ALL"

    return (
        <div className="relative hidden lg:flex shrink-0 flex-col h-full">
            {/* Toggle tab — always visible, anchored to the left edge, protrudes into the center column */}
            {onToggleCollapse && (
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-10 flex h-6 w-4 items-center justify-center rounded-l border border-r-0 border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    title={collapsed ? "Expandir panel de información" : "Colapsar panel de información"}
                    aria-label={collapsed ? "Expandir panel de información" : "Colapsar panel de información"}
                >
                    {collapsed
                        ? <ChevronLeft className="h-3 w-3" aria-hidden />
                        : <ChevronRight className="h-3 w-3" aria-hidden />
                    }
                </button>
            )}

            {/* Icon rail when collapsed / full sections when expanded */}
            {collapsed ? (
                <div className="border-l w-10 flex flex-col items-center gap-2 pt-3 bg-card h-full">
                    <button
                        type="button"
                        title="Especificaciones"
                        aria-label="Especificaciones"
                        onClick={() => { setSpecsOpen(true); onToggleCollapse?.() }}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    {requiresApproval && isPending && (
                        <button
                            type="button"
                            title="Aprobación pendiente"
                            aria-label="Aprobación"
                            onClick={() => { setApprovalOpen(true); onToggleCollapse?.() }}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        title="Historial"
                        aria-label="Historial"
                        onClick={() => { setHistoryOpen(true); onToggleCollapse?.() }}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                        <History className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : <div className="border-l w-88 flex flex-col flex-1 min-h-0 overflow-hidden bg-card h-full">
                <CollapsibleSection
                    title="Datos de la OT"
                    icon={Settings2}
                    open={specsOpen}
                    onOpenChange={setSpecsOpen}
                >
                    <div className="overflow-y-auto px-4 py-3 flex-1">
                        <ManufacturingSpecsPanel view={specsView} />
                    </div>
                </CollapsibleSection>

                {requiresApproval && isPending && (
                    <CollapsibleSection
                        title="Aprobación"
                        icon={ClipboardCheck}
                        open={approvalOpen}
                        onOpenChange={setApprovalOpen}
                        badge={
                            <div className="flex items-center gap-1.5">
                                <StatusBadge
                                    status="PENDING"
                                    label="Pendiente"
                                    size="sm"
                                />
                                {who && (
                                    <span className="text-3xs text-muted-foreground truncate max-w-[5rem]">{who}</span>
                                )}
                            </div>
                        }
                    >
                        <ApprovalContent
                            pending={pending}
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
                        onStageFilter={setUserFilter}
                    />
                </CollapsibleSection>
            </div>}
        </div>
    )
}
