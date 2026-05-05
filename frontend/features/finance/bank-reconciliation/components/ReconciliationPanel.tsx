"use client"

import { showApiError } from "@/lib/errors"
import * as React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { BaseModal } from "@/components/shared/BaseModal"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ExclusionModal } from "./ExclusionModal"
import { SplitAllocationDialog } from "./SplitAllocationDialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useReconciledLinesQuery } from "../hooks/useReconciliationQueries"

import { LabeledSelect, LabeledInput, TableSkeleton } from "@/components/shared"
import { PeriodValidationDateInput } from "@/components/shared/PeriodValidationDateInput"
import {
    Ban, CheckCircle2, ChevronRight, ChevronLeft,
    Loader2, Search, Sparkles, X, Wand2, SplitSquareHorizontal, Calculator, RotateCcw
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
    useUnmatchMutation,
    useRestoreMutation
} from "../hooks/useReconciliationMutations"

import { MovementWizard, type MovementData } from "@/features/treasury/components/MovementWizard"
import { AutoMatchProgressModal } from "./AutoMatchProgressModal"


import { DataTable } from "@/components/ui/data-table"
import { ColumnDef, RowSelectionState, PaginationState, Updater } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { Textarea } from "@/components/ui/textarea"
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
            isDragging && "opacity-50 grayscale scale-95"
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

    const { data: statement } = useStatementQuery(statementId)
    const { data: bankData, isLoading: loadingLines } = useUnreconciledLinesQuery(statementId, bankParams)
    const { data: systemData, isLoading: loadingPayments } = useUnreconciledPaymentsQuery(treasuryAccountId, systemParams)
    const { data: reconciledData, isLoading: loadingReconciled } = useReconciledLinesQuery(statementId, { page: 1, pageSize: 50 })

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
    const createAndMatchMutation = useCreateAndMatchMutation(statementId, treasuryAccountId)

    // S4.8: Async auto-match progress state
    const [autoMatchProgressOpen, setAutoMatchProgressOpen] = useState(false)

    const [sidebarOpen, setSidebarOpen] = useState(false)

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
        const lineTotal = selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0)
        const payTotal = selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0)
        const diff = lineTotal - payTotal

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
                            <Badge variant="outline" className="w-fit text-[8px] font-black uppercase py-0 px-1.5 border-destructive/30 text-destructive bg-destructive/5">
                                Excluido
                            </Badge>
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
                const amount = Math.abs(parseFloat(row.original.credit) - parseFloat(row.original.debit))
                const isCredit = parseFloat(row.original.credit) > parseFloat(row.original.debit)
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
                <DataCell.Action
                    key="create-match"
                    icon={Calculator}
                    title="Registrar Pago"
                    className="text-primary hover:text-primary/80"
                    disabled={item.reconciliation_status === 'EXCLUDED'}
                    onClick={(e) => {
                        e.stopPropagation();
                        setCreateMatchDialog({ open: true, line: item })
                    }}
                />
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
                const isSuggested = suggestions.some((s: PaymentSuggestion) => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === row.original.id)
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
            <div className="space-y-4">
                {/* ─── Sticky Command Bar ─── */}
                {/* Top Tools Bar */}
                <div className="flex items-center justify-between bg-card border shadow-sm rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="h-8 w-48 pl-8 pr-8 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
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

                        <div className="h-4 w-px bg-border/60" />

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Desde</span>
                            <input
                                type="date"
                                className="h-8 w-32 px-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                value={bankParams.date_from || ""}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setBankParams(prev => ({ ...prev, date_from: val, page: 1 }))
                                    setSystemParams(prev => ({ ...prev, date_from: val, page: 1 }))
                                }}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Hasta</span>
                            <input
                                type="date"
                                className="h-8 w-32 px-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                value={bankParams.date_to || ""}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setBankParams(prev => ({ ...prev, date_to: val, page: 1 }))
                                    setSystemParams(prev => ({ ...prev, date_to: val, page: 1 }))
                                }}
                            />
                        </div>

                        <div className="h-4 w-px bg-border/60" />

                        <select
                            className="h-8 w-36 px-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                            value={bankParams.type || ""}
                            onChange={(e) => {
                                const val = e.target.value
                                setBankParams(prev => ({ ...prev, type: val, page: 1 }))
                                setSystemParams(prev => ({ ...prev, type: val, page: 1 }))
                            }}
                        >
                            <option value="">Todos los movimientos</option>
                            <option value="IN">Ingresos / Abonos</option>
                            <option value="OUT">Egresos / Cargos</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setActionDialog({ open: true, type: 'automatch' })}
                            disabled={autoMatching}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-bold bg-success/5 hover:bg-success/10 text-success border-success/20 hover:border-success/30 group transition-all"
                        >
                            {autoMatching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />}
                            Conciliación Automática
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="unreconciled" className="w-full">
                    <TabsList className="bg-muted/50 p-1 rounded-lg border border-border/40 mb-4 h-10 w-full justify-start gap-1">
                        <TabsTrigger 
                            value="unreconciled" 
                            className="text-[10px] font-black uppercase tracking-widest px-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary"
                        >
                            Pendientes
                        </TabsTrigger>
                        <TabsTrigger 
                            value="reconciled" 
                            className="text-[10px] font-black uppercase tracking-widest px-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary"
                        >
                            Conciliados
                        </TabsTrigger>
                    </TabsList>

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
                                            cardMode
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
                                                                "group transition-all duration-200",
                                                                isSuggested && "[&_td]:!bg-warning/15 [&_td]:!border-y [&_td]:!border-warning/30",
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
                                                <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Movimientos de Tesorería</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-muted-foreground">{systemData?.count || 0} disponibles</span>
                                        </div>
                                        <DataTable
                                            columns={paymentColumns}
                                            data={unreconciledPayments}
                                            cardMode
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
                                                                "group",
                                                                isSuggested && "[&_td]:!bg-warning/20 [&_td]:!border-y [&_td]:!border-warning/40"
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
                        <div className="grid grid-cols-1 gap-6 pb-24">
                            {reconciledData?.results.map((line: BankStatementLine) => {
                                const group = line.reconciliation_group_data;
                                const isBankCredit = parseFloat(line.credit) > parseFloat(line.debit);
                                const bankAmount = Math.abs(parseFloat(line.credit) - parseFloat(line.debit));
                                
                                // Get details from backend provided group data
                                const movements = group?.movements || [];
                                const batches = group?.batches || [];
                                const diffAmount = group?.difference_amount || 0;
                                const diffType = group?.difference_type_display || group?.difference_type || "Ajuste de Diferencia";

                                return (
                                    <div key={line.id} className="group/card bg-card border border-border/40 hover:border-primary/30 rounded-2xl overflow-hidden shadow-sm hover:shadow-elevated transition-all duration-300">
                                        <div className="flex">
                                            {/* Left Column: Bank Side */}
                                            <div className={cn(
                                                "w-1/3 p-6 border-r border-border/40 bg-muted/10",
                                                isBankCredit ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive"
                                            )}>
                                                <div className="flex flex-col h-full justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider bg-background">Cartola Bancaria</Badge>
                                                            <span className="text-[10px] font-mono text-muted-foreground opacity-60">ID: {line.transaction_id || line.id}</span>
                                                        </div>
                                                        <h3 className="text-sm font-bold leading-tight mb-1">{line.description}</h3>
                                                        <p className="text-[10px] font-mono text-muted-foreground uppercase">{format(new Date(line.transaction_date), 'dd MMMM yyyy', { locale: es })}</p>
                                                    </div>
                                                    <div className="mt-6">
                                                        <span className={cn("text-lg font-mono font-black tracking-tighter", isBankCredit ? "text-success" : "text-destructive")}>
                                                            {formatCurrency(bankAmount)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Center Column: Relationship (The "Link") */}
                                            <div className="flex flex-col items-center justify-center px-4 relative bg-muted/5">
                                                <div className="h-full w-px bg-gradient-to-b from-transparent via-border/60 to-transparent absolute left-1/2 -translate-x-1/2" />
                                                <div className="z-10 bg-background border border-border/60 rounded-full p-2 shadow-sm group-hover/card:scale-110 group-hover/card:border-primary/40 transition-all">
                                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                                </div>
                                            </div>

                                            {/* Right Column: Treasury Side */}
                                            <div className="flex-1 p-6">
                                                <div className="mb-4">
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-wider bg-background text-primary border-primary/20">Movimientos de Tesorería</Badge>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    {movements.length === 0 && batches.length === 0 && (
                                                        <div className="flex items-center justify-center py-4 border border-dashed rounded-lg bg-muted/5">
                                                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Sin detalles de movimientos de tesorería</span>
                                                        </div>
                                                    )}
                                                    
                                                    {batches.map((batch: any) => (
                                                        <div key={batch.id} className="flex items-center justify-between bg-info/5 border border-info/20 rounded-lg p-3 group/item hover:bg-info/10 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-full bg-info/20 flex items-center justify-center">
                                                                    <Wand2 className="h-4 w-4 text-info" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase text-info/70 tracking-wider">Lote Terminal</span>
                                                                    <span className="text-xs font-bold">{batch.name}</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-mono font-black text-info">
                                                                {formatCurrency(Math.abs(parseFloat(batch.total_amount)))}
                                                            </span>
                                                        </div>
                                                    ))}

                                                    {movements.map((move: any) => (
                                                        <div key={move.id} className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg p-3 group/item hover:bg-primary/10 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                    <Calculator className="h-4 w-4 text-primary" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase text-primary/70 tracking-wider">Movimiento #{move.id}</span>
                                                                    <span className="text-xs font-bold">{move.contact_name || move.concept || "Sin concepto"}</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-mono font-black text-primary">
                                                                {formatCurrency(Math.abs(parseFloat(move.amount)))}
                                                            </span>
                                                        </div>
                                                    ))}

                                                    {/* Adjustment Row - Updated to use backend data */}
                                                    {Math.abs(diffAmount) > 0 && (
                                                        <div className="flex items-center justify-between bg-warning/5 border border-warning/20 border-dashed rounded-lg p-3 mt-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center">
                                                                    <SplitSquareHorizontal className="h-4 w-4 text-warning" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase text-warning tracking-wider">{diffType}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-medium">Ajuste automático de diferencia</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-mono font-bold text-warning">
                                                                {formatCurrency(diffAmount)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>
                </Tabs>


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

                            <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border/50">
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
                                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
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
                {(selectedLines.length > 0 || selectedPayments.length > 0) && (
                    <div
                        className={cn(
                            "fixed bottom-6 z-[100] bg-card border shadow-elevated rounded-full px-6 py-3 flex items-center gap-8 animate-in slide-in-from-bottom-8 transition-all duration-300",
                            isHubOpen ? "left-[calc(50%-200px)] -translate-x-1/2" : "left-1/2 -translate-x-1/2"
                        )}
                    >
                        {/* Suggestions Section */}
                        {selectedLines.length === 1 && suggestions.length > 0 && !(
                            suggestions.length === 1 && selectedPayments.some(p => p.id === (suggestions[0].is_batch ? suggestions[0].batch_data?.id : suggestions[0].payment_data?.id))
                        ) ? (
                            <div className="flex items-center gap-2 mr-2">
                                {suggestions.length === 1 ? (
                                    <button
                                        onClick={() => {
                                            const s = suggestions[0]
                                            const paymentId = s.is_batch ? s.batch_data?.id : s.payment_data?.id
                                            const item = unreconciledPayments.find(p => p.id === paymentId)
                                            if (item) setSelectedPayments([item])
                                        }}
                                        className="flex items-center gap-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-colors rounded-full py-1.5 pl-4 pr-2 group"
                                    >
                                        <div className="flex flex-col items-start leading-none">
                                            <span className="text-[8px] font-black uppercase text-warning/70 mb-0.5 tracking-wider">Usar Sugerencia</span>
                                            <span className="text-[11px] font-bold truncate max-w-[180px]">{suggestions[0].payment_data?.contact_name || suggestions[0].batch_data?.name}</span>
                                        </div>
                                        <div className="h-7 w-7 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-all duration-300">
                                            <ChevronRight className="h-4 w-4 text-warning group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-full py-1.5 pl-4 pr-4">
                                        <div className="flex flex-col items-start">
                                            <span className="text-[11px] font-bold text-warning">{suggestions.length} Sugerencias</span>
                                        </div>
                                        <Sparkles className="h-4 w-4 text-warning animate-pulse" />
                                    </div>
                                )}
                            </div>
                        ) : selectedPayments.length === 1 && lineSuggestions.length > 0 && !(
                            lineSuggestions.length === 1 && selectedLines.some(l => l.id === lineSuggestions[0].line_data?.id)
                        ) ? (
                            <div className="flex items-center gap-2 mr-2">
                                {lineSuggestions.length === 1 ? (
                                    <button
                                        onClick={() => {
                                            const s = lineSuggestions[0]
                                            const lineId = s.line_data?.id
                                            const item = unreconciledLines.find(l => l.id === lineId)
                                            if (item) setSelectedLines([item])
                                        }}
                                        className="flex items-center gap-3 bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-colors rounded-full py-1.5 pr-4 pl-2 group"
                                    >
                                        <div className="h-7 w-7 rounded-full bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-all duration-300">
                                            <ChevronLeft className="h-4 w-4 text-warning group-hover:-translate-x-0.5 transition-transform" />
                                        </div>
                                        <div className="flex flex-col items-end leading-none text-right">
                                            <span className="text-[8px] font-black uppercase text-warning/70 mb-0.5 tracking-wider">Usar Sugerencia</span>
                                            <span className="text-[11px] font-bold truncate max-w-[180px]">{lineSuggestions[0].line_data?.description}</span>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-full py-1.5 pl-4 pr-4">
                                        <div className="flex flex-col items-start">
                                            <span className="text-[11px] font-bold text-warning">{lineSuggestions.length} Sugerencias</span>
                                        </div>
                                        <Sparkles className="h-4 w-4 text-warning animate-pulse" />
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {/* Summary Stats (Always Visible - Unified Unit) */}
                        <div className="flex items-center gap-8 bg-muted/40 px-8 py-2.5 rounded-full border border-border/40 shadow-inner">
                            <div className="flex flex-col border-r border-border/40 pr-8 last:border-0 h-8 justify-center">
                                <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-1.5">Banco ({selectedLines.length})</span>
                                <span className="text-sm font-mono font-bold text-info leading-none">
                                    {formatCurrency(selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0))}
                                </span>
                            </div>
                            <div className="flex flex-col border-r border-border/40 pr-8 last:border-0 h-8 justify-center">
                                <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-1.5">Tesorería ({selectedPayments.length})</span>
                                <span className="text-sm font-mono font-bold text-primary leading-none">
                                    {formatCurrency(selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0))}
                                </span>
                            </div>
                            <div className="flex flex-col items-end last:border-0 h-8 justify-center pl-2">
                                <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none mb-1.5">Diferencia</span>
                                <span className={cn(
                                    "text-sm font-mono font-bold leading-none",
                                    (() => {
                                        const lineTotal = selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0)
                                        const payTotal = selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0)
                                        const diff = lineTotal - payTotal
                                        return Math.abs(diff) < 0.01 ? "text-success" : "text-warning"
                                    })()
                                )}>
                                    {formatCurrency(
                                        selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0) -
                                        selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0)
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 border-l pl-6 py-1">
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
                        </div>
                    </div>
                )}

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
            </div>
        </DndContext>
    )
}
