"use client"

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BaseModal, CancelButton, SubmitButton, Skeleton, EmptyState } from '@/components/shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ClipboardCheck } from 'lucide-react'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { getEntityMetadata } from '@/lib/entity-registry'
import { DeclarationWizard, PendingChecklistSection, type PendingChecklistItem, type PendingDocumentLabel } from '@/features/tax'
import { useAccountingPeriodStatus } from '../../hooks/useAccountingPeriodStatus'
import type { AccountingPeriodStatus } from '../../api/accountingApi'

interface AccountingPeriodCloseChecklistModalProps {
    isOpen: boolean
    periodId: number
    year: number
    month: number
    onClose: () => void
    onConfirm: () => void
    isLoading: boolean
}

interface WizardTarget {
    periodId: number | undefined
    year: number
    month: number
}

function errorMessage(error: unknown): string {
    const msg = (error as { response?: { data?: { error?: unknown } } } | null)?.response?.data?.error
    return typeof msg === 'string' && msg ? msg : 'Error al obtener el estado del período'
}

function zeroStateAction(label: PendingDocumentLabel, text: string): PendingChecklistItem['action'] {
    const href = getEntityMetadata(label)?.listUrl
    return href ? { text, href } : undefined
}

function buildItems(status: AccountingPeriodStatus, openF29: () => void): { required: PendingChecklistItem[]; suggested: PendingChecklistItem[] } {
    const pendingPayrolls = Math.max(status.payroll_count - status.payroll_posted_count, 0)
    const pendingStatements = Math.max(status.reconciliation_count - status.reconciliation_confirmed_count, 0)

    return {
        required: [
            {
                key: 'f29',
                title: 'Período tributario (F29) cerrado',
                passed: status.tax_period_closed,
                detail: status.tax_period_closed ? undefined : 'Declare, pague y cierre el F29 del mes',
                action: status.tax_period_closed ? undefined : { text: 'Abrir F29', onClick: openF29 },
            },
            {
                key: 'entries',
                title: 'Sin asientos en borrador',
                passed: status.draft_entries_count === 0,
                detail: status.draft_entries_count > 0 ? `${status.draft_entries_count} asiento(s) en borrador` : undefined,
                pending: { label: 'accounting.journalentry', documents: status.draft_entries, total: status.draft_entries_count },
            },
            {
                key: 'invoices',
                title: 'Sin facturas en borrador',
                passed: status.draft_invoices_count === 0,
                detail: status.draft_invoices_count > 0 ? `${status.draft_invoices_count} factura(s) en borrador` : undefined,
                pending: { label: 'billing.invoice', documents: status.draft_invoices, total: status.draft_invoices_count },
            },
        ],
        suggested: [
            {
                key: 'payrolls',
                title: 'Nóminas del mes contabilizadas',
                passed: status.payroll_count > 0 && pendingPayrolls === 0,
                detail: status.payroll_count > 0
                    ? `${status.payroll_count} nómina(s) creadas, ${status.payroll_posted_count} contabilizada(s)`
                    : 'Sin nóminas creadas',
                action: status.payroll_count === 0 ? zeroStateAction('hr.payroll', 'Crear nómina') : undefined,
                pending: { label: 'hr.payroll', documents: status.unposted_payrolls, total: pendingPayrolls },
            },
            {
                key: 'statements',
                title: 'Conciliaciones bancarias confirmadas',
                passed: status.reconciliation_count > 0 && pendingStatements === 0,
                detail: status.reconciliation_count > 0
                    ? `${status.reconciliation_confirmed_count} de ${status.reconciliation_count} conciliación(es) confirmada(s)`
                    : 'Sin conciliaciones bancarias en el período',
                action: status.reconciliation_count === 0 ? zeroStateAction('treasury.bankstatement', 'Ir a conciliaciones') : undefined,
                pending: { label: 'treasury.bankstatement', documents: status.unconfirmed_statements, total: pendingStatements },
            },
        ],
    }
}

