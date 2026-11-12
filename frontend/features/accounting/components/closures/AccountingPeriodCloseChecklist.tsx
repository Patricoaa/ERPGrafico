"use client"

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BaseModal, CancelButton, SubmitButton, MoneyDisplay, Skeleton, EmptyState } from '@/components/shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertTriangle, CircleAlert, ClipboardCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { getEntityMetadata } from '@/lib/entity-registry'
import { formatPlainDate } from '@/lib/utils'
import { DeclarationWizard } from '@/features/tax'
import { useAccountingPeriodStatus } from '../../hooks/useAccountingPeriodStatus'
import type { AccountingPeriodStatus, PendingDocument } from '../../api/accountingApi'

interface AccountingPeriodCloseChecklistModalProps {
    isOpen: boolean
    periodId: number
    year: number
    month: number
    onClose: () => void
    onConfirm: () => void
    isLoading: boolean
}

type DocumentLabel = 'accounting.journalentry' | 'billing.invoice' | 'hr.payroll' | 'treasury.bankstatement'

interface WizardTarget {
    periodId: number | undefined
    year: number
    month: number
}

interface ChecklistItem {
    key: string
    title: string
    passed: boolean
    detail?: string
    /** Documentos pendientes: los listados (hasta 50) y el total real. */
    pending?: { label: DocumentLabel; documents: PendingDocument[]; total: number }
    action?: { text: string; onClick?: () => void; href?: string }
}

function errorMessage(error: unknown): string {
    const msg = (error as { response?: { data?: { error?: unknown } } } | null)?.response?.data?.error
    return typeof msg === 'string' && msg ? msg : 'Error al obtener el estado del período'
}

function zeroStateAction(label: DocumentLabel, text: string): ChecklistItem['action'] {
    const href = getEntityMetadata(label)?.listUrl
    return href ? { text, href } : undefined
}

function buildItems(status: AccountingPeriodStatus, openF29: () => void): { required: ChecklistItem[]; suggested: ChecklistItem[] } {
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
        ],
        suggested: [
            {
                key: 'invoices',
                title: 'Sin facturas en borrador',
                passed: status.draft_invoices_count === 0,
                detail: status.draft_invoices_count > 0 ? `${status.draft_invoices_count} factura(s) en borrador` : undefined,
                pending: { label: 'billing.invoice', documents: status.draft_invoices, total: status.draft_invoices_count },
            },
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

function StateIcon({ passed, critical }: { passed: boolean; critical: boolean }) {
    if (passed) return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
    if (critical) return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
    return <CircleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
}

interface ChecklistRowProps {
    item: ChecklistItem
    critical: boolean
    expanded: boolean
    onToggle: () => void
    onOpenDocument: (label: DocumentLabel, id: number) => void
}

function ChecklistRow({ item, critical, expanded, onToggle, onOpenDocument }: ChecklistRowProps) {
    const pending = item.pending && item.pending.total > 0 ? item.pending : null
    const hidden = pending ? pending.total - pending.documents.length : 0
    const listUrl = pending ? getEntityMetadata(pending.label)?.listUrl : undefined
    const Chevron = expanded ? ChevronDown : ChevronRight

    return (
        <li className="py-2.5">
            <div className="flex items-start gap-3">
                <span className="mt-0.5"><StateIcon passed={item.passed} critical={critical} /></span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-2xs text-muted-foreground">{item.passed ? 'Listo' : 'Pendiente'}</span>
                    </div>
                    {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                </div>
                {pending && (
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={onToggle} aria-expanded={expanded}>
                        <Chevron className="h-3.5 w-3.5" aria-hidden />
                        {`Ver ${pending.total} ${pending.total === 1 ? 'pendiente' : 'pendientes'}`}
                    </Button>
                )}
                {item.action && (item.action.href ? (
                    <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
                        <Link href={item.action.href}>{item.action.text}</Link>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={item.action.onClick}>
                        {item.action.text}
                    </Button>
                ))}
            </div>
            {pending && expanded && (
                <ul className="mt-2 ml-7 border-l border-border pl-3">
                    {pending.documents.map(doc => (
                        <li key={doc.id}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto w-full justify-start gap-3 px-2 py-1 text-left text-xs font-normal"
                                onClick={() => onOpenDocument(pending.label, doc.id)}
                            >
                                <span className="min-w-0 flex-1 truncate">{doc.label}</span>
                                {doc.date && <span className="shrink-0 text-muted-foreground tabular-nums">{formatPlainDate(doc.date)}</span>}
                                {doc.amount !== null && <MoneyDisplay amount={doc.amount} showColor={false} className="shrink-0 text-xs" />}
                            </Button>
                        </li>
                    ))}
                    {hidden > 0 && listUrl && (
                        <li className="px-2 py-1 text-xs">
                            <Link href={listUrl} className="text-primary underline-offset-2 hover:underline">
                                {`y ${hidden} más`}
                            </Link>
                        </li>
                    )}
                </ul>
            )}
        </li>
    )
}

function ChecklistSection({ title, items, critical, expanded, onToggle, onOpenDocument }: {
    title: string
    items: ChecklistItem[]
    critical: boolean
    expanded: ReadonlySet<string>
    onToggle: (key: string) => void
    onOpenDocument: (label: DocumentLabel, id: number) => void
}) {
    const id = `checklist-section-${title.toLowerCase()}`
    const done = items.filter(item => item.passed).length
    return (
        <section aria-labelledby={id}>
            <div className="flex items-baseline justify-between border-b border-border pb-1">
                <h3 id={id} className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
                <span className="text-2xs text-muted-foreground tabular-nums">{`${done} de ${items.length}`}</span>
            </div>
            <ul className="divide-y divide-border">
                {items.map(item => (
                    <ChecklistRow
                        key={item.key}
                        item={item}
                        critical={critical}
                        expanded={expanded.has(item.key)}
                        onToggle={() => onToggle(item.key)}
                        onOpenDocument={onOpenDocument}
                    />
                ))}
            </ul>
        </section>
    )
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
    const canClose = !!status && status.tax_period_closed && status.draft_entries_count === 0

    return (
        <>
            <BaseModal
                open={isOpen && !wizardTarget && !documentActive}
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
                            <ChecklistSection title="Obligatorios" items={items.required} critical expanded={expanded} onToggle={toggle} onOpenDocument={openEntity} />
                            <ChecklistSection title="Sugeridos" items={items.suggested} critical={false} expanded={expanded} onToggle={toggle} onOpenDocument={openEntity} />
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
