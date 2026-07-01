"use client"

import React from 'react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Calendar, Lock, LockOpen, FileText } from 'lucide-react'
import { IconButton, StatusBadge } from '@/components/shared'
import { type AccountingPeriod, type TaxPeriod } from '../../types'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface CombinedPeriodCardProps {
    month: number
    year: number
    accountingPeriod?: AccountingPeriod
    taxPeriod?: TaxPeriod
    onClosePeriod: (id: number) => void
    onReopenPeriod: (id: number) => void
    isPeriodActionLoading: boolean
    onCloseTaxPeriod: (id: number) => Promise<void>
    onReopenTaxPeriod: (id: number) => Promise<void>
    onOpenDeclaration: (id: number) => void
    isTaxActionLoading: boolean
}

export function CombinedPeriodCard({
    month, year,
    accountingPeriod: acct, taxPeriod: tax,
    onClosePeriod, onReopenPeriod, isPeriodActionLoading,
    onCloseTaxPeriod, onReopenTaxPeriod, onOpenDeclaration, isTaxActionLoading,
}: CombinedPeriodCardProps) {
    const acctClosed = acct?.status === 'CLOSED'
    const taxClosed = tax?.status === 'CLOSED'
    const taxFrozen = !!(acct?.tax_period_id && acct?.tax_period_status === 'CLOSED')
    const hasDeclaration = !!tax?.declaration_summary

    return (
        <TooltipProvider>
            <Card className="p-3 border border-border/40 shadow-none hover:border-border/60 transition-colors h-full flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="font-heading font-bold text-xs uppercase">{MONTHS[month - 1]}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono">{String(month).padStart(2, '0')}/{year}</span>
                </div>

                <div className="space-y-1">
                    {/* Contable row */}
                    <div className="flex items-center justify-between py-1 px-1.5 rounded-sm min-h-[26px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground w-11 shrink-0">Cont</span>
                            {acct ? (
                                <StatusBadge status={acct.status} label={acct.status_display} variant="dot" size="xs" />
                            ) : (
                                <span className="text-[9px] text-muted-foreground/40 italic">—</span>
                            )}
                        </div>
                        {acct && !acctClosed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-6 w-6 text-muted-foreground hover:text-warning" onClick={() => onClosePeriod(acct.id)} disabled={isPeriodActionLoading}>
                                        <Lock className="w-3 h-3" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Cerrar periodo contable</p></TooltipContent>
                            </Tooltip>
                        )}
                        {acct && acctClosed && !taxFrozen && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onReopenPeriod(acct.id)} disabled={isPeriodActionLoading}>
                                        <LockOpen className="w-3 h-3" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Reabrir periodo contable</p></TooltipContent>
                            </Tooltip>
                        )}
                        {acct && acctClosed && taxFrozen && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-6 w-6 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed">
                                        <Lock className="w-3 h-3" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Bloqueado por cierre F29</p></TooltipContent>
                            </Tooltip>
                        )}
                    </div>

                    {/* F29 row */}
                    <div className="flex items-center justify-between py-1 px-1.5 rounded-sm min-h-[26px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground w-11 shrink-0">F29</span>
                            {tax ? (
                                <StatusBadge
                                    status={taxClosed ? 'CLOSED' : hasDeclaration ? 'UNDER_REVIEW' : 'OPEN'}
                                    label={taxClosed ? 'Cerrado' : hasDeclaration ? 'Declarado' : 'Pendiente'}
                                    variant="dot"
                                    size="xs"
                                />
                            ) : (
                                <span className="text-[9px] text-muted-foreground/40 italic">—</span>
                            )}
                        </div>
                        {tax && !taxClosed && !hasDeclaration && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-6 w-6 text-muted-foreground hover:text-info" onClick={() => onOpenDeclaration(tax.id)} disabled={isTaxActionLoading}>
                                        <FileText className="w-3 h-3" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Declarar F29</p></TooltipContent>
                            </Tooltip>
                        )}
                        {tax && !taxClosed && hasDeclaration && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-6 w-6 text-muted-foreground hover:text-warning" onClick={() => onCloseTaxPeriod(tax.id)} disabled={isTaxActionLoading}>
                                        <Lock className="w-3 h-3" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Cerrar F29</p></TooltipContent>
                            </Tooltip>
                        )}
                        {tax && taxClosed && !acctClosed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => onReopenTaxPeriod(tax.id)} disabled={isTaxActionLoading}>
                                        <LockOpen className="w-3 h-3" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Reabrir F29</p></TooltipContent>
                            </Tooltip>
                        )}
                        {tax && taxClosed && acctClosed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-6 w-6 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed">
                                        <Lock className="w-3 h-3" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Periodo completamente cerrado</p></TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </Card>
        </TooltipProvider>
    )
}
