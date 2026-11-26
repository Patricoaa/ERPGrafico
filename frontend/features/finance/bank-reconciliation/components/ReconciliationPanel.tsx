"use client"

import * as React from "react"
import { formatCurrency } from "@/lib/money"
import {useState, useEffect, useMemo, useCallback} from "react"
import { Button } from "@/components/ui/button"

import { ExclusionModal } from "./ExclusionModal"
import { SplitAllocationDialog } from "./SplitAllocationDialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useReconciledLinesQuery } from "../hooks/useReconciliationQueries"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { ActionConfirmModal, ActionDock, SubmitButton, BaseModal, CancelButton, Chip, Drawer, FormFooter, LabeledInput, LabeledSelect, PeriodValidationDateInput, SkeletonShell, SEG_TRIGGER, SEG_WRAPPER, StaleDataBanner, Banner } from "@/components/shared"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { workbenchItemEntity, workbenchItemViews, workbenchLineEntity, workbenchLineViews, type WorkbenchItemRow, type WorkbenchLineRow } from "../entity-view/reconciliationWorkbench.entity"

import { isZeroTolerance, safeDifference, safeSum, safeParseFloat } from "@/lib/math"
import {
    Ban, CheckCircle2, ChevronRight, ChevronLeft, FileText, RotateCcw,
    Sparkles, X, Wand2, Calculator, Brain, Plus, Undo2
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { financeApi } from "../../api/financeApi"
import { cn, parseDateOnly } from "@/lib/utils"
import {
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import {
    useStatementQuery,
    useUnreconciledLinesQuery,
    useUnreconciledPaymentsQuery,
    useLineSuggestionsQuery,
    usePaymentSuggestionsQuery
} from "../hooks/useReconciliationQueries"
import {
    useMatchMutation,
    useGroupMatchMutation,
    useAutoMatchMutation,
    useExcludeMutation,
    useBulkExcludeMutation,
    useCreateAndMatchMutation,
    useRestoreMutation,
    useBulkRestoreMutation,
    useCreateMovementMutation,
    useUnmatchMutation,
} from "../hooks/useReconciliationMutations"

import { useServerDate } from '@/hooks/useServerDate'
import { MovementWizard, type MovementData } from "@/features/treasury"
import { AutoMatchProgressModal } from "./AutoMatchProgressModal"
import { ReconciliationIntelligencePanel } from "./ReconciliationIntelligencePanel"

import { LazyDrawer } from "@/features/_shared"
import { statementLineActions, type StatementLineActionsCtx } from './statementLineActions'
import { systemItemActions, type SystemItemActionsCtx } from './systemItemActions'
import { buildReconciledGroups } from '../lib/reconciledGroups'

import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Types moved to types.ts or correctly imported
import type {
    BankStatementLine,
    ReconciliationSystemItem,
    ReconciliationMovement,
    ReconciliationBatch,
    QueryPaginationParams,
    PaymentSuggestion,
    LineSuggestion
} from "../types"

interface ReconciliationPanelProps {
    statementId: number
    treasuryAccountId: number
    onComplete: () => void
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ReconciliationPanel({ statementId, treasuryAccountId, onComplete }: ReconciliationPanelProps) {
    const { serverDate } = useServerDate()
    const [selectedLines, setSelectedLines] = useState<BankStatementLine[]>([])
    const [selectedPayments, setSelectedPayments] = useState<ReconciliationSystemItem[]>([])

    const lineIdStr = selectedLines.length === 1 ? selectedLines[0].id : 0
    const paymentIdStr = selectedPayments.length === 1 ? selectedPayments[0].id : 0

    const [bankParams, setBankParams] = useState<QueryPaginationParams>({ page: 1, pageSize: 50 })
    const [systemParams, setSystemParams] = useState<QueryPaginationParams>({ page: 1, pageSize: 50 })

    // Search, type and date range for both lists and the reconciled tab, with its own URL keys (`rec_…`).
    const query = useCollectionQuery(workbenchLineEntity, { urlPrefix: "rec_" })
    const { search } = query

    // Synchronize unified search filters to query parameters
    useEffect(() => {
        const f = search.filters
        requestAnimationFrame(() => {
            setBankParams(prev => ({
                ...prev,
                page: 1,
                search: f.search || "",
                type: f.type || "",
                date_from: f.date_from || "",
                date_to: f.date_to || "",
            }))
            setSystemParams(prev => ({
                ...prev,
                page: 1,
                search: f.search || "",
                type: f.type || "",
                date_from: f.date_from || "",
                date_to: f.date_to || "",
            }))
        })
    }, [search.filters])

    const [selectedMovement, setSelectedMovement] = useState<{ id: number | string, type: string } | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    const openTransactionDetail = (id: number | string, type: string) => {
        setSelectedMovement({ id, type })
        setDetailsOpen(true)
    }

    const clearTransactionDetail = () => {
        setSelectedMovement(null)
        setDetailsOpen(false)
    }

    const { data: statement, isError: isErrorStmt } = useStatementQuery(statementId)
    const { data: bankData, isLoading: loadingLines, isError: isErrorBank } = useUnreconciledLinesQuery(statementId, bankParams)
    const { data: systemData, isLoading: loadingPayments, isError: isErrorSystem } = useUnreconciledPaymentsQuery(treasuryAccountId, systemParams)
    // Conciliados respeta el mismo buscador y rango de fechas que la pestaña de pendientes.
    const reconciledParams: QueryPaginationParams = {
        page: 1,
        pageSize: 200,
        search: search.filters.search || "",
        date_from: search.filters.date_from || "",
        date_to: search.filters.date_to || "",
    }
    const { data: reconciledData, isLoading: loadingReconciled, isError: isErrorReconciled } = useReconciledLinesQuery(statementId, reconciledParams)

    const reconciledGroups = useMemo(() => buildReconciledGroups(reconciledData?.results ?? []), [reconciledData])
    const reconciledCount = reconciledData?.count ?? 0
    const reconciledTruncated = reconciledCount > (reconciledData?.results?.length ?? 0)
    const unreconciledLines = useMemo<BankStatementLine[]>(() => bankData?.results || [], [bankData])
    const unreconciledPayments = useMemo<ReconciliationSystemItem[]>(() => systemData?.results || [], [systemData])

    const { data: suggestions = [] } = useLineSuggestionsQuery(lineIdStr, selectedLines.length === 1)
    const { data: lineSuggestions = [] } = usePaymentSuggestionsQuery(paymentIdStr, selectedPayments.length === 1)

    const { match, isMatching } = useMatchMutation(statementId, treasuryAccountId)
    const { groupMatch, isGroupMatching } = useGroupMatchMutation(statementId, treasuryAccountId)
    const { isAutoMatching } = useAutoMatchMutation(statementId)
    const { exclude } = useExcludeMutation(statementId)
    const { bulkExclude } = useBulkExcludeMutation(statementId)
    const { restore } = useRestoreMutation(statementId)
    const { unmatch: unmatchGroup, isUnmatching: isUnmatchingGroup } = useUnmatchMutation(statementId, treasuryAccountId)
    const [unmatchGroupDialog, setUnmatchGroupDialog] = useState<{ open: boolean; lineId: number | null }>({ open: false, lineId: null })
    // El dock de acciones flota solo con selección: el espacio inferior se reserva únicamente entonces.
    const dockVisible = selectedLines.length > 0 || selectedPayments.length > 0
    const { mutateAsync: bulkRestore, isPending: restoringLines } = useBulkRestoreMutation(statementId)
    // Solo las líneas excluidas de la selección se pueden volver a incluir.
    const excludedSelected = useMemo(
        () => selectedLines.filter((line) => line.reconciliation_status === "EXCLUDED"),
        [selectedLines],
    )
    const handleRestoreExcluded = useCallback(async () => {
        const ids = excludedSelected.map((line) => line.id)
        if (ids.length === 0) return
        try {
            await bulkRestore(ids)
            setSelectedLines((prev) => prev.filter((line) => !ids.includes(line.id)))
        } catch {
            // El hook ya muestra el error.
        }
    }, [excludedSelected, bulkRestore])

    const loading = loadingLines || loadingPayments || loadingReconciled
    const isError = isErrorStmt || isErrorBank || isErrorSystem || isErrorReconciled
    const matching = isMatching || isGroupMatching

    const [diffDialog, setDiffDialog] = useState<{ open: boolean, lineId: number, paymentId: number, amount: string, isGroup?: boolean, accountingDate?: Date }>({
        open: false, lineId: 0, paymentId: 0, amount: '0', isGroup: false, accountingDate: undefined
    })
    const [diffDateValid, setDiffDateValid] = useState<boolean>(true)
    const [diffType, setDiffType] = useState<string>("COMMISSION")
    const [diffNotes, setDiffNotes] = useState<string>("")

    const [actionDialog, setActionDialog] = useState<{
        open: boolean,
        type: 'exclude' | 'bulk_exclude' | 'automatch' | 'confirm_match' | null,
        lineId?: number
    }>({ open: false, type: null })

    const [splitDialog, setSplitDialog] = useState<{ open: boolean, payment: ReconciliationSystemItem | null }>({
        open: false, payment: null
    })

    const statementLineActionsCtx = useMemo<StatementLineActionsCtx>(() => ({
        onExclude: (lineId) => setActionDialog({ open: true, type: 'exclude', lineId }),
        onRestore: (lineId) => restore(lineId),
    }), [restore])

    const systemItemActionsCtx = useMemo<SystemItemActionsCtx>(() => ({
        onSplit: (payment) => setSplitDialog({ open: true, payment }),
    }), [])

    const [confidenceThreshold, setConfidenceThreshold] = useState<number>(90)

    // Create and Match "On the fly"
    const [createMatchDialog, setCreateMatchDialog] = useState<{ open: boolean, line: BankStatementLine | null }>({
        open: false, line: null
    })
    const [isCreateMovementOpen, setIsCreateMovementOpen] = useState(false)
    const { createAndMatch } = useCreateAndMatchMutation(statementId, treasuryAccountId)
    const { createMovement } = useCreateMovementMutation(treasuryAccountId)

    // S4.8: Async auto-match progress state
    const [autoMatchProgressOpen, setAutoMatchProgressOpen] = useState(false)

    const [, setSidebarOpen] = useState(false)
    const [intelOpen, setIntelOpen] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        const len1 = selectedLines.length
        const len2 = selectedPayments.length
        requestAnimationFrame(() => {
            if (len1 === 1 || len2 === 1) {
                setSidebarOpen(true)
            } else {
                setSidebarOpen(false)
            }
        })
    }, [selectedLines.length, selectedPayments.length])

    // ─── Selection Handlers ───────────────────────────────────────────────────

    // Controlled selection (ADR-0159): the screen keeps the selected rows of the current page.
    const lineSelection = useMemo(() => ({
        state: Object.fromEntries(selectedLines.map((l) => [String(l.id), true])),
        onChange: (next: Record<string, boolean>) => setSelectedLines(unreconciledLines.filter((l) => next[String(l.id)])),
    }), [selectedLines, unreconciledLines])

    const paymentSelection = useMemo(() => ({
        state: Object.fromEntries(selectedPayments.map((p) => [String(p.id), true])),
        onChange: (next: Record<string, boolean>) => setSelectedPayments(unreconciledPayments.filter((p) => next[String(p.id)])),
    }), [selectedPayments, unreconciledPayments])

    // ─── Matching Logic ───────────────────────────────────────────────────────

    const handleMatch = async (lineId: number, paymentId: number, force: boolean = false) => {
        if (!force) {
            const suggestion = suggestions.find((s: PaymentSuggestion) => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === paymentId)
            const diffAmount = suggestion ? parseFloat(suggestion.difference) : 0

            if (diffAmount !== 0) {
                const line = unreconciledLines.find(l => l.id === lineId)
                const defaultDate = line ? parseDateOnly(line.transaction_date) : (serverDate ?? new Date())
                const localDate = new Date(defaultDate.getTime() + defaultDate.getTimezoneOffset() * 60000)
                setDiffDialog({ open: true, lineId, paymentId, amount: diffAmount.toString(), accountingDate: localDate })
                try {
                    const diffData = await financeApi.getSuggestedDifference(lineId)
                    setDiffType((diffData as Record<string, unknown>).suggestion as string)
                } catch { /* ignore */ }
                return
            }
        }

        try {
            const isBatch = suggestions.find((s: PaymentSuggestion) => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === paymentId)?.is_batch

            const confirmData: Record<string, unknown> = {}
            if (force) {
                confirmData.difference_type = diffType
                confirmData.notes = diffNotes
                if (diffDialog.accountingDate) {
                    confirmData.accounting_date = format(diffDialog.accountingDate, 'yyyy-MM-dd')
                }
            }

            await match({ lineId, paymentId, isBatch, confirmData })

            setDiffDialog(prev => ({ ...prev, open: false }))
            setDiffNotes("")

            toast.success("Match realizado correctamente")

            // Note: Optimistic update handles UI so we just complete if it was the last one
            if (unreconciledLines.length === 1) onComplete()
            setSelectedLines([])
        } catch {
            // Handled in mutation
        }
    }

    const handleGroupMatch = async (force: boolean = false) => {
        if (selectedLines.length === 0 || selectedPayments.length === 0) return

        // Validations omitted for brevity as they are business logic from source
        const lineTotal = safeSum(selectedLines.map(l => Math.abs(safeDifference(safeParseFloat(l.credit), safeParseFloat(l.debit)))))
        const payTotal = safeSum(selectedPayments.map(p => Math.abs(safeParseFloat(p.amount))))
        const diff = safeDifference(lineTotal, payTotal)

        if (!force && Math.abs(diff) > 1) {
            const line = selectedLines[0]
            const defaultDate = line ? parseDateOnly(line.transaction_date) : (serverDate ?? new Date())
            const localDate = new Date(defaultDate.getTime() + defaultDate.getTimezoneOffset() * 60000)
            setDiffDialog({ open: true, lineId: selectedLines[0].id, paymentId: 0, amount: diff.toString(), isGroup: true, accountingDate: localDate })
            setDiffType(diff < 0 ? "COMMISSION" : "ROUNDING")
            return
        }

        try {
            const payload: Record<string, unknown> = {
                line_ids: selectedLines.map(l => l.id),
                payment_ids: selectedPayments.map(p => p.id),
            }

            if (force) { payload.difference_reason = diffType; payload.notes = diffNotes; }

            const confirmPayload: Record<string, unknown> = {}
            if (force) {
                confirmPayload.difference_type = diffType;
                confirmPayload.notes = diffNotes;
                if (diffDialog.accountingDate) {
                    confirmPayload.accounting_date = format(diffDialog.accountingDate, 'yyyy-MM-dd')
                }
            }

            await groupMatch({ payload, confirmPayload, lineId: selectedLines[0].id })

            setSelectedPayments([])
            setSelectedLines([])
            setDiffDialog(prev => ({ ...prev, open: false }))
            setDiffNotes("")
        } catch {
            // Handled in mutation
        }
    }

    const confirmAutoMatch = async () => {
        setActionDialog({ open: false, type: null })
        setAutoMatchProgressOpen(true)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.data.current?.type === 'payment' && over.data.current?.type === 'line') {
            const paymentId = Number(active.data.current.id);
            const lineId = Number(over.data.current.id);

            handleMatch(lineId, paymentId);
        }
    };

    const handleCreateAndMatch = async (data: MovementData) => {
        if (!createMatchDialog.line) return

        const movement_type = data.impact === 'TRANSFER' ? 'TRANSFER' : (data.impact === 'IN' ? 'INBOUND' : 'OUTBOUND');

        const payload = {
            movement_type: movement_type,
            amount: data.amount,
            from_account: data.fromAccountId || null,
            to_account: data.toAccountId || null,
            contact: data.contactId || null,
            notes: data.notes,
            justify_reason: data.moveType !== 'TRANSFER' ? data.moveType : null,
            payment_method: 'CASH', // Legacy
        }

        try {
            await createAndMatch({
                lineId: createMatchDialog.line.id,
                movementData: payload
            })
            setCreateMatchDialog({ open: false, line: null })
        } catch (error) {
            // Error already shown in mutation
            throw error // Re-throw to keep wizard open if needed
        }
    }

    const handleCreateMovement = async (data: MovementData) => {
        const movement_type = data.impact === 'TRANSFER' ? 'TRANSFER' : (data.impact === 'IN' ? 'INBOUND' : 'OUTBOUND');

        const payload = {
            movement_type: movement_type,
            amount: data.amount,
            from_account: data.fromAccountId || null,
            to_account: data.toAccountId || null,
            contact: data.contactId || null,
            notes: data.notes,
            justify_reason: data.moveType !== 'TRANSFER' ? data.moveType : null,
            payment_method: 'CASH', // Legacy
        }

        try {
            await createMovement(payload)
            setIsCreateMovementOpen(false)
        } catch (error) {
            throw error
        }
    }

    // ─── Collections ──────────────────────────────────────────────────────────

    const lineRows = useMemo<WorkbenchLineRow[]>(
        () => unreconciledLines.map((l) => ({ ...l, suggested: lineSuggestions.some((s: LineSuggestion) => s.line_data?.id === l.id) })),
        [unreconciledLines, lineSuggestions],
    )
    const itemRows = useMemo<WorkbenchItemRow[]>(
        () => unreconciledPayments.map((item) => {
            const deposit = item.movement_type === 'INBOUND' || (item.movement_type === 'TRANSFER' && item.to_account === treasuryAccountId)
            let typeLabel = deposit ? "Depósito" : "Retiro"
            if (item.movement_type === 'TRANSFER') typeLabel = deposit ? "Transf. Entrante" : "Transf. Saliente"
            if (item.movement_type === 'ADJUSTMENT') typeLabel = "Ajuste"
            const suggested = suggestions.some((s: PaymentSuggestion) => (s.is_batch ? s.batch_data?.id === item.terminal_batch_id : s.payment_data?.id === item.id))
            return { ...item, deposit, typeLabel, suggested }
        }),
        [unreconciledPayments, suggestions, treasuryAccountId],
    )

    const lineCollection = useEntityCollection(
        workbenchLineEntity,
        { rows: lineRows, isLoading: loadingLines, rowCount: bankData?.count ?? 0 },
        {
            pagination: {
                mode: "server",
                state: { pageIndex: (bankParams.page || 1) - 1, pageSize: bankParams.pageSize || 50 },
                onChange: (next) => setBankParams((p) => ({ ...p, page: next.pageIndex + 1, pageSize: next.pageSize })),
            },
            selection: lineSelection,
            rowTone: (l) => (l.reconciliation_status === "EXCLUDED" ? "muted" : l.suggested ? "attention" : null),
            // A treasury movement is dropped on a statement line to match them (`handleDragEnd`).
            dnd: { drop: (l) => ({ id: `line-${l.id}`, data: { type: "line", id: l.id } }) },
        },
    )
    const itemCollection = useEntityCollection(
        workbenchItemEntity,
        { rows: itemRows, isLoading: loadingPayments, rowCount: systemData?.count ?? 0 },
        {
            pagination: {
                mode: "server",
                state: { pageIndex: (systemParams.page || 1) - 1, pageSize: systemParams.pageSize || 50 },
                onChange: (next) => setSystemParams((p) => ({ ...p, page: next.pageIndex + 1, pageSize: next.pageSize })),
            },
            selection: paymentSelection,
            rowTone: (i) => (i.suggested ? "attention" : null),
            dnd: { drag: (i) => ({ id: `payment-${i.id}`, data: { type: "payment", id: i.id } }) },
        },
    )

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <SkeletonShell isLoading={loading} ariaLabel="Cargando conciliación">
            {isError && <StaleDataBanner className="px-4 py-2" />}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <Tabs defaultValue="unreconciled" className="h-full flex flex-col w-full min-h-0">
                {/* ─── Workbench command bar: one search for both lists; tabs and actions on the right ─── */}
                <Collection.Root collection={lineCollection} query={query} selection="bulk" label="Líneas de cartola pendientes" actions={statementLineActions.forCollection(statementLineActionsCtx)}>
                <Collection.Toolbar
                    action={
                    <div className="flex items-center gap-3 shrink-0 h-9">
                        {/* Navigation Tabs List */}
                        <div className={SEG_WRAPPER}>
                            <TabsList className="h-7 p-0 gap-0 bg-transparent shrink-0">
                                <TabsTrigger
                                    value="unreconciled"
                                    className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
                                >
                                    Pendientes · <span className="font-mono tabular-nums">{bankData?.count ?? 0}</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="reconciled"
                                    className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
                                >
                                    Conciliados · <span className="font-mono tabular-nums">{reconciledCount}</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <SubmitButton
                            onClick={() => setActionDialog({ open: true, type: 'automatch' })}
                            loading={isAutoMatching}
                            icon={<Wand2 className="h-3.5 w-3.5" />}
                            className="h-control-md gap-1.5 px-3 text-xs font-semibold text-success-text bg-success/10 hover:bg-success/15"
                        >
                            Auto-match
                        </SubmitButton>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => setIntelOpen(prev => !prev)}
                                    variant="ghost"
                                    aria-label="Configurar inteligencia de conciliación"
                                    aria-pressed={intelOpen}
                                    className={cn(
                                        "h-control-md w-9 p-0 transition-all",
                                        intelOpen && "bg-primary text-primary-foreground hover:bg-primary/90"
                                    )}
                                >
                                    <Brain className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Inteligencia de conciliación</TooltipContent>
                        </Tooltip>
                    </div>
                    }
                />

                <TabsContent value="unreconciled" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 pb-2 text-3xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-4 rounded-sm bg-warning/20 ring-1 ring-warning/50" aria-hidden />
                            Sugerencia de conciliación
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-4 rounded-sm bg-muted ring-1 ring-border" aria-hidden />
                            Excluida
                        </span>
                    </div>
                    <div className="flex-1 min-h-0 flex gap-6 relative items-stretch pb-2">
                        {/* Tables Container */}
                        <div className="flex-1 h-full min-h-0 transition-all duration-500 ease-[var(--ease-premium)] min-w-0">
                            {/* ─── Grid with Section Headers ─── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0">
                                {/* Left: Bank */}
                                <div className="h-full flex flex-col min-h-0 space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-info" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Cartola Bancaria</span>
                                        </div>
                                        <span className="text-3xs font-mono tabular-nums text-muted-foreground">{bankData?.count || 0} pendientes</span>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <Collection.View
                                            table={workbenchLineViews.table}
                                            emptyTitle="Sin líneas pendientes"
                                            emptyDescription="Todas las líneas de esta cartola están conciliadas o excluidas. Confírmala para cerrarla."
                                        />
                                    </div>
                                </div>

                                {/* Right: Movimientos de tesorería */}
                                <div className="h-full flex flex-col min-h-0 space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Movimientos de Tesorería</span>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-3xs font-semibold text-primary hover:bg-primary/10 hover:text-primary transition-colors"
                                                onClick={() => setIsCreateMovementOpen(true)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsCreateMovementOpen(true) } }}
                                            >
                                                <Plus className="h-3 w-3" />
                                                Nuevo movimiento
                                            </span>
                                        </div>
                                        <span className="text-3xs font-mono tabular-nums text-muted-foreground">{systemData?.count || 0} disponibles</span>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <Collection.Root collection={itemCollection} selection="bulk" label="Movimientos de tesorería disponibles" actions={systemItemActions.forCollection(systemItemActionsCtx)}>
                                            <Collection.View
                                                table={workbenchItemViews.table}
                                                emptyTitle="Sin movimientos disponibles"
                                                emptyDescription="No hay pagos ni movimientos de tesorería sin conciliar en esta cuenta. Crea uno si falta."
                                            />
                                        </Collection.Root>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="reconciled" className="flex-1 min-h-0 overflow-y-auto mt-0 data-[state=inactive]:hidden custom-scrollbar">
                    {reconciledTruncated && (
                        <p className="px-1 pb-2 text-3xs text-muted-foreground">
                            Mostrando las primeras {reconciledData?.results?.length ?? 0} de {reconciledCount} líneas conciliadas. Filtra por fecha o texto para acotar.
                        </p>
                    )}
                    {!loadingReconciled && reconciledGroups.length === 0 && (
                        <p className="px-1 py-10 text-center text-xs text-muted-foreground">
                            Aún no hay líneas conciliadas{search.isFiltered ? " con este filtro" : ""}.
                        </p>
                    )}
                    <div className="grid grid-cols-1 gap-4 pb-24">
                        {reconciledGroups.map((groupItem) => {
                            const { group, lines } = groupItem;

                            // Totals for the whole group
                            const movements = group?.movements || [];
                            const batches = group?.batches || [];
                            const diffAmount = group?.difference_amount || 0;
                            const diffTypeRaw = group?.difference_type || "OTHER";

                            const translationMap: Record<string, string> = {
                                'COMMISSION': 'Comisión',
                                'TAX': 'Impuesto',
                                'ROUNDING': 'Redondeo',
                                'OTHER': 'Ajuste de Diferencia'
                            };
                            const diffType = translationMap[diffTypeRaw] || group?.difference_type_display || "Ajuste de Diferencia";

                            return (
                                <div key={groupItem.key} className="group/card bg-transparent border border-border/40 hover:border-primary/20 rounded-md overflow-hidden transition-all duration-300">
                                    <div className="flex">
                                        {/* Left Column: Bank Side (Can have multiple lines) */}
                                        <div className="w-[50%] p-6 flex flex-col justify-start border-r border-border/40 relative">
                                            {/* Connecting Visual Resource */}
                                            <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                                                <div className="h-6 w-6 rounded-full bg-background border border-border/40 flex items-center justify-center text-primary shadow-card group-hover/card:border-primary/40 transition-all">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <span className="text-3xs font-bold uppercase text-muted-foreground tracking-widest">Cartola Bancaria ({lines.length})</span>
                                                </div>

                                                <div className="space-y-2">
                                                    {lines.map((line) => {
                                                        const isBankCredit = parseFloat(line.credit) > parseFloat(line.debit);
                                                        const bankAmount = Math.abs(parseFloat(line.credit) - parseFloat(line.debit));

                                                        return (
                                                            <div key={line.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border/40 rounded-md hover:border-primary/20 transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-8 rounded-sm bg-background border border-border/40 flex items-center justify-center text-muted-foreground shrink-0">
                                                                        <FileText className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <h3 className="text-xs font-bold leading-tight text-foreground/90 max-w-[600px]">{line.description}</h3>
                                                                        <span className="text-4xs font-mono font-bold uppercase text-muted-foreground opacity-60">Línea: {line.line_number}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right shrink-0">
                                                                    <span className="text-4xs font-mono font-bold text-muted-foreground/60 uppercase block mb-0.5">
                                                                        {format(parseDateOnly(line.transaction_date), 'dd MMM yyyy', { locale: es })}
                                                                    </span>
                                                                    <span className={cn(
                                                                        "text-sm font-mono font-black tracking-tighter leading-none",
                                                                        isBankCredit ? "text-success-text" : "text-destructive"
                                                                    )}>
                                                                        {formatCurrency(bankAmount)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Right Column: System Side */}
                                        <div className="flex-1 p-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <span className="text-3xs font-bold uppercase text-muted-foreground tracking-widest">
                                                        Movimientos de Tesorería ({movements.length + batches.length})
                                                    </span>
                                                </div>

                                                <div className="space-y-1.5">
                                                    {movements.map((m: ReconciliationMovement) => (
                                                        <div
                                                            key={m.id}
                                                            onClick={() => openTransactionDetail(m.id, 'payment')}
                                                            className="flex items-center justify-between p-3 bg-muted/30 border border-border/40 rounded-md hover:bg-muted/50 hover:border-primary/20 transition-all cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-sm bg-background border border-border/40 flex items-center justify-center text-muted-foreground group-hover/card:text-primary transition-colors">
                                                                    <FileText className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold uppercase tracking-tight text-foreground/80">
                                                                        {m.movement_type_display || 'Movimiento'} #{m.id}
                                                                    </span>
                                                                    <span className="text-3xs text-muted-foreground font-medium truncate max-w-[200px]">
                                                                        {m.notes || m.reference || 'Sin concepto'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-mono font-bold text-foreground/90">
                                                                {formatCurrency(m.amount)}
                                                            </span>
                                                        </div>
                                                    ))}

                                                    {batches.map((b: ReconciliationBatch) => (
                                                        <div
                                                            key={b.id}
                                                            onClick={() => openTransactionDetail(b.id, 'terminal_batch')}
                                                            className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-md hover:bg-primary/10 transition-all cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-sm bg-primary/10 flex items-center justify-center text-primary">
                                                                    <Wand2 className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black uppercase tracking-widest text-primary">Lote de terminal de cobro</span>
                                                                    <span className="text-3xs text-primary/70 font-bold">{b.terminal_name || 'Terminal de cobro'} - {b.display_id}</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-mono font-bold text-primary">
                                                                {formatCurrency(b.net_amount)}
                                                            </span>
                                                        </div>
                                                    ))}

                                                    {Math.abs(diffAmount) > 0.01 && (
                                                        <div
                                                            onClick={() => group?.difference_journal_entry && openTransactionDetail(group.difference_journal_entry, 'journal_entry')}
                                                            className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 border-dashed rounded-md hover:bg-warning/10 transition-all cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-sm bg-warning/10 flex items-center justify-center text-warning-text">
                                                                    <Calculator className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black uppercase tracking-widest text-warning-text">{diffType}</span>
                                                                    <span className="text-3xs text-warning-text/70 font-bold italic">Ajuste automático de diferencia</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-mono font-bold text-warning-text">
                                                                {formatCurrency(diffAmount)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Footer: acción revertir (solo en DRAFT) */}
                                    {statement?.state !== "CONFIRMED" && (
                                        <div className="border-t border-border/40 px-6 py-2.5 flex justify-end bg-muted/10">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={isUnmatchingGroup}
                                                onClick={() => setUnmatchGroupDialog({ open: true, lineId: lines[0].id })}
                                                className="h-control-xs text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 gap-1.5"
                                            >
                                                <Undo2 className="h-3 w-3" />
                                                Revertir conciliación
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* ─── Modals ─── */}
                <ActionConfirmModal
                    open={unmatchGroupDialog.open}
                    onOpenChange={(open) => !open && setUnmatchGroupDialog((prev) => ({ ...prev, open: false }))}
                    onConfirm={async () => {
                        if (!unmatchGroupDialog.lineId) return
                        await unmatchGroup(unmatchGroupDialog.lineId)
                        setUnmatchGroupDialog({ open: false, lineId: null })
                    }}
                    title="¿Revertir conciliación?"
                    description='Se deshará la conciliación de este grupo, devolviendo todas las líneas bancarias y movimientos de tesorería al estado "No Conciliado".'
                    variant="destructive"
                    confirmText="Revertir"
                />

                <ExclusionModal
                    open={actionDialog.open && (actionDialog.type === 'exclude' || actionDialog.type === 'bulk_exclude')}
                    onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}
                    title={actionDialog.type === 'bulk_exclude' ? `Excluir ${selectedLines.length} Movimientos` : "Excluir Movimiento"}
                    onConfirm={async (reason, notes) => {
                        const isBulk = actionDialog.type === 'bulk_exclude'
                        const affectedCount = isBulk ? selectedLines.length : 1

                        try {
                            if (isBulk) {
                                await bulkExclude({
                                    lineIds: selectedLines.map(l => l.id),
                                    reason,
                                    notes
                                })
                                setSelectedLines([])
                            } else if (actionDialog.lineId) {
                                await exclude({
                                    lineId: actionDialog.lineId,
                                    reason,
                                    notes
                                })
                            }

                            if ((bankData?.count || 0) === affectedCount) {
                                onComplete()
                            }
                        } catch {
                            // Handled in mutation
                        } finally {
                            setActionDialog({ open: false, type: null })
                        }
                    }}
                />

                <SplitAllocationDialog
                    open={splitDialog.open}
                    onOpenChange={(open) => !open && setSplitDialog({ open: false, payment: null })}
                    payment={splitDialog.payment}
                    treasuryAccountId={treasuryAccountId}
                />

                <ActionConfirmModal
                    open={actionDialog.open && actionDialog.type === 'automatch'}
                    onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}
                    onConfirm={confirmAutoMatch}
                    title="Conciliación Automática"
                    description={
                        <div className="space-y-6 pt-2">
                            <p>Se buscarán coincidencias automáticas basadas en monto y fecha. Las sugerencias con un score superior al umbral se procesarán automáticamente.</p>

                            <div className="space-y-3 bg-muted/30 p-4 rounded-md border border-border/50">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                        Umbral de Confianza
                                    </Label>
                                    <Chip size="sm" intent="primary" className="font-mono">
                                        {confidenceThreshold}%
                                    </Chip>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="100"
                                    step="1"
                                    value={confidenceThreshold}
                                    onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-muted rounded-sm appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-3xs font-bold text-muted-foreground uppercase opacity-50">
                                    <span>Flexible (50%)</span>
                                    <span>Estricto (100%)</span>
                                </div>
                            </div>
                        </div>
                    }
                    variant="default"
                    confirmText="Iniciar Auto-Match"
                />

                <BaseModal
                    open={diffDialog.open}
                    onOpenChange={(open) => !open && setDiffDialog(prev => ({ ...prev, open: false }))}
                    icon={Calculator}
                    title="Confirmar Conciliación con Ajuste"
                    description={
                        <div className="space-y-4">
                            <p>Existe una diferencia de <span className="font-bold text-primary">{formatCurrency(parseFloat(diffDialog.amount))}</span>. Selecciona cómo deseas procesarla.</p>

                        </div>
                    }
                    footer={
                        <FormFooter
                            actions={
                                <>
                                    <CancelButton onClick={() => setDiffDialog(prev => ({ ...prev, open: false }))} />
                                    <Button
                                        disabled={!diffDateValid || matching}
                                        onClick={() => diffDialog.isGroup ? handleGroupMatch(true) : handleMatch(diffDialog.lineId, diffDialog.paymentId, true)}
                                        className=""
                                    >
                                        Confirmar con Ajuste
                                    </Button>
                                </>
                            }
                        />
                    }
                >
                    <div className="space-y-4 py-4">
                        <Banner tone="destructive" icon={Ban} title="Acción irreversible" live="none">
                            Una vez confirmada, esta conciliación y su ajuste contable no podrán ser revertidos desde este workbench.
                        </Banner>
                        <LabeledSelect
                            label="Motivo del Ajuste"
                            value={diffType}
                            onChange={setDiffType}
                            className="font-bold uppercase text-xs"
                            options={[
                                { value: "COMMISSION", label: "Comisión Bancaria" },
                                { value: "TAX", label: "Retención / Impuesto" },
                                { value: "ROUNDING", label: "Diferencia de Redondeo" },
                                { value: "OTHER", label: "Otro (Especificar)" },
                            ]}
                        />
                        <PeriodValidationDateInput
                            label="Fecha Contable"
                            date={diffDialog.accountingDate}
                            onDateChange={(date) => setDiffDialog(prev => ({ ...prev, accountingDate: date }))}
                            onValidityChange={setDiffDateValid}
                            validationType="accounting"
                        />
                        <LabeledInput
                            label="Notas Adicionales"
                            as="textarea"
                            rows={4}
                            value={diffNotes}
                            onChange={e => setDiffNotes(e.target.value)}
                            className="text-xs font-medium"
                        />
                    </div>
                </BaseModal>

                {/* ─── Create and Match Wizard ─── */}
                {createMatchDialog.line && (
                    <MovementWizard
                        open={createMatchDialog.open}
                        onOpenChange={(open) => setCreateMatchDialog(prev => ({ ...prev, open }))}
                        context="treasury"
                        variant="standard"
                        initialAccountName={statement?.treasury_account_name || "Cuenta Banco"}
                        fixedAccountId={treasuryAccountId}
                        fixedMoveType={parseFloat(createMatchDialog.line.credit) > parseFloat(createMatchDialog.line.debit) ? 'OTHER_IN' : 'OTHER_OUT'}
                        onComplete={handleCreateAndMatch}
                        onCancel={() => setCreateMatchDialog({ open: false, line: null })}
                    />
                )}

                {/* ─── General Treasury Movement Wizard ─── */}
                <MovementWizard
                    open={isCreateMovementOpen}
                    onOpenChange={setIsCreateMovementOpen}
                    context="treasury"
                    variant="standard"
                    initialAccountName={statement?.treasury_account_name || "Cuenta Banco"}
                    fixedAccountId={treasuryAccountId}
                    onComplete={handleCreateMovement}
                    onCancel={() => setIsCreateMovementOpen(false)}
                />

                {/* ─── S4.8: Auto-Match Progress with Polling ─── */}
                <AutoMatchProgressModal
                    open={autoMatchProgressOpen}
                    statementId={statementId}
                    confidenceThreshold={confidenceThreshold}
                    onOpenChange={(open) => {
                        setAutoMatchProgressOpen(open)
                    }}
                    onSuccess={(matchedCount) => {
                        setAutoMatchProgressOpen(false)
                        // Invalidate queries so the tables reflect the new matches
                        setBankParams(prev => ({ ...prev }))
                        setSystemParams(prev => ({ ...prev }))
                        if (unreconciledLines.length - matchedCount === 0) onComplete()
                    }}
                />

                {/* Floating Bottom Taskbar */}
                <ActionDock isVisible={selectedLines.length > 0 || selectedPayments.length > 0}>
                    {/* Suggestions Section */}
                    {selectedLines.length === 1 && selectedPayments.length === 0 && suggestions.length > 0 ? (
                        <ActionDock.Section className="mr-6 flex items-center gap-4 border-r px-4 border-border/40">
                            <div className="flex flex-col items-start gap-1">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3 text-warning-text animate-pulse" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-warning-text/80">Sugerencias</span>
                                </div>
                                {suggestions.length === 1 ? (
                                    <Button
                                        onClick={() => {
                                            const s = suggestions[0]
                                            const paymentId = s.is_batch ? s.batch_data?.id : s.payment_data?.id
                                            const item = unreconciledPayments.find(p => p.id === paymentId)
                                            if (item) {
                                                setSelectedPayments([item])
                                            } else if (s.is_batch && s.batch_data) {
                                                setSelectedPayments([{
                                                    id: s.batch_data.id,
                                                    amount: s.difference,
                                                    date: statement?.statement_date || "",
                                                    contact_name: s.batch_data.name || "Lote de terminal de cobro",
                                                    terminal_batch_id: s.batch_data.id,
                                                    display_id: s.batch_data.id.toString()
                                                } as ReconciliationSystemItem])
                                            } else if (s.payment_data) {
                                                setSelectedPayments([s.payment_data as ReconciliationSystemItem])
                                            }
                                        }}
                                        className="flex items-center gap-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-all rounded-full py-1 pl-3 pr-1 group shadow-card hover:shadow-elevated"
                                    >
                                        <span className="text-xs font-medium truncate max-w-[150px]">{suggestions[0].payment_data?.contact_name || suggestions[0].batch_data?.display_id || suggestions[0].batch_data?.name}</span>
                                        <div className="h-5 w-5 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-all duration-300">
                                            <ChevronRight className="h-3 w-3 text-warning-text group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </Button>
                                ) : (
                                    <Chip size="sm" intent="warning">
                                        {suggestions.length} Coincidencias
                                    </Chip>
                                )}
                            </div>
                        </ActionDock.Section>
                    ) : selectedPayments.length === 1 && selectedLines.length === 0 && lineSuggestions.length > 0 ? (
                        <ActionDock.Section className="mr-6 flex items-center gap-4 border-r px-4 border-border/40">
                            <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 text-warning-text animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-widest text-warning-text/80">Sugerencias</span>
                            </div>
                            {lineSuggestions.length === 1 ? (
                                <Button
                                    onClick={() => {
                                        const s = lineSuggestions[0]
                                        const lineId = s.line_data?.id
                                        const item = unreconciledLines.find(l => l.id === lineId)
                                        if (item) {
                                            setSelectedLines([item])
                                        } else if (s.line_data) {
                                            setSelectedLines([s.line_data as BankStatementLine])
                                        }
                                    }}
                                    className="flex items-center gap-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-all rounded-full py-1 pr-3 pl-1 group shadow-card hover:shadow-elevated"
                                >
                                    <div className="h-5 w-5 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-all duration-300">
                                        <ChevronLeft className="h-3 w-3 text-warning-text group-hover:-translate-x-0.5 transition-transform" />
                                    </div>
                                    <span className="text-xs font-medium truncate max-w-[150px]">{lineSuggestions[0].line_data?.description}</span>
                                    </Button>
                                ) : (
                                    <div className="bg-warning/10 border border-warning/20 rounded-full py-1 px-3 shadow-card">
                                        <span className="text-xs text-warning-text">{lineSuggestions.length} Coincidencias</span>
                                    </div>
                                )}
                            </div>
                        </ActionDock.Section>
                    ) : null}

                    {/* Summary Stats */}
                    <ActionDock.Stats>
                        <ActionDock.Stat
                            label={
                                <div className="flex items-center gap-2">
                                    <span>Banco</span>
                                    <Chip size="xs" intent="info">{selectedLines.length}</Chip>
                                </div>
                            }
                            value={formatCurrency(safeSum(selectedLines.map(l => Math.abs(safeDifference(safeParseFloat(l.credit), safeParseFloat(l.debit))))))}
                            colorClass="text-info"
                        />
                        <ActionDock.Stat
                            label={
                                <div className="flex items-center gap-2">
                                    <span>Tesorería</span>
                                    <Chip size="xs">{selectedPayments.length}</Chip>
                                </div>
                            }
                            value={formatCurrency(safeSum(selectedPayments.map(p => safeParseFloat(p.amount))))}
                        />

                        <ActionDock.Stat
                            label="Diferencia"
                            value={(() => {
                                const lineTotal = safeSum(selectedLines.map(l => Math.abs(safeDifference(safeParseFloat(l.credit), safeParseFloat(l.debit)))))
                                const payTotal = safeSum(selectedPayments.map(p => Math.abs(safeParseFloat(p.amount))))
                                return formatCurrency(safeDifference(lineTotal, payTotal))
                            })()}
                            colorClass={(() => {
                                const lineTotal = safeSum(selectedLines.map(l => Math.abs(safeDifference(safeParseFloat(l.credit), safeParseFloat(l.debit)))))
                                const payTotal = safeSum(selectedPayments.map(p => Math.abs(safeParseFloat(p.amount))))
                                const diff = safeDifference(lineTotal, payTotal)
                                return isZeroTolerance(diff) ? "text-success-text" : "text-warning-text"
                            })()}
                        />
                    </ActionDock.Stats>

                    <ActionDock.Actions>
                        {excludedSelected.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-control-md rounded-full px-4 text-xs font-semibold text-success-text hover:bg-success/10 hover:text-success-text"
                                disabled={restoringLines}
                                onClick={() => { void handleRestoreExcluded() }}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                Volver a incluir ({excludedSelected.length})
                            </Button>
                        )}
                        {selectedLines.length > 0 && selectedPayments.length === 0 && excludedSelected.length < selectedLines.length && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-control-md rounded-full px-4 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setActionDialog({ open: true, type: 'bulk_exclude' })}
                            >
                                <Ban className="h-3.5 w-3.5 mr-1.5" />
                                Excluir
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                                className="h-control-md rounded-full px-4 text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground"
                                onClick={() => { setSelectedLines([]); setSelectedPayments([]); }}
                        >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Limpiar
                        </Button>

                        <SubmitButton
                            loading={matching}
                            icon={<CheckCircle2 className="mr-2 h-4 w-4" />}
                            onClick={() => setActionDialog({ open: true, type: 'confirm_match' })}
                            disabled={selectedLines.length === 0 || selectedPayments.length === 0}
                            className="h-control-md rounded-full px-6 text-xs font-bold shadow-floating transition-transform active:scale-95"
                        >
                            Conciliar
                        </SubmitButton>
                    </ActionDock.Actions>
                </ActionDock>

                <ActionConfirmModal
                    open={actionDialog.open && actionDialog.type === 'confirm_match'}
                    onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}
                    onConfirm={() => handleGroupMatch(false)}
                    title="Confirmar Conciliación"
                    description={
                        <div className="space-y-4 pt-2">
                            <p>¿Estás seguro de que deseas conciliar estos movimientos?</p>

                        </div>
                    }
                    variant="destructive"
                    confirmText="Confirmar Conciliación"
                />

                {selectedMovement && (
                    <LazyDrawer
                        type={selectedMovement.type}
                        id={Number(selectedMovement.id)}
                        open={detailsOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                clearTransactionDetail()
                            }
                        }}
                    />
                )}

                {/* Inteligencia: panel desde la izquierda con overlay, sobre el contenido principal de la mesa */}
                <Drawer
                    open={intelOpen}
                    onOpenChange={setIntelOpen}
                    side="left"
                    boundary="embedded"
                    showOverlay
                    defaultSize={400}
                    title="Inteligencia"
                    icon={Brain}
                    fillContent
                    contentClassName="p-0"
                >
                    <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                        <ReconciliationIntelligencePanel accountId={treasuryAccountId} />
                    </div>
                </Drawer>
                </Collection.Root>
            </Tabs>
        </DndContext>
        </SkeletonShell>
    )
}
