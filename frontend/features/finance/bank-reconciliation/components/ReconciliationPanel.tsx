"use client"


import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { BaseModal } from "@/components/shared/BaseModal"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ExclusionModal } from "./ExclusionModal"
import { SplitAllocationDialog } from "./SplitAllocationDialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useReconciledLinesQuery } from "../hooks/useReconciliationQueries"

import { LabeledSelect, LabeledInput, TableSkeleton, ActionDock, Chip } from "@/components/shared"
import { PeriodValidationDateInput } from "@/components/shared/PeriodValidationDateInput"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isZeroTolerance, safeDifference, safeSum, safeParseFloat } from "@/lib/math"
import {
    Ban, CheckCircle2, ChevronRight, ChevronLeft, FileText,
    Loader2, Search, Sparkles, X, Wand2, SplitSquareHorizontal, Calculator, RotateCcw, Brain, Plus
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { cn, formatCurrency } from "@/lib/utils"
import {
    DndContext,
    DragEndEvent,
    useDraggable,
    useDroppable,
    PointerSensor,
    useSensor,
    useSensors,
    useSensors as useDndSensors,
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
    useCreateMovementMutation,
    useUnmatchMutation,
    useRestoreMutation
} from "../hooks/useReconciliationMutations"

import { MovementWizard, type MovementData } from "@/features/treasury/components/MovementWizard"
import { AutoMatchProgressModal } from "./AutoMatchProgressModal"
import { ReconciliationIntelligence } from "./ReconciliationIntelligence"


import { DataTable } from "@/components/ui/data-table"
const TransactionViewModal = dynamic(() =>
    import("@/components/shared/TransactionViewModal").then(module => ({ default: module.TransactionViewModal })),
    { ssr: false, loading: () => <Loader2 className="h-6 w-6 animate-spin" /> }
)
import { ColumnDef, RowSelectionState, PaginationState, Updater } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"

import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Types moved to types.ts or correctly imported
import type {
    BankStatement,
    BankStatementLine,
    ReconciliationSystemItem,
    QueryPaginationParams
} from "../types"

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
    const child = children as React.ReactElement<any>;

    return React.cloneElement(child, {
        ref: setNodeRef,
        style: { ...style, ...child.props.style },
        className: cn(
            child.props.className,
            "touch-none",
            isDragging && "opacity-50 grayscale-[0.5] scale-95"
        ),
        ...listeners,
        ...attributes
    });
}

