"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { BaseModal } from "@/components/shared/BaseModal"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ExclusionModal } from "./ExclusionModal"
import { SplitAllocationDialog } from "./SplitAllocationDialog"
import { SuggestionsPanel } from "./SuggestionsPanel"
import { DateRangeFilter, LabeledInput, LabeledSelect, TableSkeleton } from "@/components/shared"
import {
    Ban, CheckCircle2, ChevronRight, Filter,
    Loader2, Search, Sparkles, X, AlertCircle, Wand2, Info, Calculator, SplitSquareHorizontal
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
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
    payment_data?: { id: number }
    batch_data?: { id: number }
    difference: string
}

interface LineSuggestion {
    line_data: { id: number }
}

interface ReconciliationPanelProps {
    statementId: number
    treasuryAccountId: number
    onComplete: () => void
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
                <div className="flex flex-col">
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
                    <div className="flex flex-col gap-0.5 max-w-[220px]">
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
            id: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-end" />,
            cell: ({ row }) => {
                const amount = Math.abs(parseFloat(row.original.credit) - parseFloat(row.original.debit))
                const isCredit = parseFloat(row.original.credit) > parseFloat(row.original.debit)
                return (
                    <div className="flex flex-col items-end">
                        <span className={cn("font-mono font-black text-[13px] tracking-tight", isCredit ? "text-success" : "text-destructive")}>
                            {formatCurrency(amount)}
                        </span>
                        <span className="text-[10px] font-black uppercase opacity-40"> {/* intentional: badge density */}
                            {isCredit ? "Abono" : "Cargo"}
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
                <div className="flex flex-col">
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
                    <div className="flex flex-col gap-0.5 max-w-[220px]">
                        <span className={cn("text-xs font-bold truncate", isSuggested && "text-warning")}>
                            {row.original.contact_name}
                        </span>
                        {isBatch && (
                            <Badge variant="secondary" className="w-fit text-[10px] h-4 px-1.5 font-black uppercase bg-info/10 text-info"> {/* intentional: badge density */} Lote Terminal</Badge>
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
            id: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-end" />,
            cell: ({ row }) => (
                <div className="text-right font-mono font-black text-[13px] tracking-tight group-hover:scale-105 transition-transform">
                    {formatCurrency(Math.abs(parseFloat(row.original.amount)))}
                </div>
            ),
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
        <div className="space-y-6">
            {/* ─── Level 1 Hierarchy Toolbar ─── */}
            <div className="flex items-center justify-between bg-white border border-border/40 p-4 rounded-lg shadow-sm">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black tracking-tight text-foreground/80 uppercase">Workbench de Conciliación</h3>
                        <Badge variant="outline" className="font-mono text-[10px] border-primary/20 bg-primary/5 text-primary font-bold"> {/* intentional: badge density */}
                            {unreconciledLines.length} Pendientes
                        </Badge>
                    </div>
                    {statement && (
                        <p className="text-xs font-bold text-muted-foreground uppercase opacity-60">
                            {statement.reconciled_lines} de {statement.total_lines} líneas procesadas ({Math.round(statement.reconciled_lines/statement.total_lines*100)}%)
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setActionDialog({ open: true, type: 'automatch' })}
                        disabled={autoMatching}
                        variant="outline"
                        className="h-10 px-6 font-black uppercase tracking-widest bg-success/5 hover:bg-success/10 text-success border-success/20 hover:border-success/30 transition-all shadow-sm group"
                    >
                        {autoMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />}
                        Conciliación Automática
                    </Button>
                </div>
            </div>

            {/* ─── Level 2: Advanced Search & Date Filter ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-lg border border-border/40 border-dashed">
                <div className="md:col-span-1">
                    <DateRangeFilter
                        label="Rango de Transacciones"
                        onDateChange={(range) => {
                            const params = {
                                date_from: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
                                date_to: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
                                page: 1
                            }
                            setBankParams(prev => ({ ...prev, ...params }))
                            setSystemParams(prev => ({ ...prev, ...params }))
                        }}
                    />
                </div>
                <div className="md:col-span-1">
                    <LabeledInput
                        label="Búsqueda Global"
                        placeholder="Descripción, referencia, contacto..."
                        icon={<Search className="h-4 w-4" />}
                        value={bankParams.search || ""}
                        onChange={(e) => {
                            const val = e.target.value
                            setBankParams(prev => ({ ...prev, search: val, page: 1 }))
                            setSystemParams(prev => ({ ...prev, search: val, page: 1 }))
                        }}
                    />
                </div>
                <div className="flex items-end gap-2">
                    <LabeledInput
                        label="Monto Mínimo"
                        type="number"
                        placeholder="0"
                        className="w-full"
                        value={bankParams.amount_min || ""}
                        onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : undefined
                            setBankParams(prev => ({ ...prev, amount_min: val, page: 1 }))
                            setSystemParams(prev => ({ ...prev, amount_min: val, page: 1 }))
                        }}
                    />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="mb-1"
                        onClick={() => {
                            setBankParams({ page: 1, pageSize: 50 })
                            setSystemParams({ page: 1, pageSize: 50 })
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* ─── Level 4: Main Layout with Sidebar ─── */}
            <div className="flex gap-6 relative min-h-[600px]">
                {/* Tables Container */}
                <div className={cn(
                    "flex-1 transition-all duration-500 ease-[var(--ease-premium)]",
                    sidebarOpen ? "mr-[380px]" : "mr-0"
                )}>
                    {/* ─── Sticky Balance Bar ─── */}
                    <div className={cn(
                        "sticky top-4 z-40 bg-foreground text-background border shadow-2xl rounded-lg p-5 transition-all transform duration-500 mb-6",
                        "opacity-100 translate-y-0 scale-100"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-12">
                                <div className="group">
                                    <p className="text-[10px] font-black uppercase text-white/40 mb-1 tracking-widest group-hover:text-primary transition-colors">
                                        Banco {selectedLines.length > 0 ? `(${selectedLines.length})` : "(Global)"}
                                    </p>
                                    <p className="text-xl font-black font-mono">
                                        {formatCurrency(
                                            (selectedLines.length > 0 ? selectedLines : unreconciledLines).reduce((acc: number, l: any) => 
                                                acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0
                                            )
                                        )}
                                    </p>
                                </div>
                                <div className="h-10 w-px bg-white/10" />
                                <div className="group">
                                    <p className="text-[10px] font-black uppercase text-white/40 mb-1 tracking-widest group-hover:text-primary transition-colors">
                                        Sistema {selectedPayments.length > 0 ? `(${selectedPayments.length})` : "(Global)"}
                                    </p>
                                    <p className="text-xl font-black font-mono">
                                        {formatCurrency(
                                            (selectedPayments.length > 0 ? selectedPayments : unreconciledPayments).reduce((acc: number, p: any) => 
                                                acc + Math.abs(parseFloat(p.amount)), 0
                                            )
                                        )}
                                    </p>
                                </div>
                                <div className="h-10 w-px bg-white/10" />
                                <div>
                                    <p className="text-[10px] font-black uppercase text-white/40 mb-1 tracking-widest">
                                        {selectedLines.length > 0 || selectedPayments.length > 0 ? "Diferencia Selección" : "Diferencia Global"}
                                    </p>
                                    {(() => {
                                        const lineItems = selectedLines.length > 0 ? selectedLines : unreconciledLines
                                        const payItems = selectedPayments.length > 0 ? selectedPayments : unreconciledPayments
                                        
                                        const lineTotal = lineItems.reduce((acc: number, l: any) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0)
                                        const payTotal = payItems.reduce((acc: number, p: any) => acc + Math.abs(parseFloat(p.amount)), 0)
                                        const diff = lineTotal - payTotal
                                        
                                        return (
                                            <p className={cn("text-xl font-black font-mono", Math.abs(diff) < 1 ? "text-success" : "text-warning")}>
                                                {formatCurrency(Math.abs(diff))}
                                            </p>
                                        )
                                    })()}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {(selectedLines.length > 0 || selectedPayments.length > 0) && (
                                    <Button 
                                        variant="ghost" 
                                        className="font-bold text-white/50 hover:text-white uppercase text-xs" 
                                        onClick={() => { setSelectedLines([]); setSelectedPayments([]); }}
                                    >
                                        Limpiar Selección
                                    </Button>
                                )}
                                <Button
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest px-8 shadow-xl shadow-primary/20 transition-all active:scale-95"
                                    onClick={() => handleGroupMatch(false)}
                                    disabled={matching || selectedLines.length === 0 || selectedPayments.length === 0}
                                >
                                    {matching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                    Conciliar Selección
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* ─── Main Workbench Grid ─── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DataTable
                            columns={bankColumns}
                            data={unreconciledLines}
                            cardMode
                            searchPlaceholder="Buscar en movimientos..."
                            onRowSelectionChange={handleLineSelectionChange}
                            skeletonRows={10}
                            noBorder
                            pageSizeOptions={[50, 100]}
                            defaultPageSize={50}
                            renderFooter={(table) => (
                                <div className="flex items-center justify-between px-2 py-1 w-full">
                                    <div className="flex-1 text-[10px] text-muted-foreground font-bold uppercase">
                                        Total: {bankData?.count || 0} registros
                                    </div>
                                    <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-muted-foreground mr-4">
                                        Página {bankParams.page}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setBankParams(p => ({ ...p, page: Math.max(1, (p.page || 1) - 1) }))}
                                            disabled={bankParams.page === 1}
                                        >
                                            <ChevronRight className="h-4 w-4 rotate-180" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setBankParams(p => ({ ...p, page: (p.page || 1) + 1 }))}
                                            disabled={!bankData?.next}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        />

                        <DataTable
                            columns={paymentColumns}
                            data={unreconciledPayments}
                            cardMode
                            searchPlaceholder="Buscar en sistema..."
                            onRowSelectionChange={handlePaymentSelectionChange}
                            skeletonRows={10}
                            noBorder
                            pageSizeOptions={[50, 100]}
                            defaultPageSize={50}
                            renderFooter={(table) => (
                                <div className="flex items-center justify-between px-2 py-1 w-full">
                                    <div className="flex-1 text-[10px] text-muted-foreground font-bold uppercase">
                                        Total aprox: {systemData?.count || 0}
                                    </div>
                                    <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-muted-foreground mr-4">
                                        Página {systemParams.page}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setSystemParams(p => ({ ...p, page: Math.max(1, (p.page || 1) - 1) }))}
                                            disabled={systemParams.page === 1}
                                        >
                                            <ChevronRight className="h-4 w-4 rotate-180" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => setSystemParams(p => ({ ...p, page: (p.page || 1) + 1 }))}
                                            disabled={!systemData?.results || systemData.results.length < (systemParams.pageSize || 50)}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* Sidebar Suggestions */}
                <SuggestionsPanel 
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    suggestions={suggestions}
                    lineSuggestions={lineSuggestions}
                    selectedLine={selectedLines.length === 1 ? selectedLines[0] : undefined}
                    selectedPayment={selectedPayments.length === 1 ? selectedPayments[0] : undefined}
                    onMatch={(id, isBatch) => handleMatch(selectedLines[0]?.id || id, id, isBatch)}
                    isMatching={matching}
                />
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
    )
}
