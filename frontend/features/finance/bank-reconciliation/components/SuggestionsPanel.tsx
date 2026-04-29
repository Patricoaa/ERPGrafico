"use client"

import { Sparkles, CheckCircle2, AlertCircle, Info, Calculator, ArrowRight, X } from "lucide-react"
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
    const title = selectedLine ? "Sugerencias para el Movimiento" : "Movimientos sugeridos"

    return (
        <aside
            className={cn(
                "fixed top-20 right-4 h-[calc(100vh-6rem)] w-[360px] bg-sidebar dark border border-white/5 flex flex-col will-change-transform overflow-hidden z-40 shadow-2xl rounded-lg transition-all duration-500 ease-[var(--ease-premium)]",
                isOpen ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-sidebar/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-warning animate-pulse" />
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-white">{title}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                            {hasSuggestions ? `${suggestions.length || lineSuggestions.length} candidatos encontrados` : "Sin sugerencias automáticas"}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-white/10 text-white/40">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
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
                            <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Search className="h-6 w-6 text-white/20" />
                            </div>
                            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">No hay sugerencias automáticas para esta selección</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </aside>
    )
}

function Search({ className }: { className?: string }) {
    return <AlertCircle className={className} />
}

function ScoreBadge({ score }: { score: number }) {
    const colorClass = score >= 80 ? "bg-success/20 text-success border-success/30" : 
                       score >= 50 ? "bg-warning/20 text-warning border-warning/30" : 
                       "bg-white/5 text-white/40 border-white/10"
    
    return (
        <Badge variant="outline" className={cn("text-[10px] font-black h-5 px-2 tracking-tighter", colorClass)}>
            {score}% MATCH
        </Badge>
    )
}

function SuggestionCard({ suggestion, onMatch, isMatching }: { suggestion: PaymentSuggestion, onMatch: () => void, isMatching: boolean }) {
    const data = suggestion.is_batch ? suggestion.batch_data! : suggestion.payment_data!
    const diff = parseFloat(suggestion.difference)
    
    return (
        <Card className="bg-white/5 border-white/5 p-4 hover:border-white/10 transition-colors group relative overflow-hidden">
            {/* Background score indicator */}
            <div className="absolute top-0 right-0 h-1 bg-success/40 transition-all" style={{ width: `${suggestion.score}%` }} />
            
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">
                        {suggestion.is_batch ? 'Lote Terminal' : 'Pago / Cobro'}
                    </span>
                    <span className="text-xs font-bold text-white truncate max-w-[180px]">
                        {suggestion.is_batch ? suggestion.batch_data?.supplier_name || 'Liquidación Terminal' : suggestion.payment_data?.contact_name}
                    </span>
                    <span className="text-[10px] font-mono text-white/40 mt-1 uppercase">
                        ID: {data.display_id} • {suggestion.is_batch ? suggestion.batch_data?.sales_date : suggestion.payment_data?.date}
                    </span>
                </div>
                <ScoreBadge score={suggestion.score} />
            </div>

            <div className="flex items-center justify-between py-2 border-y border-white/5 mb-3">
                <div className="text-right">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Monto</p>
                    <p className="text-xs font-black text-white">{formatCurrency(suggestion.is_batch ? suggestion.batch_data!.net_amount : suggestion.payment_data!.amount)}</p>
                </div>
                <ArrowRight className="h-3 w-3 text-white/20" />
                <div className="text-right">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Diferencia</p>
                    <p className={cn("text-xs font-black", diff === 0 ? "text-success" : "text-warning")}>
                        {diff === 0 ? "EXACTA" : formatCurrency(diff)}
                    </p>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Razones de coincidencia</p>
                <div className="flex flex-wrap gap-1">
                    {suggestion.reasons.map((r, i) => (
                        <TooltipProvider key={i}>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant="secondary" className="bg-white/5 hover:bg-white/10 text-[9px] font-bold text-white/60 uppercase h-5">
                                        {getReasonIcon(r)}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="bg-popover border-border/10 text-[10px] font-bold uppercase tracking-widest">
                                    {r}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </div>
            </div>

            <Button 
                onClick={onMatch} 
                disabled={isMatching}
                className="w-full h-8 bg-success/10 hover:bg-success text-success hover:text-white border border-success/20 text-[10px] font-black uppercase tracking-widest transition-all"
            >
                {isMatching ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                Conciliar Ahora
            </Button>
        </Card>
    )
}

function LineSuggestionCard({ suggestion, onMatch, isMatching }: { suggestion: LineSuggestion, onMatch: () => void, isMatching: boolean }) {
    const data = suggestion.line_data
    const diff = parseFloat(suggestion.difference)
    
    return (
        <Card className="bg-white/5 border-white/5 p-4 hover:border-white/10 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 h-1 bg-info/40 transition-all" style={{ width: `${suggestion.score}%` }} />
            
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">Movimiento Bancario</span>
                    <span className="text-xs font-bold text-white truncate max-w-[180px]">{data.description}</span>
                    <span className="text-[10px] font-mono text-white/40 mt-1 uppercase">Ref: {data.reference} • {data.transaction_date}</span>
                </div>
                <ScoreBadge score={suggestion.score} />
            </div>

            <div className="flex items-center justify-between py-2 border-y border-white/5 mb-3">
                <div className="text-right">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Monto</p>
                    <p className="text-xs font-black text-white">{formatCurrency(parseFloat(data.credit) || parseFloat(data.debit))}</p>
                </div>
                <ArrowRight className="h-3 w-3 text-white/20" />
                <div className="text-right">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Diferencia</p>
                    <p className={cn("text-xs font-black", diff === 0 ? "text-success" : "text-warning")}>
                        {diff === 0 ? "EXACTA" : formatCurrency(diff)}
                    </p>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Razones</p>
                <div className="flex flex-wrap gap-1">
                    {suggestion.reasons.map((r, i) => (
                        <Badge key={i} variant="secondary" className="bg-white/5 text-[9px] font-bold text-white/60 uppercase h-5">
                            {r}
                        </Badge>
                    ))}
                </div>
            </div>

            <Button 
                onClick={onMatch} 
                disabled={isMatching}
                className="w-full h-8 bg-info/10 hover:bg-info text-info hover:text-white border border-info/20 text-[10px] font-black uppercase tracking-widest transition-all"
            >
                {isMatching ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                Asociar Movimiento
            </Button>
        </Card>
    )
}

function getReasonIcon(reason: string) {
    const lowers = reason.toLowerCase()
    if (lowers.includes('monto')) return <><Calculator className="h-2.5 w-2.5 mr-1" /> Monto</>
    if (lowers.includes('fecha')) return <><Info className="h-2.5 w-2.5 mr-1" /> Fecha</>
    if (lowers.includes('id') || lowers.includes('referencia')) return <><Info className="h-2.5 w-2.5 mr-1" /> ID/Ref</>
    return reason
}

function Loader2({ className }: { className?: string }) {
    return <AlertCircle className={cn("animate-spin", className)} />
}
