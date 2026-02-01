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
    CheckCircle2, XCircle, Search, Loader2, TrendingUp, TrendingDown,
    ArrowRight, Ban, AlertCircle, ZapIcon, Sparkles, Filter, MousePointer2
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
}

interface ReconciliationPanelProps {
    statementId: number
    onComplete: () => void
}

export default function ReconciliationPanel({ statementId, onComplete }: ReconciliationPanelProps) {
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
    const [manualPayments, setManualPayments] = useState<any[]>([])
    const [paymentSearch, setPaymentSearch] = useState("")
    const [foundPayments, setFoundPayments] = useState<any[]>([])
    const [searchingPayments, setSearchingPayments] = useState(false)

    const [diffDialog, setDiffDialog] = useState<{ open: boolean, lineId: number, paymentId: number, amount: string }>({
        open: false, lineId: 0, paymentId: 0, amount: '0'
    })
    const [diffType, setDiffType] = useState<string>("COMMISSION")
    const [diffNotes, setDiffNotes] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")
    const [actionDialog, setActionDialog] = useState<{
        open: boolean,
        type: 'exclude' | 'automatch' | null,
        lineId?: number
    }>({ open: false, type: null })

    useEffect(() => {
        fetchUnreconciledLines()
    }, [statementId])

    useEffect(() => {
        if (selectedLine) {
            fetchSuggestions(selectedLine.id)
        }
    }, [selectedLine])

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

    const fetchSuggestions = async (lineId: number) => {
        // Only fetch suggestions if single line selected
        if (selectedLines.length !== 1) {
            setSuggestions([])
            return
        }
        try {
            const response = await api.get(`/treasury/statement-lines/${lineId}/suggestions/`)
            setSuggestions(response.data.suggestions || [])
        } catch (error) {
            console.error('Error fetching suggestions:', error)
            setSuggestions([])
        }
    }

    const searchPayments = async (query: string) => {
        if (!query || query.length < 2) return
        setSearchingPayments(true)
        try {
            // Use existing payments endpoint with search
            const response = await api.get('/treasury/payments/', {
                params: { search: query, is_reconciled: 'False' } // Filter unreconciled
            })
            setFoundPayments(response.data.results || response.data)
        } catch (error) {
            console.error(error)
        } finally {
            setSearchingPayments(false)
        }
    }

    const toggleLineSelection = (line: BankStatementLine, multi: boolean) => {
        if (multi) {
            if (selectedLines.find(l => l.id === line.id)) {
                setSelectedLines(prev => prev.filter(l => l.id !== line.id))
            } else {
                setSelectedLines(prev => [...prev, line])
            }
        } else {
            setSelectedLines([line])
        }
    }

    const handleGroupMatch = async () => {
        if (selectedLines.length === 0 || manualPayments.length === 0) return

        try {
            setMatching(true)
            const lineIds = selectedLines.map(l => l.id)
            const paymentIds = manualPayments.map(p => p.id)

            await api.post('/treasury/statement-lines/match_group/', {
                line_ids: lineIds,
                payment_ids: paymentIds
            })

            // Auto-confirm group via first line
            await api.post(`/treasury/statement-lines/${lineIds[0]}/confirm/`)

            await fetchUnreconciledLines()
            setManualPayments([])
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

    const confirmExclude = async () => {
        if (!actionDialog.lineId) return

        try {
            await api.patch(`/treasury/statement-lines/${actionDialog.lineId}/`, {
                reconciliation_state: 'EXCLUDED'
            })
            await fetchUnreconciledLines()
        } catch (error) {
            console.error('Error excluding line:', error)
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
            <div className="flex items-end justify-between bg-white p-4 rounded-xl border shadow-sm">
                <div className="space-y-3 flex-1 max-w-xl">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold tracking-tight text-foreground/80">Reconciliación Activa</h3>
                        <Badge variant="outline" className="font-mono">{unreconciledLines.length} pendientes</Badge>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Filtrar por descripción, monto o referencia..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 bg-muted/30 border-none focus-visible:ring-1"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleAutoMatch}
                        disabled={autoMatching}
                        variant="secondary"
                        className="h-10 px-6 font-semibold shadow-sm hover:translate-y-[-1px] transition-all"
                    >
                        {autoMatching ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                        )}
                        Auto-Match Inteligente
                    </Button>
                </div>
            </div>

            {/* Main Workbench */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left: Statement Lines List */}
                <Card className="shadow-md border-none overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b py-3 px-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Filter className="h-3.5 w-3.5" />
                                    Transacciones Bancarias
                                </CardTitle>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{filteredLines.length} mostradas</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
                            {filteredLines.map((line) => {
                                const amount = Math.abs(parseFloat(line.credit) - parseFloat(line.debit))
                                const isCredit = parseFloat(line.credit) > parseFloat(line.debit)
                                const isSelected = selectedLines.some(l => l.id === line.id)

                                return (
                                    <div
                                        key={line.id}
                                        onClick={(e) => toggleLineSelection(line, e.ctrlKey || e.metaKey)}
                                        className={cn(
                                            "group relative px-5 py-4 cursor-pointer transition-all hover:bg-muted/20",
                                            isSelected && "bg-primary/[0.03] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]"
                                        )}
                                    >
                                        <div className="absolute left-1 top-1/2 -translate-y-1/2">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => {
                                                    // Allow direct checkbox interaction
                                                    if (checked) setSelectedLines(prev => [...prev, line])
                                                    else setSelectedLines(prev => prev.filter(l => l.id !== line.id))
                                                }}
                                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
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
                                            <div className="text-right flex flex-col items-end gap-1">
                                                <div className={cn(
                                                    "text-[15px] font-black font-mono tracking-tight",
                                                    isCredit ? "text-emerald-600" : "text-red-500"
                                                )}>
                                                    ${amount.toLocaleString('es-CL')}
                                                </div>
                                                <div className={cn(
                                                    "text-[9px] font-bold uppercase tracking-widest",
                                                    isCredit ? "text-emerald-600/50" : "text-red-500/50"
                                                )}>
                                                    {isCredit ? "Crédito" : "Débito"}
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute right-0 top-0 h-full flex items-center pr-2 translate-x-2 group-hover:translate-x-0 transition-transform">
                                                <MousePointer2 className="h-4 w-4 text-primary opacity-20" />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Contextual Suggestions */}
                <div className="space-y-4">
                    <Card className="shadow-md border-none overflow-hidden h-full">
                        <CardHeader className="bg-muted/30 border-b py-3 px-4">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                {selectedLines.length > 1 ? (
                                    <>
                                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                                        Conciliación de Grupo
                                    </>
                                ) : (
                                    <>
                                        <ZapIcon className="h-3.5 w-3.5 text-amber-500" />
                                        Sugerencias de Conciliación
                                    </>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            {selectedLines.length > 1 ? (
                                (() => {
                                    const totalLines = selectedLines.reduce((acc, l) => acc + (parseFloat(l.credit) - parseFloat(l.debit)), 0)
                                    const totalPayments = manualPayments.reduce((acc, p) => acc + parseFloat(p.amount), 0)
                                    const diff = Math.abs(totalLines) - Math.abs(totalPayments)
                                    return (
                                        <div className="space-y-6">
                                            {/* Summary */}
                                            <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Total Líneas ({selectedLines.length})</span>
                                                        <div className="text-lg font-mono font-bold text-foreground/80">
                                                            ${Math.abs(totalLines).toLocaleString('es-CL')}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Total Pagos ({manualPayments.length})</span>
                                                        <div className="text-lg font-mono font-bold text-foreground/80">
                                                            ${Math.abs(totalPayments).toLocaleString('es-CL')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-blue-200/50 flex justify-between items-center">
                                                    <span className="text-xs font-bold uppercase text-muted-foreground">Diferencia</span>
                                                    <span className={cn("font-mono font-black", Math.abs(diff) > 10 ? "text-red-500" : "text-emerald-600")}>
                                                        ${Math.abs(diff).toLocaleString('es-CL')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Search */}
                                            <div className="space-y-3">
                                                <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar Pagos para Agrupar</Label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Monto, ID, contacto..."
                                                        value={paymentSearch}
                                                        onChange={(e) => {
                                                            setPaymentSearch(e.target.value)
                                                            searchPayments(e.target.value)
                                                        }}
                                                        className="pl-9 h-9 text-sm"
                                                    />
                                                </div>
                                                {/* Results */}
                                                {(foundPayments.length > 0 && paymentSearch.length >= 2) && (
                                                    <div className="border rounded-md max-h-40 overflow-y-auto bg-white shadow-xl absolute z-50 w-full">
                                                        {foundPayments.map(p => {
                                                            const isAdded = manualPayments.some(mp => mp.id === p.id)
                                                            if (isAdded) return null;
                                                            return (
                                                                <div key={p.id} className="p-2.5 text-xs hover:bg-muted flex justify-between cursor-pointer border-b last:border-0 bg-white"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setManualPayments([...manualPayments, p])
                                                                        setPaymentSearch("")
                                                                        setFoundPayments([])
                                                                    }}>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold">{p.display_id}</span>
                                                                        <span className="text-muted-foreground">{p.contact_name || 'Sin contacto'}</span>
                                                                    </div>
                                                                    <span className="font-mono font-bold self-center">${Math.abs(parseFloat(p.amount)).toLocaleString('es-CL')}</span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Selected Payments */}
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold uppercase text-muted-foreground">Pagos Seleccionados</Label>
                                                <div className="border rounded-lg bg-muted/10 divide-y max-h-[200px] overflow-y-auto">
                                                    {manualPayments.length === 0 ? (
                                                        <div className="p-4 text-center text-xs text-muted-foreground italic">
                                                            Busca y selecciona pagos para el grupo
                                                        </div>
                                                    ) : manualPayments.map(p => (
                                                        <div key={p.id} className="flex justify-between items-center p-2.5">
                                                            <div>
                                                                <div className="font-bold text-xs">{p.display_id}</div>
                                                                <div className="text-[10px] text-muted-foreground">{format(new Date(p.date), 'dd/MM/yy', { locale: es })} • {p.contact_name}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-mono text-xs font-bold">${Math.abs(parseFloat(p.amount)).toLocaleString('es-CL')}</div>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => setManualPayments(prev => prev.filter(x => x.id !== p.id))}>
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <Button className="w-full font-bold h-11 bg-blue-600 hover:bg-blue-700" onClick={handleGroupMatch} disabled={matching || manualPayments.length === 0}>
                                                {matching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                Confirmar Grupo Match
                                            </Button>

                                            <Button variant="ghost" className="w-full h-8 text-xs text-muted-foreground" onClick={() => {
                                                setSelectedLines([])
                                                setManualPayments([])
                                            }}>
                                                Cancelar selección múltiple
                                            </Button>
                                        </div>
                                    )
                                })()
                            ) : (
                                !selectedLine ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-center">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                            <ArrowRight className="h-6 w-6 text-muted-foreground/40" />
                                        </div>
                                        <p className="text-sm font-bold text-foreground/40">Selecciona una transacción</p>
                                        <p className="text-xs text-muted-foreground mt-1">Buscaremos coincidencias inteligentes para tu selección</p>
                                    </div>
                                ) : suggestions.length === 0 ? (
                                    <div className="space-y-4 py-4">
                                        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-6 text-center">
                                            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                                            <h4 className="font-bold text-amber-900 text-sm mb-1">Sin coincidencias automáticas</h4>
                                            <p className="text-xs text-amber-800/60 max-w-[200px] mx-auto">
                                                No encontramos pagos o depósitos que coincidan con este monto y descripción.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            <Button variant="outline" className="h-11 border-dashed justify-start px-4">
                                                <Search className="mr-2 h-4 w-4 opacity-50" />
                                                Buscar manualmente...
                                            </Button>
                                            <Button
                                                onClick={() => handleExclude(selectedLine.id)}
                                                variant="ghost"
                                                className="h-11 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                            >
                                                <Ban className="mr-2 h-4 w-4" />
                                                Ignorar / Excluir transacción
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Resultados Identificados</span>
                                            <span className="text-[10px] font-mono text-muted-foreground">Top {suggestions.length} resultados</span>
                                        </div>
                                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                                            {suggestions.map((suggestion, index) => (
                                                <div
                                                    key={suggestion.payment_data.id}
                                                    className={cn(
                                                        "group p-4 rounded-xl border transition-all hover:border-primary/50 relative overflow-hidden",
                                                        index === 0 && "border-emerald-200 bg-emerald-50/30 ring-1 ring-emerald-500/10 shadow-sm"
                                                    )}
                                                >
                                                    {index === 0 && (
                                                        <div className="absolute top-0 right-0">
                                                            <div className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-tight">Recomendado</div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-start justify-between gap-4 mb-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <span className="text-xs font-black text-foreground/80">{suggestion.payment_data.display_id}</span>
                                                                <DataCell.Badge variant={getScoreVariant(suggestion.score)}>
                                                                    {suggestion.score}% Match
                                                                </DataCell.Badge>
                                                            </div>
                                                            <p className="text-[13px] font-bold text-foreground/70 truncate">{suggestion.payment_data.contact_name || 'Particular'}</p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">📅 {format(new Date(suggestion.payment_data.date), 'dd MMMM, yyyy', { locale: es })}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[16px] font-black font-mono tracking-tighter text-foreground/90">
                                                                ${Math.abs(parseFloat(suggestion.payment_data.amount)).toLocaleString('es-CL')}
                                                            </div>
                                                            {parseFloat(suggestion.difference) !== 0 && (
                                                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 mt-1">
                                                                    Dif: ${Math.abs(parseFloat(suggestion.difference)).toLocaleString('es-CL')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                                        {suggestion.reasons.map((reason) => (
                                                            <span key={reason} className="text-[9px] font-bold uppercase tracking-wider bg-white border px-2 py-1 rounded-md text-muted-foreground">
                                                                {reason.replace('_', ' ')}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    <Button
                                                        onClick={() => handleMatch(selectedLine.id, suggestion.payment_data.id)}
                                                        disabled={matching}
                                                        className={cn(
                                                            "w-full h-11 font-bold shadow-sm transition-transform active:scale-95",
                                                            index === 0 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary/80 hover:bg-primary"
                                                        )}
                                                    >
                                                        {matching ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle2 className="h-4 w-4" />
                                                                <span>Confirmar Reconciliación</span>
                                                            </div>
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}

                                            <Button
                                                onClick={() => handleExclude(selectedLine.id)}
                                                variant="ghost"
                                                className="w-full text-muted-foreground text-[11px] font-bold uppercase hover:text-red-500 h-10 mt-2"
                                            >
                                                <Ban className="mr-2 h-3.5 w-3.5" />
                                                Descartar temporalmente
                                            </Button>
                                        </div>
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </div>
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
                            {actionDialog.type === 'exclude' ? (
                                <>
                                    <Ban className="h-5 w-5 text-red-500" />
                                    ¿Excluir transacción?
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5 text-amber-500" />
                                    ¿Iniciar Auto-Match?
                                </>
                            )}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-foreground/60">
                            {actionDialog.type === 'exclude'
                                ? 'Esta transacción se moverá al archivo de excluidos y dejará de aparecer en este panel. Podrás re-incorporarla desde el detalle del extracto si fuera necesario.'
                                : 'Nuestro algoritmo analizará todas las líneas pendientes buscando coincidencias exactas y de alta confianza (90%+). Las transacciones seleccionadas se reconciliarán automáticamente.'
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="font-bold border-none bg-muted/50 hover:bg-muted">Retroceder</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (actionDialog.type === 'exclude') confirmExclude()
                                if (actionDialog.type === 'automatch') confirmAutoMatch()
                            }}
                            className={cn(
                                "font-bold shadow-lg",
                                actionDialog.type === 'exclude' ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary"
                            )}
                        >
                            Comprendido, procesar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}

function AlertTriangle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </svg>
    )
}
