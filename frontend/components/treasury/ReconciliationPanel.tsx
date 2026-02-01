"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    AlertCircle, AlertTriangle, ArrowRight, Ban, Check, CheckCircle2, ChevronRight, Filter,
    Loader2, MoreVertical, MousePointer2, Search, Settings2, Sparkles, Trash2,
    TrendingDown, TrendingUp, Wand2, X, XCircle, ZapIcon
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import { DataCell } from "@/components/ui/data-table-cells"
import { cn } from "@/lib/utils"

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

interface PaymentSuggestion {
    payment_data: {
        id: number
        display_id: string
        amount: string
        date: string
        contact_name: string
        payment_type: string
    }
    score: number
    reasons: string[]
    difference: string
    rule_id?: number
    auto_confirm?: boolean
}

interface LineSuggestion {
    line_data: BankStatementLine
    score: number
    reasons: string[]
    difference: string
}

interface ReconciliationPanelProps {
    statementId: number
    treasuryAccountId: number
    onComplete: () => void
}

export default function ReconciliationPanel({ statementId, treasuryAccountId, onComplete }: ReconciliationPanelProps) {
    const [unreconciledLines, setUnreconciledLines] = useState<BankStatementLine[]>([])
    // Multi-selection state
    const [selectedLines, setSelectedLines] = useState<BankStatementLine[]>([])
    // Keep 'selectedLine' as the "Active/Focused" line for backward compatibility/single view
    const selectedLine = selectedLines.length > 0 ? selectedLines[selectedLines.length - 1] : null

    const [suggestions, setSuggestions] = useState<PaymentSuggestion[]>([])
    const [loading, setLoading] = useState(true)
    const [matching, setMatching] = useState(false)
    const [autoMatching, setAutoMatching] = useState(false)

    // Manual Grouping State
    const [unreconciledPayments, setUnreconciledPayments] = useState<any[]>([])
    const [selectedPayments, setSelectedPayments] = useState<any[]>([])
    const [paymentSearch, setPaymentSearch] = useState("")
    const [loadingPayments, setLoadingPayments] = useState(false)
    const [lineSuggestions, setLineSuggestions] = useState<LineSuggestion[]>([])

    const [diffDialog, setDiffDialog] = useState<{ open: boolean, lineId: number, paymentId: number, amount: string }>({
        open: false, lineId: 0, paymentId: 0, amount: '0'
    })
    const [diffType, setDiffType] = useState<string>("COMMISSION")
    const [diffNotes, setDiffNotes] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")
    const [actionDialog, setActionDialog] = useState<{
        open: boolean,
        type: 'exclude' | 'bulk_exclude' | 'automatch' | null,
        lineId?: number
    }>({ open: false, type: null })
    const [statement, setStatement] = useState<any>(null)

    useEffect(() => {
        fetchUnreconciledLines()
        fetchUnreconciledPayments()
        fetchStatement()
    }, [statementId])

    const fetchStatement = async () => {
        try {
            const response = await api.get(`/treasury/statements/${statementId}/`)
            setStatement(response.data)
        } catch (error) {
            console.error('Error fetching statement:', error)
        }
    }

    useEffect(() => {
        if (selectedLines.length === 1) {
            fetchSuggestions(selectedLines[0].id)
        } else {
            setSuggestions([])
        }
    }, [selectedLines])

    useEffect(() => {
        if (selectedPayments.length === 1) {
            fetchLineSuggestions(selectedPayments[0].id)
        } else {
            setLineSuggestions([])
        }
    }, [selectedPayments])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

            if (e.key === 'Escape') {
                if (diffDialog.open) {
                    setDiffDialog(prev => ({ ...prev, open: false }))
                } else if (selectedLine) {
                    handleExclude(selectedLine.id)
                }
            } else if (e.key === 'Enter') {
                if (diffDialog.open) {
                    confirmDifferenceMatch()
                } else if (selectedLine && suggestions.length > 0) {
                    handleMatch(selectedLine.id, suggestions[0].payment_data.id)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedLine, suggestions, diffDialog.open])

    const fetchUnreconciledLines = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/statement-lines/', {
                params: {
                    statement: statementId,
                    reconciliation_state: 'UNRECONCILED'
                }
            })
            setUnreconciledLines(response.data)

            if (response.data.length > 0 && selectedLines.length === 0) {
                setSelectedLines([response.data[0]])
            }
        } catch (error) {
            console.error('Error fetching unreconciled lines:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchUnreconciledPayments = async () => {
        try {
            setLoadingPayments(true)
            const response = await api.get('/treasury/payments/', {
                params: {
                    is_reconciled: 'False',
                    treasury_account: treasuryAccountId,
                    limit: 100 // Get a good amount for the side panel
                }
            })
            setUnreconciledPayments(response.data.results || response.data)
        } catch (error) {
            console.error('Error fetching unreconciled payments:', error)
        } finally {
            setLoadingPayments(false)
        }
    }

    const fetchSuggestions = async (lineId: number) => {
        try {
            const response = await api.get(`/treasury/statement-lines/${lineId}/suggestions/`)
            setSuggestions(response.data.suggestions || [])
        } catch (error) {
            console.error('Error fetching suggestions:', error)
            setSuggestions([])
        }
    }

    const fetchLineSuggestions = async (paymentId: number) => {
        try {
            const response = await api.get(`/treasury/payments/${paymentId}/suggestions/`)
            setLineSuggestions(response.data.suggestions || [])
        } catch (error) {
            console.error('Error fetching line suggestions:', error)
            setLineSuggestions([])
        }
    }

    const searchPayments = async (query: string) => {
        // We now filter locally since we fetched 100 payments, 
        // but we can also keep the API search if needed for large volumes.
        // For now, let's keep it simple with local filtering first.
        setPaymentSearch(query)
    }

    const toggleLineSelection = (line: BankStatementLine) => {
        if (selectedLines.find(l => l.id === line.id)) {
            setSelectedLines(prev => prev.filter(l => l.id !== line.id))
        } else {
            setSelectedLines(prev => [...prev, line])
        }
    }

    const togglePaymentSelection = (payment: any) => {
        if (selectedPayments.find(p => p.id === payment.id)) {
            setSelectedPayments(prev => prev.filter(p => p.id !== payment.id))
        } else {
            setSelectedPayments(prev => [...prev, payment])
        }
    }

    const handleGroupMatch = async () => {
        if (selectedLines.length === 0 || selectedPayments.length === 0) return

        try {
            setMatching(true)
            const lineIds = selectedLines.map(l => l.id)
            const paymentIds = selectedPayments.map(p => p.id)

            await api.post('/treasury/statement-lines/match_group/', {
                line_ids: lineIds,
                payment_ids: paymentIds
            })

            // Auto-confirm group via first line
            await api.post(`/treasury/statement-lines/${lineIds[0]}/confirm/`)

            await fetchUnreconciledLines()
            await fetchUnreconciledPayments()
            setSelectedPayments([])
            setSelectedLines([])

        } catch (error: any) {
            console.error('Group Match Error', error)
            alert(error.response?.data?.error || 'Error creando grupo')
        } finally {
            setMatching(false)
        }
    }

    const filteredLines = unreconciledLines.filter(line => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        const amount = Math.abs(parseFloat(line.credit) - parseFloat(line.debit))
        return (
            line.description.toLowerCase().includes(query) ||
            line.reference?.toLowerCase().includes(query) ||
            amount.toString().includes(query)
        )
    })

    const filteredPayments = unreconciledPayments.filter(payment => {
        if (!paymentSearch) return true
        const query = paymentSearch.toLowerCase()
        const docLabel = payment.document_info?.label?.toLowerCase() || ''
        const displayId = payment.display_id || payment.code || ''
        const contactName = payment.contact_name || ''

        return (
            displayId.toLowerCase().includes(query) ||
            contactName.toLowerCase().includes(query) ||
            docLabel.includes(query) ||
            payment.amount?.toString().includes(query)
        )
    }).sort((a, b) => {
        // Prioritize smart suggestions visually
        const lineTotal = selectedLines.length > 0 ? selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0) : null
        const isAmountMatchA = lineTotal !== null && Math.abs(Math.abs(parseFloat(a.amount)) - lineTotal) < 1
        const isAmountMatchB = lineTotal !== null && Math.abs(Math.abs(parseFloat(b.amount)) - lineTotal) < 1

        const isBackendSuggestA = suggestions.some(s => s.payment_data.id === a.id)
        const isBackendSuggestB = suggestions.some(s => s.payment_data.id === b.id)

        const scoreA = (isBackendSuggestA ? 10 : 0) + (isAmountMatchA ? 5 : 0)
        const scoreB = (isBackendSuggestB ? 10 : 0) + (isAmountMatchB ? 5 : 0)

        return scoreB - scoreA
    })

    const handleMatch = async (lineId: number, paymentId: number, force: boolean = false) => {
        if (!force) {
            const suggestion = suggestions.find(s => s.payment_data.id === paymentId)
            const diffAmount = suggestion ? parseFloat(suggestion.difference) : 0

            if (diffAmount !== 0) {
                setDiffDialog({
                    open: true,
                    lineId,
                    paymentId,
                    amount: diffAmount.toString()
                })
                try {
                    const res = await api.get(`/treasury/statement-lines/${lineId}/suggested_difference/`)
                    setDiffType(res.data.suggestion)
                } catch {
                    // ignore
                }
                return
            }
        }

        try {
            setMatching(true)
            await api.post(`/treasury/statement-lines/${lineId}/match/`, {
                payment_id: paymentId
            })

            const confirmData: any = {}
            if (force) {
                confirmData.difference_type = diffType
                confirmData.notes = diffNotes
            }

            await api.post(`/treasury/statement-lines/${lineId}/confirm/`, confirmData)

            await fetchUnreconciledLines()
            setDiffDialog(prev => ({ ...prev, open: false }))
            setDiffNotes("")

            const currentIndex = unreconciledLines.findIndex(l => l.id === lineId)
            if (currentIndex < unreconciledLines.length - 1) {
                const nextLine = unreconciledLines[currentIndex + 1]
                setSelectedLines([nextLine])
            } else if (unreconciledLines.length === 1) {
                onComplete()
            } else {
                setSelectedLines([])
            }
        } catch (error: any) {
            console.error('Error matching:', error)
            alert(error.response?.data?.error || 'Error al realizar match')
        } finally {
            setMatching(false)
        }
    }

    const confirmDifferenceMatch = () => {
        handleMatch(diffDialog.lineId, diffDialog.paymentId, true)
    }

    const handleExclude = (lineId: number) => {
        setActionDialog({ open: true, type: 'exclude', lineId })
    }

    const handleBulkExclude = () => {
        if (selectedLines.length === 0) return
        setActionDialog({ open: true, type: 'bulk_exclude' })
    }

    const confirmExclude = async () => {
        try {
            if (actionDialog.type === 'bulk_exclude') {
                await api.post(`/treasury/statement-lines/bulk_exclude/`, {
                    line_ids: selectedLines.map(l => l.id)
                })
                setSelectedLines([])
            } else if (actionDialog.lineId) {
                await api.patch(`/treasury/statement-lines/${actionDialog.lineId}/`, {
                    reconciliation_state: 'EXCLUDED'
                })
                setSelectedLines(prev => prev.filter(l => l.id !== actionDialog.lineId))
            }
            await fetchUnreconciledLines()
        } catch (error) {
            console.error('Error excluding line(s):', error)
        } finally {
            setActionDialog({ open: false, type: null })
        }
    }

    const handleAutoMatch = () => {
        setActionDialog({ open: true, type: 'automatch' })
    }

    const confirmAutoMatch = async () => {
        try {
            setAutoMatching(true)
            const response = await api.post(`/treasury/statements/${statementId}/auto_match/`, {
                confidence_threshold: 90
            })
            alert(`✅ ${response.data.matched_count} de ${response.data.total_unreconciled} líneas matched automáticamente`)
            await fetchUnreconciledLines()
        } catch (error: any) {
            console.error('Error auto-matching:', error)
            alert(error.response?.data?.error || 'Error en auto-match')
        } finally {
            setAutoMatching(false)
            setActionDialog({ open: false, type: null })
        }
    }

    const getScoreVariant = (score: number) => {
        if (score >= 90) return 'success'
        if (score >= 70) return 'secondary'
        if (score >= 50) return 'warning'
        return 'outline'
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                <p className="text-muted-foreground text-sm font-medium animate-pulse">Buscando transacciones...</p>
            </div>
        )
    }

    if (unreconciledLines.length === 0) {
        return (
            <Card className="bg-emerald-50 border-emerald-100 shadow-sm border-l-4 border-l-emerald-500">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        <div>
                            <p className="font-bold text-emerald-900">¡Todo reconciliado!</p>
                            <p className="text-sm text-emerald-700/80">Has completado el procesamiento de todas las líneas de este extracto.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold tracking-tight text-foreground/80">Reconciliación Activa</h3>
                        <Badge variant="outline" className="font-mono">{unreconciledLines.length} pendientes</Badge>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {statement && (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Sincronización</span>
                            <span className="text-sm font-bold text-foreground/70">
                                {statement.reconciled_lines} de {statement.total_lines} procesadas
                            </span>
                        </div>
                    )}
                    <Button
                        onClick={handleAutoMatch}
                        disabled={autoMatching}
                        variant="secondary"
                        className="h-10 px-6 font-semibold shadow-sm hover:translate-y-[-1px] transition-all bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                    >
                        {autoMatching ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Auto-Match Inteligente
                    </Button>
                </div>
            </div>

            {/* Balance Bar */}
            <div className={cn(
                "sticky top-4 z-40 bg-white/80 backdrop-blur-md border shadow-xl rounded-2xl p-4 transition-all",
                (selectedLines.length > 0 || selectedPayments.length > 0) ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
            )}>
                <div className="flex items-center justify-between gap-8">
                    <div className="flex items-center gap-12">
                        <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Bancos ({selectedLines.length})</p>
                            <p className="text-lg font-black font-mono">
                                ${selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0).toLocaleString('es-CL')}
                            </p>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Sistema ({selectedPayments.length})</p>
                            <p className="text-lg font-black font-mono">
                                ${selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0).toLocaleString('es-CL')}
                            </p>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Diferencia</p>
                            {(() => {
                                const lineTotal = selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0)
                                const payTotal = selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0)
                                const diff = lineTotal - payTotal
                                return (
                                    <p className={cn("text-lg font-black font-mono", Math.abs(diff) < 1 ? "text-emerald-500" : "text-amber-500")}>
                                        ${Math.abs(diff).toLocaleString('es-CL')}
                                    </p>
                                )
                            })()}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => { setSelectedLines([]); setSelectedPayments([]); }}>
                            Limpiar
                        </Button>
                        <Button
                            className="bg-primary hover:bg-primary/90 font-bold px-8 shadow-lg shadow-primary/20"
                            onClick={handleGroupMatch}
                            disabled={matching || selectedLines.length === 0 || selectedPayments.length === 0}
                        >
                            {matching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Conciliar Selección
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Workbench */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: Statement Lines List */}
                <Card className="shadow-md border-none overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b py-3 px-4">
                        <div className="flex items-center justify-between gap-4">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 whitespace-nowrap">
                                <Filter className="h-3.5 w-3.5" />
                                Movimientos Bancarios
                            </CardTitle>
                            <div className="flex items-center gap-2 max-w-[320px] w-full">
                                {selectedLines.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-[10px] font-black text-red-500 hover:text-red-600 hover:bg-red-50 px-2 shrink-0 animate-in fade-in slide-in-from-right-2"
                                        onClick={(e) => { e.stopPropagation(); handleBulkExclude(); }}
                                        disabled={matching}
                                    >
                                        <Ban className="h-3 w-3 mr-1" />
                                        EXCLUIR ({selectedLines.length})
                                    </Button>
                                )}
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary" />
                                    <Input
                                        placeholder="Buscar..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-8 pl-8 text-xs bg-white border-muted-foreground/20 focus-visible:ring-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
                            {filteredLines.map((line) => {
                                const amount = Math.abs(parseFloat(line.credit) - parseFloat(line.debit))
                                const isCredit = parseFloat(line.credit) > parseFloat(line.debit)
                                const isSelected = selectedLines.some(l => l.id === line.id)
                                const payTotal = selectedPayments.length > 0 ? selectedPayments.reduce((acc, p) => acc + Math.abs(parseFloat(p.amount)), 0) : null
                                const isAmountMatch = payTotal !== null && Math.abs(amount - payTotal) < 1
                                const isBackendSuggest = lineSuggestions.some(s => s.line_data.id === line.id)
                                const isSuggested = isAmountMatch || isBackendSuggest

                                return (
                                    <div
                                        key={line.id}
                                        onClick={() => toggleLineSelection(line)}
                                        className={cn(
                                            "group relative px-5 py-4 cursor-pointer transition-all hover:bg-muted/20 border-l-2 border-transparent",
                                            isSelected && "bg-primary/[0.03] border-l-primary shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]",
                                            isSuggested && !isSelected && "bg-amber-50/50 border-l-amber-400"
                                        )}
                                    >
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleLineSelection(line)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-5 w-5 rounded-md"
                                            />
                                        </div>
                                        <div className="flex items-start justify-between gap-4 pl-6">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-muted rounded font-mono text-muted-foreground uppercase">
                                                        L{line.line_number}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-muted-foreground">
                                                        {format(new Date(line.transaction_date), 'dd MMM yyyy', { locale: es })}
                                                    </span>
                                                    {isSuggested && (
                                                        <Badge className="bg-amber-500 hover:bg-amber-500 text-[8px] h-4 py-0 px-1 font-bold">SUGERENCIA IA</Badge>
                                                    )}
                                                </div>
                                                <p className={cn(
                                                    "text-sm font-bold truncate transition-colors",
                                                    isSelected ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                                                )}>
                                                    {line.description}
                                                </p>
                                                {line.reference && (
                                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                                                        <span className="opacity-50 font-mono">REF:</span> {line.reference}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                                                        onClick={(e) => { e.stopPropagation(); handleExclude(line.id); }}
                                                        title="Excluir movimiento"
                                                    >
                                                        <Ban className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <div className={cn(
                                                        "text-[15px] font-black font-mono tracking-tight",
                                                        isCredit ? "text-emerald-600" : "text-red-500"
                                                    )}>
                                                        ${amount.toLocaleString('es-CL')}
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "text-[9px] font-bold uppercase tracking-widest",
                                                    isCredit ? "text-emerald-600/50" : "text-red-500/50"
                                                )}>
                                                    {isCredit ? "Crédito" : "Débito"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Payments Panel */}
                <Card className="shadow-md border-none overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b py-3 px-4">
                        <div className="flex items-center justify-between gap-4">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 whitespace-nowrap">
                                <ZapIcon className="h-3.5 w-3.5" />
                                Pagos en Sistema
                            </CardTitle>
                            <div className="relative max-w-[200px] w-full group">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary" />
                                <Input
                                    placeholder="Buscar..."
                                    value={paymentSearch}
                                    onChange={(e) => setPaymentSearch(e.target.value)}
                                    className="h-8 pl-8 text-xs bg-white border-muted-foreground/20 focus-visible:ring-1"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
                            {loadingPayments ? (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin h-6 w-6 opacity-20" />
                                    <span className="text-xs">Cargando pagos...</span>
                                </div>
                            ) : filteredPayments.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground italic text-xs">
                                    No se encontraron pagos pendientes.
                                </div>
                            ) : filteredPayments.map((payment) => {
                                const isSelected = selectedPayments.some(p => p.id === payment.id)
                                const lineTotal = selectedLines.length > 0 ? selectedLines.reduce((acc, l) => acc + (Math.abs(parseFloat(l.credit) - parseFloat(l.debit))), 0) : null
                                const isAmountMatch = lineTotal !== null && Math.abs(Math.abs(parseFloat(payment.amount)) - lineTotal) < 1
                                const isBackendSuggest = suggestions.some(s => s.payment_data.id === payment.id)
                                const isSmartSuggestion = isAmountMatch || isBackendSuggest

                                return (
                                    <div
                                        key={payment.id}
                                        onClick={() => togglePaymentSelection(payment)}
                                        className={cn(
                                            "group relative px-5 py-4 cursor-pointer transition-all hover:bg-muted/20 border-l-2 border-transparent",
                                            isSelected && "bg-blue-50/50 border-l-blue-500 shadow-[inset_0_0_20px_rgba(0,0,0,0.01)]",
                                            isSmartSuggestion && !isSelected && "bg-emerald-50/50 border-l-emerald-400"
                                        )}
                                    >
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => togglePaymentSelection(payment)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 h-5 w-5 rounded-md"
                                            />
                                        </div>
                                        <div className="flex items-start justify-between gap-4 pl-6">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">{payment.display_id || payment.code}</span>
                                                    {isAmountMatch && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[8px] h-4 py-0 px-1 font-bold">MONTO COINCIDE</Badge>}
                                                    {isBackendSuggest && <Badge className="bg-amber-500 hover:bg-amber-500 text-[8px] h-4 py-0 px-1 font-bold">SUGERENCIA IA</Badge>}
                                                </div>
                                                <p className="text-sm font-bold text-foreground/80 truncate mb-0.5">{payment.contact_name || 'Particular'}</p>

                                                {/* Enriched Info */}
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                                    {payment.document_info && (
                                                        <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                                            <Filter className="h-2.5 w-2.5 opacity-50" />
                                                            {payment.document_info.label}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                                        📅 {format(new Date(payment.date), 'dd/MM/yy', { locale: es })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[15px] font-black font-mono tracking-tight text-foreground/90">
                                                    ${Math.abs(parseFloat(payment.amount)).toLocaleString('es-CL')}
                                                </div>
                                                <div className="text-[9px] font-bold uppercase text-muted-foreground/50 mt-0.5">
                                                    {payment.payment_method_display || 'Transferencia'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Difference Adjustment Dialog */}
            <Dialog open={diffDialog.open} onOpenChange={open => setDiffDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <div className="bg-amber-500 p-6 text-white">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <AlertTriangle className="h-6 w-6" />
                            Ajuste de Diferencia
                        </DialogTitle>
                        <p className="text-amber-100 text-sm mt-1">Existe un saldo pendiente por justificar en esta operación.</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="bg-muted/50 rounded-xl p-4 flex justify-between items-center border">
                            <span className="text-xs font-bold uppercase text-muted-foreground opacity-60">Diferencia Neta</span>
                            <span className="text-xl font-black font-mono text-amber-600">${parseFloat(diffDialog.amount).toLocaleString('es-CL')}</span>
                        </div>

                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Ajuste Contable</Label>
                                <Select value={diffType} onValueChange={setDiffType}>
                                    <SelectTrigger className="h-12 bg-muted/20 border-border/50 focus:ring-amber-500">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="COMMISSION">🏦 Comisión Bancaria / Gastos</SelectItem>
                                        <SelectItem value="INTEREST">📈 Intereses Percibidos/Pagados</SelectItem>
                                        <SelectItem value="EXCHANGE_DIFF">💱 Diferencia de Cambio</SelectItem>
                                        <SelectItem value="ROUNDING">🔢 Ajuste por Redondeo</SelectItem>
                                        <SelectItem value="ERROR">❌ Error Operativo / Diferencia</SelectItem>
                                        <SelectItem value="OTHER">📁 Otro Concepto Contable</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Observaciones</Label>
                                <Textarea
                                    placeholder="Explica brevemente el motivo de este ajuste..."
                                    value={diffNotes}
                                    onChange={e => setDiffNotes(e.target.value)}
                                    className="resize-none h-24 bg-muted/20 border-border/50 focus:ring-amber-500"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="bg-muted/30 p-4 border-t gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDiffDialog(prev => ({ ...prev, open: false }))} className="font-bold text-muted-foreground flex-1">Cancelar</Button>
                        <Button onClick={confirmDifferenceMatch} disabled={matching} className="bg-amber-600 hover:bg-amber-700 font-bold flex-[2]">
                            {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirmar y Justificar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog(prev => ({ ...prev, open: false }))}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                            {actionDialog.type === 'exclude' || actionDialog.type === 'bulk_exclude' ? (
                                <>
                                    <Ban className="h-5 w-5 text-red-500" />
                                    ¿Excluir transacciones?
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5 text-amber-500" />
                                    ¿Iniciar Auto-Match?
                                </>
                            )}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-foreground/60">
                            {actionDialog.type === 'exclude' || actionDialog.type === 'bulk_exclude'
                                ? 'Estas transacciones se moverán al archivo de excluidos y dejarán de aparecer en este panel. Podrás re-incorporarlas desde el detalle del extracto si fuera necesario.'
                                : 'Nuestro algoritmo analizará todas las líneas pendientes buscando coincidencias exactas y de alta confianza (90%+). Las transacciones seleccionadas se reconciliarán automáticamente.'
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="font-bold border-none bg-muted/50 hover:bg-muted">Retroceder</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (actionDialog.type === 'exclude' || actionDialog.type === 'bulk_exclude') confirmExclude()
                                if (actionDialog.type === 'automatch') confirmAutoMatch()
                            }}
                            className={cn(
                                "font-bold shadow-lg",
                                (actionDialog.type === 'exclude' || actionDialog.type === 'bulk_exclude') ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary"
                            )}
                        >
                            Comprendido, procesar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

