"use client"

import * as React from "react"
import { formatCurrency } from "@/lib/money"
import {useState, useEffect, useMemo, useCallback} from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import { ExclusionModal } from "./ExclusionModal"
import { SplitAllocationDialog } from "./SplitAllocationDialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useReconciledLinesQuery } from "../hooks/useReconciliationQueries"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { ActionConfirmModal, ActionDock, BaseModal, CancelButton, Chip, CollapsibleSheet, EmptyState, FormFooter, LabeledInput, LabeledSelect, PeriodValidationDateInput, SkeletonShell, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation, SEG_TRIGGER, SEG_WRAPPER } from '@/components/shared'
import { reconciliationSearchDef } from "../searchDef"
import { reconciliationSegDef } from "../segmentationDef"

import { isZeroTolerance, safeDifference, safeSum, safeParseFloat } from "@/lib/math"
import {
    Ban, CheckCircle2, ChevronRight, ChevronLeft, FileText,
    Loader2, Sparkles, X, Wand2, Calculator, Brain, Plus
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { financeApi } from "../../api/financeApi"
import { cn, parseDateOnly } from "@/lib/utils"
import {
    DndContext,
    type DragEndEvent,
    useDraggable,
    useDroppable,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
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
    useCreateMovementMutation
} from "../hooks/useReconciliationMutations"

import { useServerDate } from '@/hooks/useServerDate'
import { MovementWizard, type MovementData } from "@/features/treasury"
import { AutoMatchProgressModal } from "./AutoMatchProgressModal"
import { ReconciliationIntelligence } from "./ReconciliationIntelligence"

import { DataTable } from '@/components/shared'
import { LazyDrawer } from "@/features/_shared/transaction-drawer"
import { type ColumnDef, type RowSelectionState, type PaginationState, type Updater } from "@tanstack/react-table"
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { statementLineActions, type StatementLineActionsCtx } from './statementLineActions'
import { systemItemActions, type SystemItemActionsCtx } from './systemItemActions'

import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Types moved to types.ts or correctly imported
import type {
    BankStatementLine,
    ReconciliationSystemItem,
    ReconciliationMovement,
    ReconciliationBatch,
    QueryPaginationParams
} from "../types"

interface ReconGroupData {
    id: number
    movements: ReconciliationMovement[]
    batches: ReconciliationBatch[]
    difference_amount: number
    difference_type: string
    difference_type_display: string
    difference_journal_entry?: number
}

interface PaymentSuggestion {
    is_batch?: boolean
    payment_data?: { id: number, contact_name: string }
    batch_data?: { id: number, name: string }
    difference: string
}

interface LineSuggestion {
    line_data: { id: number, description: string }
}

interface ReconciliationPanelProps {
    statementId: number
    treasuryAccountId: number
    onComplete: () => void
}

// ─── DnD Wrappers ────────────────────────────────────────────────────────────

function DraggablePayment({ id, children, disabled }: { id: number, children: React.ReactNode, disabled?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `payment-${id}`,
        data: { type: 'payment', id },
        disabled
    });

    const style = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
    } : undefined;

    if (!React.isValidElement(children)) return <>{children}</>;
    const child = children as React.ReactElement<Record<string, unknown>>;

    return React.cloneElement(child, {
        ref: setNodeRef,
        style: { ...style, ...(child.props.style as React.CSSProperties | undefined) },
        className: cn(
            child.props.className as string,
            "touch-none",
            isDragging && "opacity-50 grayscale-[0.5] scale-95"
        ),
        ...listeners,
        ...attributes
    } as Record<string, unknown>);
}