/**
 * Checklist previo al cierre de un período contable. Los documentos pendientes se abren con
 * `openEntity` (pestaña del espacio de trabajo) y el F29 con el `DeclarationWizard`. Mientras uno de
 * ellos está a la vista, el checklist cede el paso (su diálogo se oculta sin desmontar el componente:
 * conserva lo expandido) y al volver recarga el estado.
 */
export function AccountingPeriodCloseChecklistModal({
    isOpen,
    periodId,
    year,
    month,
    onClose,
    onConfirm,
    isLoading,
}: AccountingPeriodCloseChecklistModalProps) {
    const { status, isLoading: isFetchingFirst, isFetching, error, refetch } = useAccountingPeriodStatus(periodId, isOpen)
    const { openEntity, tabs } = useGlobalModals()
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
    // Objetivo del wizard F29 fijado al pulsar el CTA: el refetch del estado (p. ej. al volver el foco)
    // no debe cambiar `periodId` a mitad del flujo ni remontar el wizard.
    const [wizardTarget, setWizardTarget] = useState<WizardTarget | null>(null)

    // Un documento abierto desde el checklist es la pestaña activa: el diálogo modal del checklist
    // lo taparía (portal en body sobre #main-content), así que cede el paso mientras siga a la vista.
    const documentActive = isOpen && tabs.some(tab => tab.active)
    const wasDocumentActive = useRef(documentActive)
    useEffect(() => {
        if (wasDocumentActive.current && !documentActive) void refetch()
        wasDocumentActive.current = documentActive
    }, [documentActive, refetch])

    const toggle = (key: string) => setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
    })

    const closeWizard = () => {
        setWizardTarget(null)
        void refetch()
    }

    const items = status ? buildItems(status, () => setWizardTarget({ periodId: status.tax_period_id ?? undefined, year, month })) : null
    const canClose = !!status && status.tax_period_closed && status.draft_entries_count === 0 && status.draft_invoices_count === 0

    return (
        <>
            <BaseModal
                open={isOpen && !documentActive}
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
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest text-2xs h-10 px-6"
                        >
                            {canClose ? 'Confirmar Cierre' : 'Revisar Pendientes'}
                        </SubmitButton>
                    </div>
                }
            >
                <div className="space-y-5 py-1">
                    {isFetchingFirst ? (
                        <div className="space-y-3" aria-busy="true">
                            <span className="sr-only">Verificando estado del período...</span>
                            {Array.from({ length: 5 }, (_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                    <Skeleton className="h-4 flex-1" />
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertTitle className="text-xs font-bold uppercase">Error</AlertTitle>
                            <AlertDescription className="text-xs">
                                <p>{errorMessage(error)}</p>
                                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => { void refetch() }}>
                                    Reintentar
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : items ? (
                        <>
                            <PendingChecklistSection title="Obligatorios" items={items.required} critical expanded={expanded} onToggle={toggle} onOpenDocument={openEntity} />
                            <PendingChecklistSection title="Sugeridos" items={items.suggested} critical={false} expanded={expanded} onToggle={toggle} onOpenDocument={openEntity} />
                            <p className="text-xs text-muted-foreground">
                                {canClose
                                    ? 'Los requisitos obligatorios están cumplidos. Puede cerrar el período contable.'
                                    : 'Resuelva los ítems obligatorios antes de cerrar. Los sugeridos no bloquean el cierre.'}
                            </p>
                        </>
                    ) : (
                        <EmptyState variant="compact" title="Sin información del período" description="No hay estado disponible para este período." />
                    )}
                </div>
            </BaseModal>
            {wizardTarget && (
                <DeclarationWizard
                    isOpen
                    onOpenChange={(open) => { if (!open) closeWizard() }}
                    periodId={wizardTarget.periodId}
                    year={wizardTarget.year}
                    month={wizardTarget.month}
                    onSuccess={closeWizard}
                />
            )}
        </>
    )
}
