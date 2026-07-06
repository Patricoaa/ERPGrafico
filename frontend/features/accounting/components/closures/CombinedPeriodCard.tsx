"use client"

import React from 'react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Calendar, Lock, LockOpen, FileText, FileCheck, Undo2, DollarSign, Plus } from 'lucide-react'
import { IconButton, StatusBadge } from '@/components/shared'
import { type AccountingPeriod, type TaxPeriod } from '../../types'
import { useReopenConfirm } from '../../hooks/useReopenConfirm'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface CombinedPeriodCardProps {
    month: number
    year: number
    accountingPeriod?: AccountingPeriod
    taxPeriod?: TaxPeriod
    onClosePeriod: (id: number) => void
    onReopenPeriod: (params: { id: number; reason?: string }) => Promise<unknown>
    onCreatePeriod: (year: number, month: number) => Promise<unknown>
    isPeriodActionLoading: boolean
    onCloseTaxPeriod: (id: number) => Promise<void>
    onReopenTaxPeriod: (params: { id: number; reason?: string }) => Promise<unknown>
    onOpenDeclaration: (params: { id?: number; year: number; month: number }) => void
    isTaxActionLoading: boolean
    onPayF29?: (periodId: number) => void
}

export function CombinedPeriodCard({
    month, year,
    accountingPeriod: acct, taxPeriod: tax,
    onClosePeriod, onReopenPeriod, onCreatePeriod, isPeriodActionLoading,
    onCloseTaxPeriod, onReopenTaxPeriod, onOpenDeclaration, isTaxActionLoading, onPayF29,
}: CombinedPeriodCardProps) {
    const acctClosed = acct?.status === 'CLOSED'
    const taxClosed = tax?.status === 'CLOSED'
    const taxFrozen = !!(acct?.tax_period_id && acct?.tax_period_status === 'CLOSED')
    const hasDeclaration = !!tax?.declaration_summary
    const isFullyPaid = tax?.declaration_summary?.is_fully_paid ?? true
    const requiresPayment = hasDeclaration && (tax?.declaration_summary?.vat_to_pay ?? 0) > 0

    const {
        confirmAndExecute: confirmReopenAcct,
        dialog: reopenAcctDialog,
    } = useReopenConfirm(onReopenPeriod, { periodType: 'contable' })

    const {
        confirmAndExecute: confirmReopenTax,
        dialog: reopenTaxDialog,
    } = useReopenConfirm(onReopenTaxPeriod, { periodType: 'tributario (F29)' })

    return (
        <TooltipProvider>
            <Card className="p-3 border border-border/40 shadow-none hover:border-border/60 transition-colors h-full flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className=" font-bold text-xs uppercase">{MONTHS[month - 1]}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    {/* Contable row */}
                    <div className="flex items-center justify-between py-1 px-1.5 rounded-sm min-h-[28px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-11 shrink-0">Cont</span>
                            {acct ? (
                                <StatusBadge status={acct.status} label={acct.status_display} variant="dot" size="xs" />
                            ) : (
                                <button
                                    className="inline-flex items-center justify-center rounded-sm text-[9px] font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-5 px-1.5 text-muted-foreground/60 border border-dashed border-border"
                                    onClick={() => onCreatePeriod(year, month)}
                                    disabled={isPeriodActionLoading}
                                >
                                    <Plus className="w-2.5 h-2.5 mr-0.5" /> Abrir
                                </button>
                            )}
                        </div>
                        {acct && !acctClosed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-7 w-7 text-muted-foreground hover:text-warning" onClick={() => onClosePeriod(acct.id)} disabled={isPeriodActionLoading}>
                                        <Lock className="w-3.5 h-3.5" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Cerrar periodo contable</p></TooltipContent>
                            </Tooltip>
                        )}
                        {acct && acctClosed && !taxFrozen && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => confirmReopenAcct(acct.id)} disabled={isPeriodActionLoading}>
                                        <LockOpen className="w-3.5 h-3.5" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Reabrir periodo contable</p></TooltipContent>
                            </Tooltip>
                        )}
                        {acct && acctClosed && taxFrozen && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-7 w-7 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed">
                                        <Lock className="w-3.5 h-3.5" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Bloqueado por cierre F29</p></TooltipContent>
                            </Tooltip>
                        )}
                    </div>

                    {/* F29 row */}
                    <div className="flex items-center justify-between py-1 px-1.5 rounded-sm min-h-[28px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-11 shrink-0">F29</span>
                            {tax ? (
                                <StatusBadge
                                    status={taxClosed ? 'CLOSED' : hasDeclaration ? (isFullyPaid && requiresPayment ? 'PAID' : 'UNDER_REVIEW') : 'OPEN'}
                                    label={taxClosed ? 'Cerrado' : hasDeclaration ? (isFullyPaid && requiresPayment ? 'Pagado' : 'Declarado') : 'Pendiente'}
                                    variant="dot"
                                    size="xs"
                                />
                            ) : (
                                <span className="text-[9px] text-muted-foreground/40 italic">—</span>
                            )}
                        </div>
                        {(!tax || (!taxClosed && !hasDeclaration)) && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="inline-flex">
                                        <IconButton className="h-7 w-7 text-muted-foreground hover:text-info" onClick={() => onOpenDeclaration({ id: tax?.id, year, month })} disabled={isTaxActionLoading || !acct || acctClosed}>
                                            <FileText className="w-3.5 h-3.5" />
                                        </IconButton>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-xs">
                                        {!acct ? 'Abrir periodo contable primero' : (acctClosed ? 'Periodo contable cerrado' : 'Declarar F29')}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {tax && !taxClosed && hasDeclaration && !isFullyPaid && requiresPayment && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-7 w-7 text-success hover:text-success/80" onClick={() => onPayF29?.(tax.id)} disabled={isTaxActionLoading}>
                                        <DollarSign className="w-3.5 h-3.5" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Pagar F29 antes de cerrar</p></TooltipContent>
                            </Tooltip>
                        )}
                        {tax && !taxClosed && hasDeclaration && (isFullyPaid || !requiresPayment) && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-7 w-7 text-muted-foreground hover:text-warning" onClick={() => onCloseTaxPeriod(tax.id)} disabled={isTaxActionLoading}>
                                        <FileCheck className="w-3.5 h-3.5" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Cerrar F29</p></TooltipContent>
                            </Tooltip>
                        )}
                        {tax && taxClosed && !acctClosed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <IconButton className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => confirmReopenTax(tax.id)} disabled={isTaxActionLoading}>
                                        <Undo2 className="w-3.5 h-3.5" />
                                    </IconButton>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Reabrir F29</p></TooltipContent>
                            </Tooltip>
                        )}
                        {tax?.declaration_summary?.document && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <a href={tax.declaration_summary.document} target="_blank" rel="noopener noreferrer" className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-colors">
                                        <FileText className="w-3.5 h-3.5" />
                                    </a>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Ver comprobante F29</p></TooltipContent>
                            </Tooltip>
                        )}
                        {tax && taxClosed && acctClosed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-7 w-7 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed">
                                        <Lock className="w-3.5 h-3.5" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Periodo completamente cerrado</p></TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </Card>

            {reopenAcctDialog}
            {reopenTaxDialog}
        </TooltipProvider>
    )
}