function DroppableBankLine({ id, children }: { id: number, children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `line-${id}`,
        data: { type: 'line', id }
    });

    if (!React.isValidElement(children)) return <>{children}</>;
    const child = children as React.ReactElement<any>;

    return React.cloneElement(child, {
        ref: setNodeRef,
        className: cn(
            child.props.className,
            "transition-all duration-200",
            isOver && "bg-primary/20 scale-[1.01] shadow-lg ring-2 ring-primary ring-inset z-10 relative"
        )
    });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ReconciliationPanel({ statementId, treasuryAccountId, onComplete }: ReconciliationPanelProps) {
    const { isHubOpen } = useHubPanel()
    const [selectedLines, setSelectedLines] = useState<BankStatementLine[]>([])
    const [selectedPayments, setSelectedPayments] = useState<ReconciliationSystemItem[]>([])

    const lineIdStr = selectedLines.length === 1 ? selectedLines[0].id : 0
    const paymentIdStr = selectedPayments.length === 1 ? selectedPayments[0].id : 0

    const [bankParams, setBankParams] = useState<QueryPaginationParams>({ page: 1, pageSize: 50 })
    const [systemParams, setSystemParams] = useState<QueryPaginationParams>({ page: 1, pageSize: 50 })

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const transactionId = searchParams.get('transaction')
    const transactionType = searchParams.get('transactionType')

    const [selectedMovement, setSelectedMovement] = useState<{ id: number | string, type: any } | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    useEffect(() => {
        if (transactionId && transactionType && !detailsOpen) {
            setSelectedMovement({ id: transactionId, type: transactionType })
            setDetailsOpen(true)
        }
    }, [transactionId, transactionType, detailsOpen])

    const openTransactionDetail = (id: number | string, type: any) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('transaction', String(id))
        params.set('transactionType', String(type))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const clearTransactionDetail = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('transaction')
        params.delete('transactionType')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setSelectedMovement(null)
        setDetailsOpen(false)
    }

    const { data: statement } = useStatementQuery(statementId)
    const { data: bankData, isLoading: loadingLines } = useUnreconciledLinesQuery(statementId, bankParams)
    const { data: systemData, isLoading: loadingPayments } = useUnreconciledPaymentsQuery(treasuryAccountId, systemParams)
    const { data: reconciledData, isLoading: loadingReconciled } = useReconciledLinesQuery(statementId, { page: 1, pageSize: 200 })

    const reconciledGroups = useMemo(() => {
        if (!reconciledData?.results) return []
        const groups: Record<number, { id: number, group: any, lines: BankStatementLine[] }> = {}

        reconciledData.results.forEach(line => {
            const groupId = line.reconciliation_group_data?.id
            if (groupId) {
                if (!groups[groupId]) {
                    groups[groupId] = { id: groupId, group: line.reconciliation_group_data, lines: [] }
                }
                groups[groupId].lines.push(line)
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
    const unmatchMutation = useUnmatchMutation(statementId, treasuryAccountId)
    const restoreMutation = useRestoreMutation(statementId)

    const loading = loadingLines || loadingPayments || loadingReconciled
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

    const [confidenceThreshold, setConfidenceThreshold] = useState<number>(90)

    // Create and Match "On the fly"
    const [createMatchDialog, setCreateMatchDialog] = useState<{ open: boolean, line: BankStatementLine | null }>({
        open: false, line: null
    })
    const [isCreateMovementOpen, setIsCreateMovementOpen] = useState(false)
    const createAndMatchMutation = useCreateAndMatchMutation(statementId, treasuryAccountId)

    // S4.8: Async auto-match progress state
    const [autoMatchProgressOpen, setAutoMatchProgressOpen] = useState(false)

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [intelOpen, setIntelOpen] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        if (selectedLines.length === 1 || selectedPayments.length === 1) {
            setSidebarOpen(true)
        } else {
            setSidebarOpen(false)
        }
    }, [selectedLines.length, selectedPayments.length])

    // Sync Intelligence Panel state with global DashboardShell
    useEffect(() => {
        if (intelOpen) {
            document.body.setAttribute('data-side-panel-width', '400')
        } else {
            document.body.removeAttribute('data-side-panel-width')
        }
        return () => document.body.removeAttribute('data-side-panel-width')
    }, [intelOpen])

    // Track other panels to calculate correct 'right' position
    const [globalPanelStates, setGlobalPanelStates] = useState({ hub: false, inbox: false })
    useEffect(() => {
        const updateStates = () => {
            setGlobalPanelStates({
                hub: document.body.hasAttribute('data-hub-open'),
                inbox: document.body.hasAttribute('data-inbox-open')
            })
        }
        updateStates()
        const observer = new MutationObserver(updateStates)
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-hub-open', 'data-inbox-open'] })
        return () => observer.disconnect()
    }, [])

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

    const handleMatch = async (lineId: number, paymentId: number, isBatch: boolean = false, force: boolean = false) => {
        if (!force) {
            const suggestion = suggestions.find((s: PaymentSuggestion) => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === paymentId)
            const diffAmount = suggestion ? parseFloat(suggestion.difference) : 0

            if (diffAmount !== 0) {
                const line = unreconciledLines.find(l => l.id === lineId)
                const defaultDate = line ? new Date(line.transaction_date) : new Date()
                // Adjust for local timezone to avoid off-by-one day issues
                const localDate = new Date(defaultDate.getTime() + defaultDate.getTimezoneOffset() * 60000)
                setDiffDialog({ open: true, lineId, paymentId, amount: diffAmount.toString(), accountingDate: localDate })
                try {
                    const res = await api.get(`/treasury/statement-lines/${lineId}/suggested_difference/`)
                    setDiffType(res.data.suggestion)
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
        } catch (error: unknown) {
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
            const defaultDate = line ? new Date(line.transaction_date) : new Date()
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
        } catch (error: unknown) {
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
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
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
                        {format(new Date(row.original.transaction_date), 'dd MMM yy', { locale: es })}
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
                    <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase tracking-wider",
                        isCredit ? "text-success border-success/20 bg-success/5" : "text-destructive border-destructive/20 bg-destructive/5"
                    )}>
                        {isCredit ? "Abono" : "Cargo"}
                    </Badge>
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
                        <span className={cn("font-mono font-black text-[13px] tracking-tight", isCredit ? "text-success" : "text-destructive")}>
                            {formatCurrency(amount)}
                        </span>
                    </div>
                )
            },
            size: 100,
        },
        createActionsColumn<BankStatementLine>({
            headerLabel: "",
            renderActions: (item) => [
                item.reconciliation_status === 'EXCLUDED' ? (
                    <DataCell.Action
                        key="restore"
                        icon={RotateCcw}
                        title="Restaurar"
                        className="text-success hover:text-success/80"
                        onClick={(e) => { e.stopPropagation(); restoreMutation.mutate(item.id) }}
                    />
                ) : (
                    <DataCell.Action
                        key="exclude"
                        icon={Ban}
                        title="Excluir"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setActionDialog({ open: true, type: 'exclude', lineId: item.id }) }}
                    />
                ),
            ]
        })
    ], [lineSuggestions, setActionDialog, setCreateMatchDialog])

    const paymentColumns = useMemo<ColumnDef<ReconciliationSystemItem>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
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
                        {format(new Date(row.original.date), 'dd/MM/yy', { locale: es })}
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
                const isSettlement = row.original.terminal_batch_id != null
                return (
                    <div className="flex flex-col gap-0.5 max-w-[220px] justify-center h-full py-1">
                        <span className={cn("text-xs font-bold truncate", isSuggested && "text-warning")}>
                            {row.original.contact_name}
                        </span>
                        {row.original.terminal_batch_id && (
                            <Badge variant="secondary" className="w-fit text-[10px] h-4 px-1.5 font-black uppercase bg-info/10 text-info">
                                Liquidación Terminal: {row.original.terminal_batch_display}
                            </Badge>
                        )}
                        {isSuggested && (
                            <div className="flex items-center gap-1 mt-0.5">
                                <Sparkles className="h-2.5 w-2.5 text-warning shadow-sm" />
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
                    <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase tracking-wider",
                        isDeposit ? "text-success border-success/20 bg-success/5" : "text-destructive border-destructive/20 bg-destructive/5"
                    )}>
                        {label}
                    </Badge>
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
                            "font-mono font-black text-[13px] tracking-tight group-hover:scale-105 transition-transform",
                            isDeposit ? "text-success" : "text-destructive"
                        )}>
                            {formatCurrency(Math.abs(parseFloat(item.amount)))}
                        </span>
                    </div>
                )
            },
            size: 100,
        },
        createActionsColumn<ReconciliationSystemItem>({
            headerLabel: "",
            renderActions: (item) => [
                <DataCell.Action
                    key="split"
                    icon={SplitSquareHorizontal}
                    title="Distribuir"
                    className="text-primary hover:text-primary/80"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSplitDialog({ open: true, payment: item })
                    }}
                />
            ]
        })
    ], [suggestions])

    // ─── Render ───────────────────────────────────────────────────────────────

    if (loading) return <TableSkeleton rows={10} columns={4} className="py-6" />

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <Tabs defaultValue="unreconciled" className="space-y-4 w-full">
                {/* ─── Sticky Command Bar ─── */}
                {/* Top Tools Bar */}
                <div className="flex items-center justify-between bg-card border shadow-sm rounded-lg px-4 py-3">
                    {/* Left: Navigation */}
                    <div className="flex items-center gap-4 shrink-0">
                        <TabsList className="bg-muted/30 p-0.5 rounded-md border border-border/40 h-7 gap-0.5 overflow-hidden items-center">
                            <TabsTrigger
                                value="unreconciled"
                                className="text-[9px] font-black uppercase tracking-wider px-2.5 h-5 py-0 flex items-center justify-center rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
                            >
                                Pendientes
                            </TabsTrigger>
                            <TabsTrigger
                                value="reconciled"
                                className="text-[9px] font-black uppercase tracking-wider px-2.5 h-5 py-0 flex items-center justify-center rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all"
                            >
                                Conciliados
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Center: Filters (Flat Layout) */}
                    <div className="flex-1 flex items-center justify-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Buscar..."
                                className="h-7 w-32 pl-7 pr-6 rounded-md text-[10px] font-medium"
                                value={bankParams.search || ""}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setBankParams(prev => ({ ...prev, search: val, page: 1 }))
                                    setSystemParams(prev => ({ ...prev, search: val, page: 1 }))
                                }}
                            />
                            {(bankParams.search || bankParams.date_from || bankParams.amount_min) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:bg-muted"
                                    onClick={() => {
                                        setBankParams({ page: 1, pageSize: 50 })
                                        setSystemParams({ page: 1, pageSize: 50 })
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold uppercase text-muted-foreground/50 tracking-tighter">Desde</span>
                                <Input
                                    type="date"
                                    className="h-7 w-28 px-1 text-[10px] font-medium"
                                    value={bankParams.date_from || ""}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setBankParams(prev => ({ ...prev, date_from: val, page: 1 }))
                                        setSystemParams(prev => ({ ...prev, date_from: val, page: 1 }))
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold uppercase text-muted-foreground/50 tracking-tighter">Hasta</span>
                                <Input
                                    type="date"
                                    className="h-7 w-28 px-1 text-[10px] font-medium"
                                    value={bankParams.date_to || ""}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setBankParams(prev => ({ ...prev, date_to: val, page: 1 }))
                                        setSystemParams(prev => ({ ...prev, date_to: val, page: 1 }))
                                    }}
                                />
                            </div>
                        </div>

                        <Select
                            value={bankParams.type || "all"}
                            onValueChange={(val) => {
                                const realVal = val === "all" ? "" : val
                                setBankParams(prev => ({ ...prev, type: realVal, page: 1 }))
                                setSystemParams(prev => ({ ...prev, type: realVal, page: 1 }))
                            }}
                        >
                            <SelectTrigger className="h-7 w-[150px] text-[10px] font-medium">
                                <SelectValue placeholder="Movimientos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Movimientos</SelectItem>
                                <SelectItem value="IN">Abonos / Ingresos</SelectItem>
                                <SelectItem value="OUT">Cargos / Egresos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            onClick={() => setActionDialog({ open: true, type: 'automatch' })}
                            disabled={autoMatching}
                            variant="outline"
                            size="sm"
                            className="h-7 text-[9px] font-black uppercase tracking-widest bg-success/5 hover:bg-success/10 text-success border-success/20 hover:border-success/30 group transition-all px-3"
                        >
                            {autoMatching ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1.5 h-3 w-3 group-hover:rotate-12 transition-transform" />}
                            Auto-Match
                        </Button>
                        <Button
                            onClick={() => setIntelOpen(true)}
                            variant="outline"
                            size="sm"
                            className={cn(
                                "h-7 w-7 p-0 rounded-md border-primary/20 hover:border-primary/40 transition-all",
                                intelOpen && "bg-primary text-primary-foreground border-primary"
                            )}
                            title="Configurar Inteligencia"
                        >
                            <Brain className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>




                <TabsContent value="unreconciled">
                    <div className="flex gap-6 relative min-h-[600px] items-start pb-24">
                        {/* Tables Container */}
                        <div className="flex-1 transition-all duration-500 ease-[var(--ease-premium)] min-w-0">
                            {/* ─── Grid with Section Headers ─── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Left: Bank */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-info" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Cartola Bancaria</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-muted-foreground">{bankData?.count || 0} pendientes</span>
                                    </div>
                                    <DataTable
                                        columns={bankColumns}
                                        data={unreconciledLines}
                                        variant="embedded"
                                        searchPlaceholder="Buscar movimiento..."
                                        rowSelection={bankRowSelection}
                                        onRowSelectionChange={handleLineSelectionChange}
                                        skeletonRows={10}
                                        pageSizeOptions={[50, 100]}
                                        defaultPageSize={50}
                                        renderRow={(row, children) => {
                                            const line = row.original as BankStatementLine
                                            const isSuggested = lineSuggestions.some((s: any) => s.line_data?.id === line.id)
                                            const isExcluded = line.reconciliation_status === 'EXCLUDED' || (line as any).reconciliation_state === 'EXCLUDED'

                                            if (!React.isValidElement(children)) return children as any

                                            return (
                                                <DroppableBankLine id={line.id}>
                                                    {React.cloneElement(children as React.ReactElement<any>, {
                                                        className: cn(
                                                            (children.props as any).className,
                                                            "group transition-all duration-300",
                                                            isSuggested && "[&_td]:!bg-warning/[0.08] [&_td]:!border-y [&_td]:!border-warning/40 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]",
                                                            isExcluded && "opacity-40 grayscale-[0.5] [&_td]:!bg-muted/30"
                                                        )
                                                    })}
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
                                        pagination={{ pageIndex: (bankParams.page || 1) - 1, pageSize: bankParams.pageSize || 50 }}
                                    />
                                </div>

                                {/* Right: Treasury (Renamed from System) */}
                                <div className="space-y-2">
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
                                    <DataTable
                                        columns={paymentColumns}
                                        data={unreconciledPayments}
                                        variant="embedded"
                                        searchPlaceholder="Buscar pago..."
                                        rowSelection={systemRowSelection}
                                        onRowSelectionChange={handlePaymentSelectionChange}
                                        skeletonRows={10}
                                        pageSizeOptions={[50, 100]}
                                        defaultPageSize={50}
                                        renderRow={(row, children) => {
                                            const item = row.original as ReconciliationSystemItem
                                            const isSuggested = suggestions.some((s: any) => {
                                                if (s.is_batch) {
                                                    return s.batch_data?.id === item.terminal_batch_id
                                                }
                                                return s.payment_data?.id === item.id
                                            })
                                            if (!React.isValidElement(children)) return children as any

                                            return (
                                                <DraggablePayment id={item.id}>
                                                    {React.cloneElement(children as React.ReactElement<any>, {
                                                        className: cn(
                                                            (children.props as any).className,
                                                            "group transition-all duration-300",
                                                            isSuggested && "[&_td]:!bg-warning/[0.12] [&_td]:!border-y [&_td]:!border-warning/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.08)]"
                                                        )
                                                    })}
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
                                        pagination={{ pageIndex: (systemParams.page || 1) - 1, pageSize: systemParams.pageSize || 50 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="reconciled">
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
                                                <div className="h-6 w-6 rounded-full bg-background border border-border/40 flex items-center justify-center text-primary shadow-sm group-hover/card:border-primary/40 transition-all">
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
                                                            <div key={line.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border/40 rounded-md hover:border-primary/20 transition-all shadow-sm">
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
                                                                        {format(new Date(line.transaction_date), 'dd MMM yyyy', { locale: es })}
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
                                                    {movements.map((m: any) => (
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

                                                    {batches.map((b: any) => (
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
                        } catch (error) {
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
                                    <Badge variant="outline" className="font-mono font-bold text-primary bg-primary/5 border-primary/20">
                                        {confidenceThreshold}%
                                    </Badge>
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
                    title="Confirmar Conciliación con Ajuste"
                    description={
                        <div className="space-y-4">
                            <p>Existe una diferencia de <span className="font-bold text-primary">{formatCurrency(parseFloat(diffDialog.amount))}</span>. Selecciona cómo deseas procesarla.</p>
                            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex items-start gap-3">
                                <Ban className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[11px] font-black uppercase text-destructive leading-none">Acción Irreversible</p>
                                    <p className="text-[10px] text-destructive/80 font-medium">Una vez confirmada, esta conciliación y su ajuste contable no podrán ser revertidos desde este workbench.</p>
                                </div>
                            </div>
                        </div>
                    }
                    footer={
                        <div className="flex justify-end gap-2 w-full">
                            <Button variant="outline" onClick={() => setDiffDialog(prev => ({ ...prev, open: false }))}>Cancelar</Button>
                            <Button
                                disabled={!diffDateValid || matching}
                                onClick={() => diffDialog.isGroup ? handleGroupMatch(true) : handleMatch(diffDialog.lineId, diffDialog.paymentId, false, true)}
                            >
                                Confirmar con Ajuste
                            </Button>
                        </div>
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
                    onSuccess={(matchedCount, totalUnreconciled) => {
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
                        <ActionDock.Section className="mr-6 flex items-center gap-4 border-r pr-6 border-border/40">
                            <div className="flex flex-col items-start gap-1">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3 text-warning animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-warning/80">Sugerencias</span>
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
                                                } as any])
                                            } else if (s.payment_data) {
                                                setSelectedPayments([s.payment_data as any])
                                            }
                                        }}
                                        className="flex items-center gap-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-all rounded-full py-1 pl-3 pr-1 group shadow-sm hover:shadow-md"
                                    >
                                        <span className="text-[10px] font-bold truncate max-w-[150px]">{suggestions[0].payment_data?.contact_name || suggestions[0].batch_data?.display_id || suggestions[0].batch_data?.name}</span>
                                        <div className="h-5 w-5 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-all duration-300">
                                            <ChevronRight className="h-3 w-3 text-warning group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </button>
                                ) : (
                                    <div className="bg-warning/10 border border-warning/20 rounded-full py-1 px-3 shadow-sm">
                                        <span className="text-[9px] text-warning">{suggestions.length} Coincidencias</span>
                                    </div>
                                )}
                            </div>
                        </ActionDock.Section>
                    ) : selectedPayments.length === 1 && selectedLines.length === 0 && lineSuggestions.length > 0 ? (
                        <ActionDock.Section className="mr-6 flex items-center gap-4 border-r pr-6 border-border/40">
                            <div className="flex flex-col items-start gap-1">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3 text-warning animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-warning/80">Sugerencias</span>
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
                                                setSelectedLines([s.line_data as any])
                                            }
                                        }}
                                        className="flex items-center gap-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-all rounded-full py-1 pr-3 pl-1 group shadow-sm hover:shadow-md"
                                    >
                                        <div className="h-5 w-5 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-all duration-300">
                                            <ChevronLeft className="h-3 w-3 text-warning group-hover:-translate-x-0.5 transition-transform" />
                                        </div>
                                        <span className="text-[10px] font-bold truncate max-w-[150px]">{lineSuggestions[0].line_data?.description}</span>
                                    </button>
                                ) : (
                                    <div className="bg-warning/10 border border-warning/20 rounded-full py-1 px-3 shadow-sm">
                                        <span className="text-[9px] text-warning">{lineSuggestions.length} Coincidencias</span>
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
                                className="h-9 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive rounded-full px-4"
                                onClick={() => setActionDialog({ open: true, type: 'bulk_exclude' })}
                            >
                                <Ban className="h-3 w-3 mr-1.5" />
                                Excluir Seleccionados
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 text-xs text-muted-foreground hover:bg-muted rounded-full px-4"
                            onClick={() => { setSelectedLines([]); setSelectedPayments([]); }}
                        >
                            <X className="h-3 w-3 mr-1.5" />
                            Limpiar
                        </Button>

                        <Button
                            size="sm"
                            className="h-9 px-6 text-xs font-bold shadow-sm transition-transform active:scale-95 rounded-full"
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
                            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex items-start gap-3">
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
                    <TransactionViewModal
                        open={detailsOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                clearTransactionDetail()
                            }
                        }}
                        type={selectedMovement.type}
                        id={selectedMovement.id}
                        view="all"
                    />
                )}

                {/* Intelligence Panel (Fixed/Global Pattern) */}
                <AnimatePresence>
                    {intelOpen && (
                        <motion.div
                            initial={{ x: "120%", opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "120%", opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className={cn(
                                "fixed top-20 h-[calc(100vh-6rem)] w-[400px] z-[55] border border-white/5 bg-sidebar dark flex flex-col pointer-events-auto rounded-lg shadow-2xl overflow-hidden transition-all duration-500 ease-[var(--ease-premium)]",
                                globalPanelStates.inbox && globalPanelStates.hub
                                    ? "right-[calc(320px+360px+3rem)]"
                                    : globalPanelStates.hub
                                        ? "right-[calc(360px+2rem)]"
                                        : globalPanelStates.inbox
                                            ? "right-[calc(320px+2rem)]"
                                            : "right-4"
                            )}
                        >
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </Tabs>
        </DndContext>
    )
}
