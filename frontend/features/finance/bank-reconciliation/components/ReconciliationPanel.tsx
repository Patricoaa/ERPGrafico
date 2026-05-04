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

import { LabeledSelect, LabeledInput, TableSkeleton } from "@/components/shared"
import {
    Ban, CheckCircle2, ChevronRight,
    Loader2, Search, Sparkles, X, Wand2, SplitSquareHorizontal, Calculator
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
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
    useUnmatchMutation
} from "../hooks/useReconciliationMutations"

import { MovementWizard, type MovementData } from "@/features/treasury/components/MovementWizard"
import { AutoMatchProgressModal } from "./AutoMatchProgressModal"


import { DataTable } from "@/components/ui/data-table"
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
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
    const [selectedLines, setSelectedLines] = useState<BankStatementLine[]>([])
    const [selectedPayments, setSelectedPayments] = useState<ReconciliationSystemItem[]>([])

    const lineIdStr = selectedLines.length === 1 ? selectedLines[0].id : 0
    const paymentIdStr = selectedPayments.length === 1 ? selectedPayments[0].id : 0

    const [bankParams, setBankParams] = useState<QueryPaginationParams>({ page: 1, pageSize: 50 })
    const [systemParams, setSystemParams] = useState<QueryPaginationParams>({ page: 1, pageSize: 50 })

    const { data: statement } = useStatementQuery(statementId)
    const { data: bankData, isLoading: loadingLines } = useUnreconciledLinesQuery(statementId, bankParams)
    const { data: systemData, isLoading: loadingPayments } = useUnreconciledPaymentsQuery(treasuryAccountId, systemParams)
    
    const unreconciledLines = bankData?.results || []
    const unreconciledPayments = systemData?.results || []

    const { data: suggestions = [] } = useLineSuggestionsQuery(lineIdStr, selectedLines.length === 1)
    const { data: lineSuggestions = [] } = usePaymentSuggestionsQuery(paymentIdStr, selectedPayments.length === 1)

    const matchMutation = useMatchMutation(statementId, treasuryAccountId)
    const groupMatchMutation = useGroupMatchMutation(statementId, treasuryAccountId)
    const autoMatchMutation = useAutoMatchMutation(statementId)
    const excludeMutation = useExcludeMutation(statementId)
    const bulkExcludeMutation = useBulkExcludeMutation(statementId)
    const unmatchMutation = useUnmatchMutation(statementId, treasuryAccountId)

    const loading = loadingLines || loadingPayments
    const matching = matchMutation.isPending || groupMatchMutation.isPending
    const autoMatching = autoMatchMutation.isPending

    const [diffDialog, setDiffDialog] = useState<{ open: boolean, lineId: number, paymentId: number, amount: string, isGroup?: boolean }>({
        open: false, lineId: 0, paymentId: 0, amount: '0', isGroup: false
    })
    const [diffType, setDiffType] = useState<string>("COMMISSION")
    const [diffNotes, setDiffNotes] = useState<string>("")

    const [actionDialog, setActionDialog] = useState<{
        open: boolean,
        type: 'exclude' | 'bulk_exclude' | 'automatch' | null,
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

    // ─── Matching Logic ───────────────────────────────────────────────────────

    const handleMatch = async (lineId: number, paymentId: number, isBatch: boolean = false, force: boolean = false) => {
        if (!force) {
            const suggestion = suggestions.find((s: PaymentSuggestion) => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === paymentId)
            const diffAmount = suggestion ? parseFloat(suggestion.difference) : 0

            if (diffAmount !== 0) {
                setDiffDialog({ open: true, lineId, paymentId, amount: diffAmount.toString() })
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
            }

            await matchMutation.mutateAsync({ lineId, paymentId, isBatch, confirmData })

            setDiffDialog(prev => ({ ...prev, open: false }))
            setDiffNotes("")
            
            toast.success("Match realizado", {
                action: {
                    label: "Deshacer",
                    onClick: () => unmatchMutation.mutate(lineId)
                }
            })

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
            setDiffDialog({ open: true, lineId: selectedLines[0].id, paymentId: 0, amount: diff.toString(), isGroup: true })
            setDiffType(diff < 0 ? "COMMISSION" : "ROUNDING")
            return
        }

        try {
            const payload: Record<string, unknown> = {
                line_ids: selectedLines.map(l => l.id),
                payment_ids: selectedPayments.filter(p => !p.is_batch).map(p => p.id),
                batch_ids: selectedPayments.filter(p => p.is_batch).map(p => p.id)
            }

            if (force) { payload.difference_reason = diffType; payload.notes = diffNotes; }

            const confirmPayload: Record<string, unknown> = {}
            if (force) { confirmPayload.difference_type = diffType; confirmPayload.notes = diffNotes; }

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
                        {row.original.reference && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate opacity-70"> {/* intentional: badge density */} REF: {row.original.reference}</span>
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
                <DataCell.Action
                    key="exclude"
                    icon={Ban}
                    title="Excluir"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setActionDialog({ open: true, type: 'exclude', lineId: item.id }) }}
                />,
                <DataCell.Action
                    key="create-match"
                    icon={Calculator}
                    title="Registrar Pago"
                    className="text-primary hover:text-primary/80"
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
                const isBatch = row.original.is_batch
                const isSuggested = suggestions.some((s: PaymentSuggestion) => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === row.original.id)
                return (
                    <div className="flex flex-col gap-0.5 max-w-[220px] justify-center h-full py-1">
                        <span className={cn("text-xs font-bold truncate", isSuggested && "text-warning")}>
                            {row.original.contact_name}
                        </span>
                        {isBatch && (
                            <Badge variant="secondary" className="w-fit text-[10px] h-4 px-1.5 font-black uppercase bg-info/10 text-info">Lote Terminal</Badge>
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
                const isDeposit = item.is_batch || (
                    item.movement_type === 'INBOUND' || 
                    (item.movement_type === 'TRANSFER' && item.to_account === treasuryAccountId)
                )
                let label = isDeposit ? "Ingreso" : "Egreso"
                if (item.movement_type === 'TRANSFER') label = isDeposit ? "Transf. Entrante" : "Transf. Saliente"
                if (item.movement_type === 'ADJUSTMENT') label = "Ajuste"
                if (item.is_batch) label = "Lote"
                
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
                const isDeposit = item.is_batch || (
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
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Extracto Bancario</span>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground">{bankData?.count || 0} pendientes</span>
                            </div>
                            <DataTable
                                columns={bankColumns}
                                data={unreconciledLines}
                                cardMode
                                searchPlaceholder="Buscar movimiento..."
                                onRowSelectionChange={handleLineSelectionChange}
                                skeletonRows={10}
                                pageSizeOptions={[50, 100]}
                                defaultPageSize={50}
                                renderRow={(row, children) => {
                                    const isSuggested = suggestions.some((s: any) => s.line_data?.id === (row.original as BankStatementLine).id)
                                    return (
                                        <DroppableBankLine id={(row.original as BankStatementLine).id}>
                                            {React.cloneElement(children as React.ReactElement, {
                                                className: cn(
                                                    (children as React.ReactElement).props.className,
                                                    "group",
                                                    isSuggested && "[&_td]:!bg-warning/20 [&_td]:!border-y [&_td]:!border-warning/40"
                                                )
                                            })}
                                        </DroppableBankLine>
                                    )
                                }}
                                onPaginationChange={(updater) => {
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

                        {/* Right: System */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Movimientos Sistema</span>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground">{systemData?.count || 0} disponibles</span>
                            </div>
                            <DataTable
                                columns={paymentColumns}
                                data={unreconciledPayments}
                                cardMode
                                searchPlaceholder="Buscar pago..."
                                onRowSelectionChange={handlePaymentSelectionChange}
                                skeletonRows={10}
                                pageSizeOptions={[50, 100]}
                                defaultPageSize={50}
                                renderRow={(row, children) => {
                                    const item = row.original as ReconciliationSystemItem
                                    const isSuggested = lineSuggestions.some((s: any) => 
                                        (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === item.id
                                    )
                                    return (
                                        <DraggablePayment id={item.id}>
                                            {React.cloneElement(children as React.ReactElement, {
                                                className: cn(
                                                    (children as React.ReactElement).props.className,
                                                    "group",
                                                    isSuggested && "[&_td]:!bg-warning/20 [&_td]:!border-y [&_td]:!border-warning/40"
                                                )
                                            })}
                                        </DraggablePayment>
                                    )
                                }}
                                onPaginationChange={(updater) => {
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

                {/* Floating Bottom Taskbar */}
                {(selectedLines.length > 0 || selectedPayments.length > 0) && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-elevated rounded-full px-6 py-3 flex items-center gap-8 animate-in slide-in-from-bottom-8">
                        {/* Suggestion Card (if applicable) */}
                        {(() => {
                            if (selectedLines.length === 1 && suggestions.length > 0) {
                                const s = suggestions[0]
                                return (
                                    <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-full py-1.5 pl-4 pr-1.5 mr-2">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase text-warning tracking-tight">Sugerencia de Match</span>
                                            <span className="text-[11px] font-bold text-foreground truncate max-w-[120px]">
                                                {s.is_batch ? s.batch_data?.name : s.payment_data?.contact_name}
                                            </span>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            className="h-7 text-[10px] font-black uppercase bg-warning text-warning-foreground hover:bg-warning/90 rounded-full"
                                            onClick={() => handleMatch(selectedLines[0].id, s.is_batch ? s.batch_data?.id : s.payment_data?.id, s.is_batch)}
                                        >
                                            Conciliar Match
                                        </Button>
                                    </div>
                                )
                            }
                            if (selectedPayments.length === 1 && lineSuggestions.length > 0) {
                                const s = lineSuggestions[0]
                                return (
                                    <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-full py-1.5 pl-4 pr-1.5 mr-2">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase text-warning tracking-tight">Sugerencia de Match</span>
                                            <span className="text-[11px] font-bold text-foreground truncate max-w-[120px]">
                                                {s.line_data?.description}
                                            </span>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            className="h-7 text-[10px] font-black uppercase bg-warning text-warning-foreground hover:bg-warning/90 rounded-full"
                                            onClick={() => handleMatch(s.line_data?.id, selectedPayments[0].id, selectedPayments[0].is_batch)}
                                        >
                                            Conciliar Match
                                        </Button>
                                    </div>
                                )
                            }
                            return null
                        })()}

                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center min-w-[80px]">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Banco {selectedLines.length > 0 && <span className="text-primary">({selectedLines.length})</span>}</span>
                                <span className="text-sm font-black font-mono tabular-nums text-foreground">
                                    {formatCurrency(
                                        selectedLines.length > 0 ? selectedLines.reduce((acc: number, l: any) => 
                                            acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0
                                        ) : 0
                                    )}
                                </span>
                            </div>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="flex flex-col items-center min-w-[80px]">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Sistema {selectedPayments.length > 0 && <span className="text-primary">({selectedPayments.length})</span>}</span>
                                <span className="text-sm font-black font-mono tabular-nums text-foreground">
                                    {formatCurrency(
                                        selectedPayments.length > 0 ? selectedPayments.reduce((acc: number, p: any) => 
                                            acc + Math.abs(parseFloat(p.amount)), 0
                                        ) : 0
                                    )}
                                </span>
                            </div>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="flex flex-col items-center min-w-[80px]">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Diferencia</span>
                                {(() => {
                                    const lineTotal = selectedLines.reduce((acc: number, l: any) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0)
                                    const payTotal = selectedPayments.reduce((acc: number, p: any) => acc + Math.abs(parseFloat(p.amount)), 0)
                                    const diff = lineTotal - payTotal
                                    return (
                                        <span className={cn("text-base font-black font-mono tabular-nums", Math.abs(diff) < 1 ? "text-success" : "text-warning")}>
                                            {formatCurrency(Math.abs(diff))}
                                        </span>
                                    )
                                })()}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 border-l border-border/60 pl-6">
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
                                onClick={() => handleGroupMatch(false)}
                                disabled={matching || selectedLines.length === 0 || selectedPayments.length === 0}
                            >
                                {matching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Conciliar
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Modals ─── */}
            <ExclusionModal
                open={actionDialog.open && (actionDialog.type === 'exclude' || actionDialog.type === 'bulk_exclude')}
                onOpenChange={(open) => !open && setActionDialog({ open: false, type: null })}
                title={actionDialog.type === 'bulk_exclude' ? `Excluir ${selectedLines.length} Movimientos` : "Excluir Movimiento"}
                onConfirm={async (reason, notes) => {
                    try {
                        if (actionDialog.type === 'bulk_exclude') {
                            await bulkExcludeMutation.mutateAsync({
                                lineIds: selectedLines.map(l => l.id),
                                reason,
                                notes
                            })
                            setSelectedLines([])
                        } else {
                            if (actionDialog.lineId) {
                                await excludeMutation.mutateAsync({
                                    lineId: actionDialog.lineId,
                                    reason,
                                    notes
                                })
                            }
                        }
                    } catch (error) {
                        // Handled in mutation
                    } finally { setActionDialog({ open: false, type: null }) }
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
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase opacity-50"> {/* intentional: badge density */}
                                <span>Flexible (50%)</span>
                                <span>Estricto (100%)</span>
                            </div>
                        </div>
                    </div>
                }
                variant="default"
                confirmText="Iniciar Auto-Match"
            />

            {/* Difference Handling Modal */}
            <BaseModal
                open={diffDialog.open}
                onOpenChange={(open) => !open && setDiffDialog(prev => ({ ...prev, open: false }))}
                title="Ajuste de Diferencia"
                description={`Existe una diferencia de ${formatCurrency(parseFloat(diffDialog.amount))}. Selecciona cómo deseas procesarla.`}
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => setDiffDialog(prev => ({ ...prev, open: false }))}>Cancelar</Button>
                        <Button onClick={() => diffDialog.isGroup ? handleGroupMatch(true) : handleMatch(diffDialog.lineId, diffDialog.paymentId, false, true)}>
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
                    // Pre-fill amount based on absolute value of line
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
        </div>
        </DndContext>
    )
}
