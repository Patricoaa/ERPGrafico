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
import { LabeledSelect, LabeledInput } from "@/components/shared"
import {
    Ban, CheckCircle2, ChevronRight, Filter,
    Loader2, Search, Sparkles, X, AlertCircle, Wand2
} from "lucide-react"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { createActionsColumn, DataCell } from "@/components/ui/data-table-cells"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface BankStatementLine {
    id: number
    line_number: number
    transaction_date: string
    description: string
    reference: string
    debit: string
    credit: string
    balance: string
    reconciliation_state: string
    reconciliation_state_display: string
}

interface PaymentData {
    id: number
    display_id: string
    amount: string
    date: string
    contact_name: string
    payment_type: string
}

interface BatchData {
    id: number
    display_id: string
    net_amount: string
    sales_date: string
    payment_method_name: string
    supplier_name?: string
}

interface PaymentSuggestion {
    payment_data?: PaymentData
    batch_data?: BatchData
    is_batch?: boolean
    score: number
    reasons: string[]
    difference: string
    rule_id?: number
    auto_confirm?: boolean
}

// Unified interface for the table rows in the system side
interface ReconciliationSystemItem {
    id: number
    amount: string
    date: string
    contact_name: string
    display_id?: string
    code?: string
    is_batch?: boolean
    identifier?: string
    name?: string
}

interface LineSuggestion {
    line_data: BankStatementLine
    score: number
    reasons: string[]
    difference: string
}

interface BankStatement {
    id: number;
    total_lines: number;
    reconciled_lines: number;
    name?: string;
}

