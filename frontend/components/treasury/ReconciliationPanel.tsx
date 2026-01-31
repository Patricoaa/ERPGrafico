"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
    CheckCircle2, XCircle, Search, Loader2, TrendingUp, TrendingDown,
    ArrowRight, Ban, AlertCircle, ZapIcon
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"

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
    const [selectedLine, setSelectedLine] = useState<BankStatementLine | null>(null)
    const [suggestions, setSuggestions] = useState<PaymentSuggestion[]>([])
    const [loading, setLoading] = useState(true)
    const [matching, setMatching] = useState(false)
    const [autoMatching, setAutoMatching] = useState(false)
    const [diffDialog, setDiffDialog] = useState<{ open: boolean, lineId: number, paymentId: number, amount: string }>({
        open: false, lineId: 0, paymentId: 0, amount: '0'
    })
    const [diffType, setDiffType] = useState<string>("COMMISSION")
    const [diffNotes, setDiffNotes] = useState<string>("")

    useEffect(() => {
        fetchUnreconciledLines()
    }, [statementId])

    useEffect(() => {
        if (selectedLine) {
            fetchSuggestions(selectedLine.id)
        }
    }, [selectedLine])

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

            if (response.data.length > 0 && !selectedLine) {
                setSelectedLine(response.data[0])
            }
        } catch (error) {
            console.error('Error fetching unreconciled lines:', error)
        } finally {
            setLoading(false)
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

    const handleMatch = async (lineId: number, paymentId: number, force: boolean = false) => {
        // Check difference first
        if (!force) {
            const suggestion = suggestions.find(s => s.payment_data.id === paymentId)
            const diffAmount = suggestion ? parseFloat(suggestion.difference) : 0

            if (diffAmount !== 0) {
                // Open difference dialog
                setDiffDialog({
                    open: true,
                    lineId,
                    paymentId,
                    amount: diffAmount.toString()
                })
                // Suggest diff type
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

            // Match
            await api.post(`/treasury/statement-lines/${lineId}/match/`, {
                payment_id: paymentId
            })

            // Confirm immediately (with difference info if applicable)
            const confirmData: any = {}
            if (force) {
                confirmData.difference_type = diffType
                confirmData.notes = diffNotes
            }

            await api.post(`/treasury/statement-lines/${lineId}/confirm/`, confirmData)

            // Refresh list
            await fetchUnreconciledLines()

            // Close dialog if open
            setDiffDialog(prev => ({ ...prev, open: false }))
            setDiffNotes("")

            // Move to next line
            const currentIndex = unreconciledLines.findIndex(l => l.id === lineId)
            if (currentIndex < unreconciledLines.length - 1) {
                setSelectedLine(unreconciledLines[currentIndex + 1])
            } else if (unreconciledLines.length === 1) {
                // Last one reconciled
                onComplete()
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

    const handleExclude = async (lineId: number) => {
        if (!confirm('¿Excluir esta línea de la reconciliación?')) return

        try {
            await api.patch(`/treasury/statement-lines/${lineId}/`, {
                reconciliation_state: 'EXCLUDED'
            })

            await fetchUnreconciledLines()
        } catch (error) {
            console.error('Error excluding line:', error)
        }
    }

    const handleAutoMatch = async () => {
        if (!confirm('¿Ejecutar matching automático para todas las líneas?')) return

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
        }
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600 bg-green-50'
        if (score >= 70) return 'text-blue-600 bg-blue-50'
        if (score >= 50) return 'text-yellow-600 bg-yellow-50'
        return 'text-gray-600 bg-gray-50'
    }

    const getScoreLabel = (score: number) => {
        if (score >= 90) return '🎯 ALTA'
        if (score >= 70) return '✓ MEDIA'
        if (score >= 50) return '⚠ BAJA'
        return '?'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        )
    }

    if (unreconciledLines.length === 0) {
        return (
            <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                    ✅ Todas las líneas han sido reconciliadas. Puedes confirmar el extracto.
                </AlertDescription>
            </Alert>
        )
    }

    const lineAmount = selectedLine
        ? Math.abs(parseFloat(selectedLine.credit) - parseFloat(selectedLine.debit))
        : 0

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Panel de Reconciliación</h3>
                    <p className="text-sm text-muted-foreground">
                        {unreconciledLines.length} líneas pendientes
                    </p>
                </div>
                <Button
                    onClick={handleAutoMatch}
                    disabled={autoMatching}
                    variant="outline"
                >
                    {autoMatching ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <ZapIcon className="mr-2 h-4 w-4" />
                            Auto-Match
                        </>
                    )}
                </Button>
            </div>

            {/* Dual Panel */}
            <div className="grid grid-cols-2 gap-4">
                {/* Left: Statement Lines */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Líneas de Extracto</CardTitle>
                        <CardDescription>Sin reconciliar</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[500px] overflow-y-auto">
                            {unreconciledLines.map((line) => {
                                const amount = Math.abs(parseFloat(line.credit) - parseFloat(line.debit))
                                const isCredit = parseFloat(line.credit) > parseFloat(line.debit)
                                const isSelected = selectedLine?.id === line.id

                                return (
                                    <div
                                        key={line.id}
                                        onClick={() => setSelectedLine(line)}
                                        className={`px-4 py-3 border-b cursor-pointer transition-colors ${isSelected
                                            ? 'bg-blue-50 border-l-4 border-l-blue-600'
                                            : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-gray-500">
                                                        #{line.line_number}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {format(new Date(line.transaction_date), 'dd/MM/yy', { locale: es })}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium truncate">
                                                    {line.description}
                                                </p>
                                                {line.reference && (
                                                    <p className="text-xs text-gray-500 truncate">
                                                        Ref: {line.reference}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-sm font-bold font-mono ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isCredit ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                                                    ${amount.toLocaleString('es-CL')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Suggestions */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Sugerencias de Pagos</CardTitle>
                        <CardDescription>
                            {selectedLine ? `Línea #${selectedLine.line_number}` : 'Selecciona una línea'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {!selectedLine ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Selecciona una línea para ver sugerencias
                            </p>
                        ) : suggestions.length === 0 ? (
                            <div className="space-y-3">
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        No se encontraron pagos coincidentes
                                    </AlertDescription>
                                </Alert>
                                <Button
                                    onClick={() => handleExclude(selectedLine.id)}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Excluir Línea
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {suggestions.map((suggestion, index) => (
                                    <div
                                        key={suggestion.payment_data.id}
                                        className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-semibold">
                                                        {suggestion.payment_data.display_id}
                                                    </span>
                                                    <Badge className={getScoreColor(suggestion.score)}>
                                                        {getScoreLabel(suggestion.score)} {suggestion.score}%
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-gray-600">
                                                    {suggestion.payment_data.contact_name || 'Sin contacto'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {format(new Date(suggestion.payment_data.date), 'dd MMM yyyy', { locale: es })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold font-mono">
                                                    ${Math.abs(parseFloat(suggestion.payment_data.amount)).toLocaleString('es-CL')}
                                                </div>
                                                {parseFloat(suggestion.difference) !== 0 && (
                                                    <div className="text-xs text-orange-600">
                                                        Dif: ${Math.abs(parseFloat(suggestion.difference)).toLocaleString('es-CL')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {suggestion.reasons.map((reason) => (
                                                <span key={reason} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                                    {reason.replace('_', ' ')}
                                                </span>
                                            ))}
                                        </div>

                                        <Button
                                            onClick={() => handleMatch(selectedLine.id, suggestion.payment_data.id)}
                                            disabled={matching}
                                            size="sm"
                                            className="w-full"
                                            variant={index === 0 ? "default" : "outline"}
                                        >
                                            {matching ? (
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="mr-2 h-3 w-3" />
                                            )}
                                            Confirmar Match
                                        </Button>
                                    </div>
                                ))}

                                <Button
                                    onClick={() => handleExclude(selectedLine.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full"
                                >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Excluir Línea
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            {/* Difference Adjustment Dialog */}
            <Dialog open={diffDialog.open} onOpenChange={open => setDiffDialog(prev => ({ ...prev, open }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajuste de Diferencia</DialogTitle>
                        <DialogDescription>
                            Existe una diferencia de ${parseFloat(diffDialog.amount).toLocaleString('es-CL')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de Ajuste</Label>
                            <Select value={diffType} onValueChange={setDiffType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="COMMISSION">Comisión Bancaria</SelectItem>
                                    <SelectItem value="INTEREST">Intereses</SelectItem>
                                    <SelectItem value="EXCHANGE_DIFF">Diferencia de Cambio</SelectItem>
                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                    <SelectItem value="ERROR">Error Operativo</SelectItem>
                                    <SelectItem value="OTHER">Otro Ajuste</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Notas (Opcional)</Label>
                            <Textarea
                                placeholder="Detalles del ajuste..."
                                value={diffNotes}
                                onChange={e => setDiffNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDiffDialog(prev => ({ ...prev, open: false }))}>Cancelar</Button>
                        <Button onClick={confirmDifferenceMatch} disabled={matching}>
                            {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirmar Ajuste
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
