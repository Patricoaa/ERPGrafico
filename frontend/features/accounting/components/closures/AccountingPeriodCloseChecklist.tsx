"use client"

import React, { useEffect, useReducer } from 'react'
import { BaseModal, CancelButton, SubmitButton } from '@/components/shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2, AlertTriangle, Loader2, ClipboardCheck } from 'lucide-react'
import { accountingApi } from '../../api/accountingApi'
import { cn } from '@/lib/utils'

interface StatusData {
    period_exists: boolean
    period_status: string
    tax_period_closed: boolean
    draft_entries_count: number
    draft_invoices_count: number
    payroll_count: number
    payroll_posted_count: number
    reconciliation_count: number
    reconciliation_confirmed_count: number
    is_fully_closable: boolean
}

interface AccountingPeriodCloseChecklistModalProps {
    isOpen: boolean
    periodId: number
    year: number
    month: number
    onClose: () => void
    onConfirm: () => void
    isLoading: boolean
}

interface ChecklistItem {
    label: string
    passed: boolean
    detail?: string
    critical: boolean
}

export function AccountingPeriodCloseChecklistModal({
    isOpen,
    periodId,
    year,
    month,
    onClose,
    onConfirm,
    isLoading,
}: AccountingPeriodCloseChecklistModalProps) {
    type FetchState =
        | { status: 'idle' }
        | { status: 'loading' }
        | { status: 'error'; error: string }
        | { status: 'success'; data: StatusData }

    type FetchAction =
        | { type: 'FETCH_START' }
        | { type: 'FETCH_SUCCESS'; data: StatusData }
        | { type: 'FETCH_ERROR'; error: string }
        | { type: 'RESET' }

    function fetchReducer(state: FetchState, action: FetchAction): FetchState {
        switch (action.type) {
            case 'FETCH_START': return { status: 'loading' }
            case 'FETCH_SUCCESS': return { status: 'success', data: action.data }
            case 'FETCH_ERROR': return { status: 'error', error: action.error }
            case 'RESET': return { status: 'idle' }
        }
    }

    const [fetchState, dispatch] = useReducer(fetchReducer, { status: 'idle' })

    useEffect(() => {
        if (isOpen && periodId) {
            dispatch({ type: 'FETCH_START' })
            accountingApi.getAccountingPeriodStatus(periodId)
                .then(data => dispatch({ type: 'FETCH_SUCCESS', data: data as unknown as StatusData }))
                .catch(err => {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                        || 'Error al obtener el estado del período'
                    dispatch({ type: 'FETCH_ERROR', error: msg })
                })
        } else {
            dispatch({ type: 'RESET' })
        }
    }, [isOpen, periodId])

    const isFetching = fetchState.status === 'loading'
    const fetchError = fetchState.status === 'error' ? fetchState.error : null
    const status = fetchState.status === 'success' ? fetchState.data : null

    const items: ChecklistItem[] = status
        ? [
            {
                label: 'Período tributario (F29) cerrado',
                passed: status.tax_period_closed,
                critical: true,
            },
            {
                label: 'Sin asientos en borrador',
                passed: status.draft_entries_count === 0,
                detail: status.draft_entries_count > 0 ? `${status.draft_entries_count} asiento(s) en borrador` : undefined,
                critical: true,
            },
            {
                label: 'Sin facturas en borrador',
                passed: status.draft_invoices_count === 0,
                detail: status.draft_invoices_count > 0 ? `${status.draft_invoices_count} factura(s) en borrador` : undefined,
                critical: false,
            },
            {
                label: 'Nóminas del mes',
                passed: status.payroll_count > 0,
                detail: status.payroll_count > 0
                    ? `${status.payroll_count} nómina(s) creadas, ${status.payroll_posted_count} contabilizada(s)`
                    : 'Sin nóminas creadas',
                critical: false,
            },
            {
                label: 'Conciliaciones bancarias creadas y finalizadas',
                passed: status.reconciliation_confirmed_count > 0,
                detail: status.reconciliation_count > 0
                    ? `${status.reconciliation_confirmed_count} de ${status.reconciliation_count} conciliación(es) confirmada(s)`
                    : 'Sin conciliaciones bancarias en el período',
                critical: false,
            },
        ]
        : []

    const canClose = status?.tax_period_closed && status?.draft_entries_count === 0

    return (
        <BaseModal
            open={isOpen}
            onOpenChange={onClose}
            icon={ClipboardCheck}
            title={`Checklist de Cierre — ${month}/${year}`}
            description="Verifique los siguientes puntos antes de cerrar el período contable"
            size="lg"
            footer={
                <div className="flex items-center justify-between w-full">
                    <CancelButton onClick={onClose}>
                        Cancelar
                    </CancelButton>
                    <SubmitButton
                        onClick={onConfirm}
                        disabled={!canClose || isLoading || isFetching}
                        loading={isLoading}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest text-[11px] h-10 px-6"
                    >
                        {canClose ? 'Confirmar Cierre' : 'Revisar Pendientes'}
                    </SubmitButton>
                </div>
            }
        >
            <div className="space-y-4 py-2">
                {isFetching ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        <span className="ml-3 text-sm text-muted-foreground">Verificando estado del período...</span>
                    </div>
                ) : fetchError ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertTitle className="text-xs font-bold uppercase">Error</AlertTitle>
                        <AlertDescription className="text-xs">{fetchError}</AlertDescription>
                    </Alert>
                ) : status ? (
                    <>
                        <div className="space-y-2">
                            {items.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "flex items-start gap-3 p-3 border rounded-sm transition-colors",
                                        item.passed
                                            ? "border-success/30 bg-success/5"
                                            : item.critical
                                            ? "border-destructive/30 bg-destructive/5"
                                            : "border-warning/30 bg-warning/5"
                                    )}
                                >
                                    {item.passed ? (
                                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertTriangle className={cn(
                                            "w-4 h-4 shrink-0 mt-0.5",
                                            item.critical ? "text-destructive" : "text-warning"
                                        )} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-xs font-medium",
                                                item.passed && "text-muted-foreground line-through"
                                            )}>
                                                {item.label}
                                            </span>
                                            {item.critical && !item.passed && (
                                                <span className="text-[8px] uppercase tracking-wider text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-sm font-bold">Obligatorio</span>
                                            )}
                                            {!item.critical && !item.passed && (
                                                <span className="text-[8px] uppercase tracking-wider text-warning bg-warning/10 px-1.5 py-0.5 rounded-sm font-bold">Sugerido</span>
                                            )}
                                        </div>
                                        {item.detail && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {canClose ? (
                            <Alert variant="success" className="mt-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <AlertTitle className="text-xs font-bold uppercase">Listo para cerrar</AlertTitle>
                                <AlertDescription className="text-[10px]">
                                    Todos los requisitos obligatorios están cumplidos. Puede proceder con el cierre del período contable.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert variant="warning" className="mt-2">
                                <AlertTriangle className="w-4 h-4" />
                                <AlertTitle className="text-xs font-bold uppercase">Hay pendientes que resolver</AlertTitle>
                                <AlertDescription className="text-[10px]">
                                    Complete los items obligatorios marcados en rojo antes de cerrar el período.
                                    Los items sugeridos son recomendaciones y no bloquean el cierre.
                                </AlertDescription>
                            </Alert>
                        )}
                    </>
                ) : null}
            </div>
        </BaseModal>
    )
}
