"use client"

import { Sparkles, CheckCircle2, Info, Calculator, ArrowRight, X, Loader2 } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { BankStatementLine, ReconciliationSystemItem } from "../types"

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

export interface PaymentSuggestion {
    payment_data?: PaymentData
    batch_data?: BatchData
    is_batch?: boolean
    score: number
    reasons: string[]
    difference: string
}

export interface LineSuggestion {
    line_data: BankStatementLine
    score: number
    reasons: string[]
    difference: string
}

interface SuggestionsPanelProps {
    isOpen: boolean
    onClose: () => void
    suggestions: PaymentSuggestion[]
    lineSuggestions: LineSuggestion[]
    selectedLine?: BankStatementLine
    selectedPayment?: ReconciliationSystemItem
    onMatch: (id: number, isBatch?: boolean) => void
    isMatching: boolean
}

export function SuggestionsPanel({
    isOpen,
    onClose,
    suggestions,
    lineSuggestions,
    selectedLine,
    selectedPayment,
    onMatch,
    isMatching
}: SuggestionsPanelProps) {
    
    const hasSuggestions = suggestions.length > 0 || lineSuggestions.length > 0
    const title = selectedLine ? "Sugerencias" : "Líneas sugeridas"
    const count = suggestions.length || lineSuggestions.length

    return (
        <aside
            className={cn(
                "fixed top-20 right-4 h-[calc(100vh-6rem)] w-[340px] bg-card border shadow-floating flex flex-col will-change-transform overflow-hidden z-40 rounded-lg transition-all duration-500 ease-[var(--ease-premium)]",
                isOpen ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-warning" />
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-foreground">{title}</h2>
                        <p className="text-[10px] text-muted-foreground">
                            {hasSuggestions ? `${count} candidato${count !== 1 ? 's' : ''}` : "Sin sugerencias"}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                    {selectedLine && suggestions.map((s, idx) => (
                        <SuggestionCard 
                            key={idx}
                            suggestion={s}
                            onMatch={() => onMatch(s.is_batch ? s.batch_data!.id : s.payment_data!.id, s.is_batch)}
                            isMatching={isMatching}
                        />
                    ))}

                    {selectedPayment && lineSuggestions.map((s, idx) => (
                        <LineSuggestionCard 
                            key={idx}
                            suggestion={s}
                            onMatch={() => onMatch(s.line_data.id)}
                            isMatching={isMatching}
                        />
                    ))}

                    {!hasSuggestions && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Info className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">No hay sugerencias para esta selección</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </aside>
    )
}

function ScoreBadge({ score }: { score: number }) {
    const colorClass = score >= 80 ? "bg-success/10 text-success border-success/20" : 
                       score >= 50 ? "bg-warning/10 text-warning border-warning/20" : 
                       "bg-muted text-muted-foreground border-border"
    
    return (
        <Badge variant="outline" className={cn("text-[10px] font-bold h-5 px-1.5 tabular-nums", colorClass)}>
            {score}%
        </Badge>
    )
}

function SuggestionCard({ suggestion, onMatch, isMatching }: { suggestion: PaymentSuggestion, onMatch: () => void, isMatching: boolean }) {
    const data = suggestion.is_batch ? suggestion.batch_data! : suggestion.payment_data!
    const diff = parseFloat(suggestion.difference)
    
    return (
        <Card className="p-3 hover:border-primary/30 transition-colors group relative overflow-hidden">
            {/* Score bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted">
                <div className="h-full bg-success/60 transition-all" style={{ width: `${suggestion.score}%` }} />
            </div>
            
            <div className="flex justify-between items-start mb-2 pt-1">
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {suggestion.is_batch ? 'Lote Terminal' : 'Pago'}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate max-w-[160px]">
                        {suggestion.is_batch ? suggestion.batch_data?.supplier_name || 'Terminal' : suggestion.payment_data?.contact_name}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                        {data.display_id}
                    </span>
                </div>
                <ScoreBadge score={suggestion.score} />
            </div>

            <div className="flex items-center justify-between py-1.5 border-y border-border/50 mb-2 text-xs">
                <div>
                    <span className="font-mono font-bold">{formatCurrency(suggestion.is_batch ? suggestion.batch_data!.net_amount : suggestion.payment_data!.amount)}</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                <div>
                    <span className={cn("font-mono font-bold", diff === 0 ? "text-success" : "text-warning")}>
                        {diff === 0 ? "Exacto" : formatCurrency(diff)}
                    </span>
                </div>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
                {suggestion.reasons.map((r, i) => (
                    <TooltipProvider key={i}>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium">
                                    {getReasonIcon(r)}
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">{r}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>

            <Button 
                onClick={onMatch} 
                disabled={isMatching}
                size="sm"
                className="w-full h-7 bg-success hover:bg-success/90 text-success-foreground text-[10px] font-bold uppercase"
            >
                {isMatching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Conciliar
            </Button>
        </Card>
    )
}

function LineSuggestionCard({ suggestion, onMatch, isMatching }: { suggestion: LineSuggestion, onMatch: () => void, isMatching: boolean }) {
    const data = suggestion.line_data
    const diff = parseFloat(suggestion.difference)
    
    return (
        <Card className="p-3 hover:border-info/30 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted">
                <div className="h-full bg-info/60 transition-all" style={{ width: `${suggestion.score}%` }} />
            </div>
            
            <div className="flex justify-between items-start mb-2 pt-1">
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Mov. Bancario</span>
                    <span className="text-xs font-bold text-foreground truncate max-w-[160px]">{data.description}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">Ref: {data.reference}</span>
                </div>
                <ScoreBadge score={suggestion.score} />
            </div>

            <div className="flex items-center justify-between py-1.5 border-y border-border/50 mb-2 text-xs">
                <span className="font-mono font-bold">{formatCurrency(parseFloat(data.credit) || parseFloat(data.debit))}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                <span className={cn("font-mono font-bold", diff === 0 ? "text-success" : "text-warning")}>
                    {diff === 0 ? "Exacto" : formatCurrency(diff)}
                </span>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
                {suggestion.reasons.map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] h-4 px-1.5 font-medium">{r}</Badge>
                ))}
            </div>

            <Button 
                onClick={onMatch} 
                disabled={isMatching}
                size="sm"
                className="w-full h-7 bg-info hover:bg-info/90 text-info-foreground text-[10px] font-bold uppercase"
            >
                {isMatching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Asociar
            </Button>
        </Card>
    )
}

function getReasonIcon(reason: string) {
    const lowers = reason.toLowerCase()
    if (lowers.includes('monto')) return <><Calculator className="h-2.5 w-2.5 mr-1 inline" /> Monto</>
    if (lowers.includes('fecha')) return <><Info className="h-2.5 w-2.5 mr-1 inline" /> Fecha</>
    if (lowers.includes('id') || lowers.includes('referencia')) return <><Info className="h-2.5 w-2.5 mr-1 inline" /> ID/Ref</>
    return reason
}