interface ReconciliationPanelProps {
    statementId: number
    treasuryAccountId: number
    onComplete: () => void
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ReconciliationPanel({ statementId, treasuryAccountId, onComplete }: ReconciliationPanelProps) {
    const [unreconciledLines, setUnreconciledLines] = useState<BankStatementLine[]>([])
    const [selectedLines, setSelectedLines] = useState<BankStatementLine[]>([])
    
    const [unreconciledPayments, setUnreconciledPayments] = useState<ReconciliationSystemItem[]>([])
    const [selectedPayments, setSelectedPayments] = useState<ReconciliationSystemItem[]>([])
    
    const [suggestions, setSuggestions] = useState<PaymentSuggestion[]>([])
    const [loading, setLoading] = useState(true)
    const [matching, setMatching] = useState(false)
    const [autoMatching, setAutoMatching] = useState(false)
    const [loadingPayments, setLoadingPayments] = useState(false)
    const [lineSuggestions, setLineSuggestions] = useState<LineSuggestion[]>([])
    const [statement, setStatement] = useState<BankStatement | null>(null)

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

    const [confidenceThreshold, setConfidenceThreshold] = useState<number>(90)

    // ─── Fetching Data ────────────────────────────────────────────────────────

    const fetchStatement = useCallback(async () => {
        try {
            const response = await api.get(`/treasury/statements/${statementId}/`)
            setStatement(response.data)
        } catch (error) {
            console.error('Error fetching statement:', error)
        }
    }, [statementId])

    const fetchUnreconciledLines = useCallback(async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/statement-lines/', {
                params: {
                    statement: statementId,
                    reconciliation_state: 'UNRECONCILED'
                }
            })
            setUnreconciledLines(response.data)
        } catch (error) {
            console.error('Error fetching unreconciled lines:', error)
        } finally {
            setLoading(false)
        }
    }, [statementId])

    const fetchUnreconciledPayments = useCallback(async () => {
        try {
            setLoadingPayments(true)
            const [paymentsRes, batchesRes] = await Promise.all([
                api.get('/treasury/payments/', {
                    params: {
                        is_reconciled: 'False',
                        treasury_account: treasuryAccountId,
                        limit: 100
                    }
                }),
                api.get('/treasury/terminal-batches/', {
                    params: {
                        status: 'SETTLED',
                        reconciliation_match__isnull: 'True'
                    }
                })
            ])

            const payments = (paymentsRes.data.results || paymentsRes.data) as ReconciliationSystemItem[]
            const batches = ((batchesRes.data.results || batchesRes.data) as BatchData[]).map((b) => ({
                id: b.id,
                display_id: b.display_id,
                amount: b.net_amount,
                date: b.sales_date,
                contact_name: b.supplier_name || 'Liquidación Terminal',
                is_batch: true
            }))

            setUnreconciledPayments([...payments, ...batches])
        } catch (error) {
            console.error('Error fetching unreconciled payments:', error)
        } finally {
            setLoadingPayments(false)
        }
    }, [treasuryAccountId])

    const fetchSuggestions = async (lineId: number) => {
        try {
            const response = await api.get(`/treasury/statement-lines/${lineId}/suggestions/`)
            setSuggestions(response.data.suggestions || [])
        } catch (error) {
            setSuggestions([])
        }
    }

    const fetchLineSuggestions = async (paymentId: number) => {
        try {
            const response = await api.get(`/treasury/payments/${paymentId}/suggestions/`)
            setLineSuggestions(response.data.suggestions || [])
        } catch (error) {
            setLineSuggestions([])
        }
    }

    useEffect(() => {
        fetchUnreconciledLines()
        fetchUnreconciledPayments()
        fetchStatement()
    }, [fetchUnreconciledLines, fetchUnreconciledPayments, fetchStatement])

    useEffect(() => {
        if (selectedLines.length === 1) fetchSuggestions(selectedLines[0].id)
        else setSuggestions([])
    }, [selectedLines])

    useEffect(() => {
        if (selectedPayments.length === 1) fetchLineSuggestions(selectedPayments[0].id)
        else setLineSuggestions([])
    }, [selectedPayments])

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

    const handleMatch = async (lineId: number, paymentId: number, force: boolean = false) => {
        if (!force) {
            const suggestion = suggestions.find(s => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === paymentId)
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
            setMatching(true)
            const isBatch = suggestions.find(s => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === paymentId)?.is_batch

            if (isBatch) {
                await api.post(`/treasury/statement-lines/match_group/`, {
                    line_ids: [lineId],
                    batch_ids: [paymentId],
                    payment_ids: []
                })
            } else {
                await api.post(`/treasury/statement-lines/${lineId}/match/`, { payment_id: paymentId })
            }

            const confirmData: Record<string, unknown> = {}
            if (force) {
                confirmData.difference_type = diffType
                confirmData.notes = diffNotes
            }

            await api.post(`/treasury/statement-lines/${lineId}/confirm/`, confirmData)
            await fetchUnreconciledLines()
            setDiffDialog(prev => ({ ...prev, open: false }))
            setDiffNotes("")
            
            if (unreconciledLines.length === 1) onComplete()
            setSelectedLines([])
        } catch (error: unknown) {
            showApiError(error, 'Error al realizar match')
        } finally {
            setMatching(false)
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
            setMatching(true)
            const payload: Record<string, unknown> = {
                line_ids: selectedLines.map(l => l.id),
                payment_ids: selectedPayments.filter(p => !p.is_batch).map(p => p.id),
                batch_ids: selectedPayments.filter(p => p.is_batch).map(p => p.id)
            }

            if (force) { payload.difference_reason = diffType; payload.notes = diffNotes; }

            await api.post('/treasury/statement-lines/match_group/', payload)
            
            const confirmPayload: Record<string, unknown> = {}
            if (force) { confirmPayload.difference_type = diffType; confirmPayload.notes = diffNotes; }

            await api.post(`/treasury/statement-lines/${selectedLines[0].id}/confirm/`, confirmPayload)

            await fetchUnreconciledLines()
            await fetchUnreconciledPayments()
            setSelectedPayments([])
            setSelectedLines([])
            setDiffDialog(prev => ({ ...prev, open: false }))
            setDiffNotes("")
        } catch (error: unknown) {
            showApiError(error, 'Error creando grupo')
        } finally {
            setMatching(false)
        }
    }

    const confirmAutoMatch = async () => {
        try {
            setAutoMatching(true)
            const response = await api.post(`/treasury/statements/${statementId}/auto_match/`, { confidence_threshold: confidenceThreshold })
            toast.success(`Conciliación Finalizada`, {
                description: `${response.data.matched_count} de ${response.data.total_unreconciled} líneas conciliadas automáticamente.`
            })
            await fetchUnreconciledLines()
        } catch (error: unknown) {
            showApiError(error, 'Error en auto-match')
        } finally {
            setAutoMatching(false)
            setActionDialog({ open: false, type: null })
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
                const isSuggested = lineSuggestions.some(s => s.line_data.id === row.original.id)
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
            renderActions: (item) => (
                <DataCell.Action
                    icon={Ban}
                    title="Excluir"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setActionDialog({ open: true, type: 'exclude', lineId: item.id }) }}
                />
            )
        })
    ], [lineSuggestions])

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
                const isSuggested = suggestions.some(s => (s.is_batch ? s.batch_data?.id : s.payment_data?.id) === row.original.id)
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
        }
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

            {/* ─── Sticky Balance Bar ─── */}
            <div className={cn(
                "sticky top-4 z-40 bg-foreground text-background border shadow-2xl rounded-lg p-5 transition-all transform duration-500",
                (selectedLines.length > 0 || selectedPayments.length > 0) ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-10 scale-95 pointer-events-none"
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-12">
                        <div className="group">
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1 tracking-widest group-hover:text-primary transition-colors"> {/* intentional: badge density */} Banco ({selectedLines.length})</p>
                            <p className="text-xl font-black font-mono">
                                {formatCurrency(selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0))}
                            </p>
                        </div>
                        <div className="h-10 w-px bg-white/10" />
                        <div className="group">
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1 tracking-widest group-hover:text-primary transition-colors"> {/* intentional: badge density */} Sistema ({selectedPayments.length})</p>
                            <p className="text-xl font-black font-mono">
                                {formatCurrency(selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0))}
                            </p>
                        </div>
                        <div className="h-10 w-px bg-white/10" />
                        <div>
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1 tracking-widest"> {/* intentional: badge density */} Diferencia</p>
                            {(() => {
                                const lineTotal = selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0)
                                const payTotal = selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0)
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
                        <Button variant="ghost" className="font-bold text-white/50 hover:text-white uppercase text-xs" onClick={() => { setSelectedLines([]); setSelectedPayments([]); }}>
                            Limpiar
                        </Button>
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
                    globalFilterFields={["description", "reference"]}
                    onRowSelectionChange={handleLineSelectionChange}
                    hidePagination
                    skeletonRows={10}
                    noBorder
                />

                <DataTable
                    columns={paymentColumns}
                    data={unreconciledPayments}
                    cardMode
                    searchPlaceholder="Buscar en sistema..."
                    globalFilterFields={["contact_name", "display_id"]}
                    onRowSelectionChange={handlePaymentSelectionChange}
                    hidePagination
                    skeletonRows={10}
                    noBorder
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
                            await api.post(`/treasury/statement-lines/bulk_exclude/`, { 
                                line_ids: selectedLines.map(l => l.id),
                                exclusion_reason: reason,
                                exclusion_notes: notes
                            })
                            setSelectedLines([])
                        } else {
                            await api.patch(`/treasury/statement-lines/${actionDialog.lineId}/`, { 
                                reconciliation_state: 'EXCLUDED',
                                exclusion_reason: reason,
                                exclusion_notes: notes
                            })
                        }
                        toast.success("Movimientos excluidos correctamente")
                        await fetchUnreconciledLines()
                    } catch (error) {
                        showApiError(error)
                    } finally { setActionDialog({ open: false, type: null }) }
                }}
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
                        <Button onClick={() => diffDialog.isGroup ? handleGroupMatch(true) : handleMatch(diffDialog.lineId, diffDialog.paymentId, true)}>
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
        </div>
    )
}