function DroppableBankLine({ id, children }: { id: number, children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `line-${id}`,
        data: { type: 'line', id }
    });

    if (!React.isValidElement(children)) return <>{children}</>;
    const child = children as React.ReactElement<Record<string, unknown>>;

    return React.cloneElement(child, {
        ref: setNodeRef,
        className: cn(
            child.props.className as string,
            "transition-all duration-200",
            isOver && "bg-primary/20 scale-[1.01] shadow-overlay ring-2 ring-primary ring-inset z-10 relative"
        )
    });
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

    const { filters: textFilters } = useSmartSearch(reconciliationSearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters } = useSegmentation(reconciliationSegDef, basePeriod)
    const allFilters = { ...textFilters, ...segFilters }

    // Synchronize smart search filters to query parameters
    useEffect(() => {
        const f = allFilters
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
    }, [allFilters])

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
    const { data: reconciledData, isLoading: loadingReconciled, isError: isErrorReconciled } = useReconciledLinesQuery(statementId, { page: 1, pageSize: 200 })

    const reconciledGroups = useMemo(() => {
        if (!reconciledData?.results) return []
        const groups: Record<number, { id: number; group: ReconGroupData; lines: BankStatementLine[] }> = {} as Record<number, { id: number; group: ReconGroupData; lines: BankStatementLine[] }>

        reconciledData.results.forEach(line => {
            const groupData = line.reconciliation_group_data
            if (groupData) {
                if (!groups[groupData.id]) {
                    groups[groupData.id] = { id: groupData.id, group: groupData, lines: [] }
                }
                groups[groupData.id].lines.push(line)
            }
        })

        return Object.values(groups)
    }, [reconciledData])
    const unreconciledLines: BankStatementLine[] = bankData?.results || []
    const unreconciledPayments: ReconciliationSystemItem[] = systemData?.results || []

    const { data: suggestions = [] } = useLineSuggestionsQuery(lineIdStr, selectedLines.length === 1)
    const { data: lineSuggestions = [] } = usePaymentSuggestionsQuery(paymentIdStr, selectedPayments.length === 1)

    const matchMutation = useMatchMutation(statementId, treasuryAccountId)
    const groupMatchMutation = useGroupMatchMutation(statementId, treasuryAccountId)
    const autoMatchMutation = useAutoMatchMutation(statementId)
    const excludeMutation = useExcludeMutation(statementId)
    const bulkExcludeMutation = useBulkExcludeMutation(statementId)
    const restoreMutation = useRestoreMutation(statementId)

    const loading = loadingLines || loadingPayments || loadingReconciled
    const isError = isErrorStmt || isErrorBank || isErrorSystem || isErrorReconciled
    const matching = matchMutation.isPending || groupMatchMutation.isPending
    const autoMatching = autoMatchMutation.isPending

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

    const statementLineActionsCtx: StatementLineActionsCtx = {
        onExclude: (lineId) => setActionDialog({ open: true, type: 'exclude', lineId }),
        onRestore: (lineId) => restoreMutation.mutate(lineId),
    }

    const systemItemActionsCtx: SystemItemActionsCtx = {
        onSplit: (payment) => setSplitDialog({ open: true, payment }),
    }

    const [confidenceThreshold, setConfidenceThreshold] = useState<number>(90)

    // Create and Match "On the fly"
    const [createMatchDialog, setCreateMatchDialog] = useState<{ open: boolean, line: BankStatementLine | null }>({
        open: false, line: null
    })
    const [isCreateMovementOpen, setIsCreateMovementOpen] = useState(false)
    const createAndMatchMutation = useCreateAndMatchMutation(statementId, treasuryAccountId)
    const createMovementMutation = useCreateMovementMutation(treasuryAccountId)

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

    const handleLineSelectionChange = useCallback((selection: RowSelectionState) => {
        const selected = Object.keys(selection).map(index => unreconciledLines[parseInt(index)])
        setSelectedLines(selected.filter(Boolean))
    }, [unreconciledLines])

    const handlePaymentSelectionChange = useCallback((selection: RowSelectionState) => {
        const selected = Object.keys(selection).map(index => unreconciledPayments[parseInt(index)])
        setSelectedPayments(selected.filter(Boolean))
    }, [unreconciledPayments])

    const bankRowSelection = useMemo(() => {
        const selection: RowSelectionState = {}
        unreconciledLines.forEach((l, index) => {
            if (selectedLines.some(sl => sl.id === l.id)) {
                selection[index] = true
            }
        })
        return selection
    }, [unreconciledLines, selectedLines])

    const systemRowSelection = useMemo(() => {
        const selection: RowSelectionState = {}
        unreconciledPayments.forEach((p, index) => {
            if (selectedPayments.some(sp => sp.id === p.id)) {
                selection[index] = true
            }
        })
        return selection
    }, [unreconciledPayments, selectedPayments])

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

            await matchMutation.mutateAsync({ lineId, paymentId, isBatch, confirmData })

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

            await groupMatchMutation.mutateAsync({ payload, confirmPayload, lineId: selectedLines[0].id })

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
            const paymentId = active.data.current.id;
            const lineId = over.data.current.id;

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
            await createAndMatchMutation.mutateAsync({
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
            await createMovementMutation.mutateAsync(payload)
            setIsCreateMovementOpen(false)
        } catch (error) {
            throw error
        }
    }

    // ─── Column Definitions ───────────────────────────────────────────────────

    const bankColumns = useMemo<ColumnDef<BankStatementLine>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    variant="circle"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    variant="circle"
                />
            ),
            size: 40,
        },
        {
            accessorKey: "transaction_date",
            header: "Fecha",
            cell: ({ row }) => (
                <div className="flex flex-col justify-center h-full">
                    <span className="font-mono font-bold text-xs">
                        {format(parseDateOnly(row.original.transaction_date), 'dd MMM yy', { locale: es })}
                    </span>
                    <span className="text-[10px] font-black uppercase text-muted-foreground opacity-50"> {/* intentional: badge density */} L{row.original.line_number}</span>
                </div>
            ),
            size: 80,
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => {
                const isSuggested = lineSuggestions.some((s: LineSuggestion) => s.line_data.id === row.original.id)
                return (
                    <div className="flex flex-col gap-0.5 max-w-[220px] justify-center h-full py-1">
                        <span className={cn("text-xs font-bold truncate", isSuggested && "text-warning")}>
                            {row.original.description}
                        </span>
                        {row.original.reconciliation_status === 'EXCLUDED' && (
                            <Chip size="xs" intent="destructive">
                                Excluido
                            </Chip>
                        )}
                        {row.original.reference && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate opacity-70"> REF: {row.original.reference}</span>
                        )}
                        {isSuggested && (
                            <div className="flex items-center gap-1 mt-0.5">
                                <Sparkles className="h-2.5 w-2.5 text-warning" />
                                <span className="text-[10px] font-black uppercase text-warning"> {/* intentional: badge density */} Match Sugerido</span>
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            id: "type",
            header: "Tipo",
            cell: ({ row }) => {
                const isCredit = parseFloat(row.original.credit) > parseFloat(row.original.debit)
                return (
                    <DataCell.Chip intent={isCredit ? "success" : "destructive"}>
                        {isCredit ? "Abono" : "Cargo"}
                    </DataCell.Chip>
                )
            },
            size: 70,
        },
        {
            id: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-end" />,
            cell: ({ row }) => {
                const amount = Math.abs(safeDifference(safeParseFloat(row.original.credit), safeParseFloat(row.original.debit)))
                const isCredit = safeParseFloat(row.original.credit) > safeParseFloat(row.original.debit)
                return (
                    <div className="flex flex-col items-end justify-center h-full">
                        <span className={cn("font-mono font-black text-sm tracking-tight", isCredit ? "text-success" : "text-destructive")}>
                            {formatCurrency(amount)}
                        </span>
                    </div>
                )
            },
            size: 100,
        },
        statementLineActions.column(statementLineActionsCtx)
    ], [lineSuggestions, setActionDialog, setCreateMatchDialog])

    const paymentColumns = useMemo<ColumnDef<ReconciliationSystemItem>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    variant="circle"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    variant="circle"
                />
            ),
            size: 40,
        },
        {
            accessorKey: "date",
            header: "Documento",
            cell: ({ row }) => (
                <div className="flex flex-col justify-center h-full">
                    <span className="font-mono font-bold text-xs">
                        {row.original.display_id || row.original.code || 'PEND'}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground"> {/* intentional: badge density */}
                        {format(parseDateOnly(row.original.date), 'dd/MM/yy', { locale: es })}
                    </span>
                </div>
            ),
            size: 90,
        },
        {
            accessorKey: "contact_name",
            header: "Entidad / Concepto",
            cell: ({ row }) => {
                const isSuggested = suggestions.some((s: PaymentSuggestion) =>
                    s.is_batch ? s.batch_data?.id === row.original.terminal_batch_id : s.payment_data?.id === row.original.id
                )
                return (
                    <div className="flex flex-col gap-0.5 max-w-[220px] justify-center h-full py-1">
                        <span className={cn("text-xs font-bold truncate", isSuggested && "text-warning")}>
                            {row.original.contact_name}
                        </span>
                        {row.original.terminal_batch_id && (
                            <Chip size="xs" intent="info" className="w-fit">
                                Liquidación Terminal: {row.original.terminal_batch_display}
                            </Chip>
                        )}
                        {isSuggested && (
                            <div className="flex items-center gap-1 mt-0.5">
                                <Sparkles className="h-2.5 w-2.5 text-warning shadow-card" />
                                <span className="text-[10px] font-black uppercase text-warning"> {/* intentional: badge density */} Match Sugerido</span>
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            id: "type",
            header: "Tipo",
            cell: ({ row }) => {
                const item = row.original
                const isDeposit = (
                    item.movement_type === 'INBOUND' ||
                    (item.movement_type === 'TRANSFER' && item.to_account === treasuryAccountId)
                )
                let label = isDeposit ? "Ingreso" : "Egreso"
                if (item.movement_type === 'TRANSFER') label = isDeposit ? "Transf. Entrante" : "Transf. Saliente"
                if (item.movement_type === 'ADJUSTMENT') label = "Ajuste"

                return (
                    <DataCell.Chip intent={isDeposit ? "success" : "destructive"}>
                        {label}
                    </DataCell.Chip>
                )
            },
            size: 90,
        },
        {
            id: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-end" />,
            cell: ({ row }) => {
                const item = row.original
                const isDeposit = (
                    item.movement_type === 'INBOUND' ||
                    (item.movement_type === 'TRANSFER' && item.to_account === treasuryAccountId)
                )
                return (
                    <div className="flex flex-col items-end justify-center h-full">
                        <span className={cn(
                            "font-mono font-black text-sm tracking-tight group-hover:scale-105 transition-transform",
                            isDeposit ? "text-success" : "text-destructive"
                        )}>
                            {formatCurrency(Math.abs(parseFloat(item.amount)))}
                        </span>
                    </div>
                )
            },
            size: 100,
        },
        systemItemActions.column(systemItemActionsCtx)
    ], [suggestions])

    // ─── Render ───────────────────────────────────────────────────────────────

    if (isError) {
        return <EmptyState context="finance" variant="compact" title="Error al cargar datos" description="No se pudieron cargar los datos de conciliación." />
    }

    if (loading) return <SkeletonShell isLoading ariaLabel="Cargando..." />

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <Tabs defaultValue="unreconciled" className="h-full flex flex-col w-full min-h-0">
                {/* ─── Unified Workbench Toolbar ─── */}
                <div className="flex items-center justify-between gap-4 w-full mb-3 h-9">
                    {/* Left: Smart Search Bar + Segmentation (Unified Filtering for Both Tables) */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 h-9">
                        <SmartSearchBar
                            searchDef={reconciliationSearchDef}
                            placeholder="Buscar movimientos y pagos por descripción, monto..."
                            className="flex-1"
                        />
                        <SegmentationBar def={reconciliationSegDef} basePeriod={basePeriod} />
                    </div>

                    {/* Right: Actions & Navigation Group */}
                    <div className="flex items-center gap-3 shrink-0 h-9">
                        {/* Navigation Tabs List */}
                        <div className={SEG_WRAPPER}>
                            <TabsList className="h-7 p-0 gap-0 bg-transparent shrink-0">
                                <TabsTrigger
                                    value="unreconciled"
                                    className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
                                >
                                    Pendientes
                                </TabsTrigger>
                                <TabsTrigger
                                    value="reconciled"
                                    className={SEG_TRIGGER + " data-[state=active]:bg-accent/50 data-[state=active]:shadow-none rounded-sm hover:bg-accent/30 transition-all duration-150"}
                                >
                                    Conciliados
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => setActionDialog({ open: true, type: 'automatch' })}
                                    disabled={autoMatching}
                                    variant="ghost"
                                    className="h-9 w-9 p-0 bg-success/5 hover:bg-success/10 text-success group transition-all"
                                >
                                    {autoMatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 group-hover:rotate-12 transition-transform" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Auto-Match</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => setIntelOpen(prev => !prev)}
                                    variant="ghost"
                                    className={cn(
                                        "h-9 w-9 p-0 transition-all",
                                        intelOpen && "bg-primary text-primary-foreground"
                                    )}
                                >
                                    <Brain className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Configurar Inteligencia</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <TabsContent value="unreconciled" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                    <div className="flex-1 min-h-0 flex gap-6 relative items-start pb-24">
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-primary hover:bg-primary/0 rounded-full"

                                            >

                                            </Button>
                                        </div>
                                        <span className="text-[10px] font-mono text-muted-foreground">{bankData?.count || 0} pendientes</span>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <DataTable
                                            columns={bankColumns}
                                            data={unreconciledLines}
                                            variant="embedded"
                                            rowSelection={bankRowSelection}
                                            onRowSelectionChange={handleLineSelectionChange}
                                            skeletonRows={10}
                                            pageSizeOptions={[50, 100]}
                                            defaultPageSize={50}
                                            renderRow={(row, children) => {
                                                const line = row.original as BankStatementLine
                                                const isSuggested = lineSuggestions.some((s: LineSuggestion) => s.line_data?.id === line.id)
                                                const isExcluded = line.reconciliation_status === 'EXCLUDED' || (line as unknown as Record<string, unknown>).reconciliation_state === 'EXCLUDED'

                                                if (!React.isValidElement(children)) return children as unknown as React.ReactElement

                                                return (
                                                    <DroppableBankLine id={line.id}>
                                                        {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
                                                            className: cn(
                                                                (children.props as Record<string, unknown>).className as string,
                                                                "group transition-all duration-300",
                                                                isSuggested && "[&_td]:!bg-warning/[0.08] [&_td]:!border-y [&_td]:!border-warning/40 shadow-[inset_0_0_20px_oklch(var(--warning-raw)/0.05)]",
                                                                isExcluded && "opacity-40 grayscale-[0.5] [&_td]:!bg-muted/30"
                                                            )
                                                        } as Record<string, unknown>)}
                                                    </DroppableBankLine>
                                                )
                                            }}
                                            onPaginationChange={(updater: Updater<PaginationState>) => {
                                                if (typeof updater === 'function') {
                                                    const newState = updater({ pageIndex: (bankParams.page || 1) - 1, pageSize: bankParams.pageSize || 50 })
                                                    setBankParams(p => ({ ...p, page: newState.pageIndex + 1, pageSize: newState.pageSize }))
                                                } else {
                                                    setBankParams(p => ({ ...p, page: updater.pageIndex + 1, pageSize: updater.pageSize }))
                                                }
                                            }}
                                            manualPagination
                                            pageCount={Math.ceil((bankData?.count || 0) / (bankParams.pageSize || 50))}
                                            rowCount={bankData?.count || 0}
                                            pagination={{ pageIndex: (bankParams.page || 1) - 1, pageSize: bankParams.pageSize || 50 }}
                                        />
                                    </div>
                                </div>

                                {/* Right: Treasury (Renamed from System) */}
                                <div className="h-full flex flex-col min-h-0 space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Movimientos del Sistema</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-primary hover:bg-primary/10 rounded-full"
                                                onClick={() => setIsCreateMovementOpen(true)}
                                                title="Crear Movimiento de Tesorería"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <span className="text-[10px] font-mono text-muted-foreground">{systemData?.count || 0} disponibles</span>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <DataTable
                                            columns={paymentColumns}
                                            data={unreconciledPayments}
                                            variant="embedded"
                                            rowSelection={systemRowSelection}
                                            onRowSelectionChange={handlePaymentSelectionChange}
                                            skeletonRows={10}
                                            pageSizeOptions={[50, 100]}
                                            defaultPageSize={50}
                                            renderRow={(row, children) => {
                                                const item = row.original as ReconciliationSystemItem
                                                const isSuggested = suggestions.some((s: PaymentSuggestion) => {
                                                    if (s.is_batch) {
                                                        return s.batch_data?.id === item.terminal_batch_id
                                                    }
                                                    return s.payment_data?.id === item.id
                                                })
                                                if (!React.isValidElement(children)) return children as unknown as React.ReactElement

                                                return (
                                                    <DraggablePayment id={item.id}>
                                                        {React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
                                                            className: cn(
                                                                (children.props as Record<string, unknown>).className as string,
                                                                "group transition-all duration-300",
                                                                isSuggested && "[&_td]:!bg-warning/[0.12] [&_td]:!border-y [&_td]:!border-warning/50 shadow-[inset_0_0_20px_oklch(var(--warning-raw)/0.08)]"
                                                            )
                                                        } as Record<string, unknown>)}
                                                    </DraggablePayment>
                                                )
                                            }}
                                            onPaginationChange={(updater: Updater<PaginationState>) => {
                                                if (typeof updater === 'function') {
                                                    const newState = updater({ pageIndex: (systemParams.page || 1) - 1, pageSize: systemParams.pageSize || 50 })
                                                    setSystemParams(p => ({ ...p, page: newState.pageIndex + 1, pageSize: newState.pageSize }))
                                                } else {
                                                    setSystemParams(p => ({ ...p, page: updater.pageIndex + 1, pageSize: updater.pageSize }))
                                                }
                                            }}
                                            manualPagination
                                            pageCount={Math.ceil((systemData?.count || 0) / (systemParams.pageSize || 50))}
                                            rowCount={systemData?.count || 0}
                                            pagination={{ pageIndex: (systemParams.page || 1) - 1, pageSize: systemParams.pageSize || 50 }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="reconciled" className="flex-1 min-h-0 overflow-y-auto mt-0 data-[state=inactive]:hidden custom-scrollbar">
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
                                <div key={groupItem.id} className="group/card bg-transparent border border-border/40 hover:border-primary/20 rounded-md overflow-hidden transition-all duration-300">
                                    <div className="flex">
                                        {/* Left Column: Bank Side (Can have multiple lines) */}
                                        <div className="w-[40%] p-6 flex flex-col justify-start border-r border-border/40 relative">
                                            {/* Connecting Visual Resource */}
                                            <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                                                <div className="h-6 w-6 rounded-full bg-background border border-border/40 flex items-center justify-center text-primary shadow-card group-hover/card:border-primary/40 transition-all">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Cartola Bancaria ({lines.length})</span>
                                                </div>

                                                <div className="space-y-2">
                                                    {lines.map((line) => {
                                                        const isBankCredit = parseFloat(line.credit) > parseFloat(line.debit);
                                                        const bankAmount = Math.abs(parseFloat(line.credit) - parseFloat(line.debit));

                                                        return (
                                                            <div key={line.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border/40 rounded-md hover:border-primary/20 transition-all shadow-card">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-8 rounded-sm bg-background border border-border/40 flex items-center justify-center text-muted-foreground shrink-0">
                                                                        <FileText className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[9px] font-mono font-black uppercase text-muted-foreground opacity-60">Línea: {line.line_number}</span>
                                                                        <h3 className="text-xs font-bold leading-tight text-foreground/90 truncate max-w-[200px]">{line.description}</h3>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right shrink-0">
                                                                    <span className="text-[9px] font-mono font-bold text-muted-foreground/60 uppercase block mb-0.5">
                                                                        {format(parseDateOnly(line.transaction_date), 'dd MMM yyyy', { locale: es })}
                                                                    </span>
                                                                    <span className={cn(
                                                                        "text-sm font-mono font-black tracking-tighter leading-none",
                                                                        isBankCredit ? "text-success" : "text-destructive"
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
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Movimientos del Sistema ({movements.length + batches.length})</span>
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
                                                                    <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">
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
                                                                    <span className="text-xs font-black uppercase tracking-widest text-primary">Lote Terminal</span>
                                                                    <span className="text-[10px] text-primary/70 font-bold">{b.terminal_name || 'Terminal'} - {b.display_id}</span>
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
                                                                <div className="h-8 w-8 rounded-sm bg-warning/10 flex items-center justify-center text-warning">
                                                                    <Calculator className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black uppercase tracking-widest text-warning">{diffType}</span>
                                                                    <span className="text-[10px] text-warning/70 font-bold italic">Ajuste automático de diferencia</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-mono font-bold text-warning">
                                                                {formatCurrency(diffAmount)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* ─── Modals ─── */}
                <ExclusionModal
                    open={actionDialog.open && (actionDialog.type === 'exclude' || actionDialog.type === 'bulk_exclude')}
                    onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}
                    title={actionDialog.type === 'bulk_exclude' ? `Excluir ${selectedLines.length} Movimientos` : "Excluir Movimiento"}
                    onConfirm={async (reason, notes) => {
                        const isBulk = actionDialog.type === 'bulk_exclude'
                        const affectedCount = isBulk ? selectedLines.length : 1

                        try {
                            if (isBulk) {
                                await bulkExcludeMutation.mutateAsync({
                                    lineIds: selectedLines.map(l => l.id),
                                    reason,
                                    notes
                                })
                                setSelectedLines([])
                            } else if (actionDialog.lineId) {
                                await excludeMutation.mutateAsync({
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
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase opacity-50">
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
                            <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 flex items-start gap-3">
                                <Ban className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[11px] font-black uppercase text-destructive leading-none">Acción Irreversible</p>
                                    <p className="text-[10px] text-destructive/80 font-medium">Una vez confirmada, esta conciliación y su ajuste contable no podrán ser revertidos desde este workbench.</p>
                                </div>
                            </div>
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
                            placeholder="Ej. Comisión por transferencia internacional..."
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
                                    <Sparkles className="h-3 w-3 text-warning animate-pulse" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-warning/80">Sugerencias</span>
                                </div>
                                {suggestions.length === 1 ? (
                                    <button
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
                                                    contact_name: s.batch_data.name || "Lote Terminal",
                                                    terminal_batch_id: s.batch_data.id,
                                                    display_id: s.batch_data.id.toString()
                                                } as ReconciliationSystemItem])
                                            } else if (s.payment_data) {
                                                setSelectedPayments([s.payment_data as ReconciliationSystemItem])
                                            }
                                        }}
                                        className="flex items-center gap-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-all rounded-full py-1 pl-3 pr-1 group shadow-card hover:shadow-elevated"
                                    >
                                        <span className="text-xs font-bold truncate max-w-[150px]">{suggestions[0].payment_data?.contact_name || suggestions[0].batch_data?.display_id || suggestions[0].batch_data?.name}</span>
                                        <div className="h-5 w-5 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-all duration-300">
                                            <ChevronRight className="h-3 w-3 text-warning group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </button>
                                ) : (
                                    <div className="bg-warning/10 border border-warning/20 rounded-full py-1 px-3 shadow-card">
                                        <span className="text-xs text-warning">{suggestions.length} Coincidencias</span>
                                    </div>
                                )}
                            </div>
                        </ActionDock.Section>
                    ) : selectedPayments.length === 1 && selectedLines.length === 0 && lineSuggestions.length > 0 ? (
                        <ActionDock.Section className="mr-6 flex items-center gap-4 border-r px-4 border-border/40">
                            <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 text-warning animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-widest text-warning/80">Sugerencias</span>
                            </div>
                            {lineSuggestions.length === 1 ? (
                                <button
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
                                        <ChevronLeft className="h-3 w-3 text-warning group-hover:-translate-x-0.5 transition-transform" />
                                    </div>
                                    <span className="text-xs font-bold truncate max-w-[150px]">{lineSuggestions[0].line_data?.description}</span>
                                    </button>
                                ) : (
                                    <div className="bg-warning/10 border border-warning/20 rounded-full py-1 px-3 shadow-card">
                                        <span className="text-xs text-warning">{lineSuggestions.length} Coincidencias</span>
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
                                return isZeroTolerance(diff) ? "text-success" : "text-warning"
                            })()}
                        />
                    </ActionDock.Stats>

                    <ActionDock.Actions>
                        {selectedLines.length > 0 && selectedPayments.length === 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 rounded-full px-4 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => setActionDialog({ open: true, type: 'bulk_exclude' })}
                            >
                                <Ban className="h-3.5 w-3.5 mr-1.5" />
                                Excluir
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                                className="h-9 rounded-full px-4 text-xs text-muted-foreground hover:bg-muted"
                                onClick={() => { setSelectedLines([]); setSelectedPayments([]); }}
                        >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Limpiar
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-full px-6 text-xs font-bold text-primary hover:bg-primary/10 shadow-floating transition-transform active:scale-95"
                            onClick={() => setActionDialog({ open: true, type: 'confirm_match' })}
                            disabled={matching || selectedLines.length === 0 || selectedPayments.length === 0}
                        >
                            {matching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Conciliar
                        </Button>
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
                            <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 flex items-start gap-3">
                                <Ban className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[11px] font-black uppercase text-destructive leading-none">Acción Irreversible</p>
                                    <p className="text-[10px] text-destructive/80 font-medium">Esta acción es permanente. Asegúrate de que los montos coincidan correctamente antes de continuar.</p>
                                </div>
                            </div>
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

                {/* Intelligence Panel (DRY CollapsibleSheet Pattern) */}
                <CollapsibleSheet
                    sheetId="reconciliation-intel"
                    open={intelOpen}
                    onOpenChange={setIntelOpen}
                    tabLabel="Inteligencia"
                    tabIcon={Brain}
                    fullWidth={400}
                >
                    <div className="flex flex-col h-full bg-background rounded-md overflow-hidden text-foreground">
                        <div className="p-4 border-b bg-muted/30 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="bg-primary/10 p-1.5 rounded-sm">
                                    <Brain className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/90 leading-tight">Inteligencia</h2>
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Configuración de Matching</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                                onClick={() => setIntelOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <ReconciliationIntelligence />
                        </div>
                    </div>
                </CollapsibleSheet>
            </Tabs>
        </DndContext>
    )
}
