"use client"

import React, { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, ArrowDownToLine, CheckCheck, XCircle, Ban, CircleDollarSign, Clock, Ban as BanIcon, FileCheck } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell, StatCard,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EntityCard,
} from '@/components/shared'
import { useChecks, useCheckPortfolio, useCheckInTransit, useCheckMutations } from './hooks'
import { CheckDepositModal } from './CheckDepositModal'
import type { Check, CheckDirection } from './types'

const ACTIONABLE_FROM: Record<string, string[]> = {
    deposit:     ['IN_PORTFOLIO'],
    clear:       ['DEPOSITED'],
    bounce:      ['DEPOSITED'],
    void:        ['IN_PORTFOLIO', 'ISSUED'],
    mark_cashed: ['ISSUED'],
}

interface ChecksViewProps {
    bankId?: number
    direction?: CheckDirection
}

export function ChecksView({ bankId, direction }: ChecksViewProps = {}) {
    const queryParams = useMemo(() => {
        const p: Record<string, string> = {}
        if (bankId) p.bank = String(bankId)
        if (direction) p.direction = direction
        return Object.keys(p).length ? p : undefined
    }, [bankId, direction])

    const { data: checks = [], isLoading } = useChecks(queryParams)

    // Portfolio / in-transit summaries only apply to received checks.
    const receivedParams = bankId ? { bank: String(bankId) } : undefined
    const { data: portfolio } = useCheckPortfolio(receivedParams, direction !== 'ISSUED')
    const { data: inTransit } = useCheckInTransit(receivedParams, direction !== 'ISSUED')

    const { clear, bounce, void: voidCheck, markCashed } = useCheckMutations()

    const [depositTarget, setDepositTarget] = useState<Check | null>(null)
    const [kpiFilter, setKpiFilter] = useState<string | null>(null)

    const canDo = (action: string, check: Check) =>
        ACTIONABLE_FROM[action]?.includes(check.status) ?? false

    const kpis = useMemo(() => {
        const portfolioTotal = portfolio ? parseFloat(portfolio.total) : 0
        const portfolioCount = portfolio ? portfolio.checks.length : 0
        const transitTotal = inTransit ? parseFloat(inTransit.total) : 0
        const transitCount = inTransit ? inTransit.checks.length : 0
        const pendingIssued = checks.filter(c => c.status === 'ISSUED')
        const pendingIssuedTotal = pendingIssued.reduce((s, c) => s + parseFloat(c.amount), 0)
        const bouncedCount = checks.filter(c => c.status === 'BOUNCED').length
        return { portfolioTotal, portfolioCount, transitTotal, transitCount, pendingIssuedTotal, pendingIssuedCount: pendingIssued.length, bouncedCount }
    }, [portfolio, inTransit, checks])

    const filteredData = useMemo(() => {
        if (!kpiFilter) return checks
        return checks.filter(c => c.status === kpiFilter)
    }, [checks, kpiFilter])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    const isIssued = direction === 'ISSUED'

    const columns: ColumnDef<Check>[] = [
        {
            accessorKey: 'check_number',
            header: ({ column }) => <DataTableColumnHeader column={column} title="N° Cheque" />,
            cell: ({ row }) => (
                <DataCell.Code>{row.original.check_number}</DataCell.Code>
            ),
        },
        {
            accessorKey: 'bank_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Banco" />,
            cell: ({ row }) => <DataCell.Text>{row.original.bank_name}</DataCell.Text>,
        },
        {
            accessorKey: 'counterparty_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title={isIssued ? 'Beneficiario' : 'Girador'} />,
            cell: ({ row }) => (
                <DataCell.Text>{row.original.counterparty_name ?? row.original.drawer_name ?? '—'}</DataCell.Text>
            ),
        },
        {
            accessorKey: 'amount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={parseFloat(row.original.amount)} className="font-bold" />
                </div>
            ),
        },
        {
            accessorKey: 'due_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Vencimiento" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5">
                    <DataCell.Text>{row.original.due_date}</DataCell.Text>
                    {row.original.is_overdue && (
                        <span className="flex items-center gap-1 text-[11px] text-destructive font-bold">
                            <AlertTriangle className="h-3 w-3" /> Vencido
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        createActionsColumn<Check>({
            renderActions: (check) => (
                <>
                    {!isIssued && canDo('deposit', check) && (
                        <DataCell.Action icon={ArrowDownToLine} title="Depositar" onClick={() => setDepositTarget(check)} />
                    )}
                    {!isIssued && canDo('clear', check) && (
                        <DataCell.Action icon={CheckCheck} title="Marcar cobrado" onClick={() => clear(check.id)} />
                    )}
                    {!isIssued && canDo('bounce', check) && (
                        <DataCell.Action icon={XCircle} title="Protestar" onClick={() => bounce({ id: check.id })} />
                    )}
                    {isIssued && canDo('mark_cashed', check) && (
                        <DataCell.Action icon={CheckCheck} title="Marcar cobrado por banco" onClick={() => markCashed(check.id)} />
                    )}
                    {canDo('void', check) && (
                        <DataCell.Action icon={Ban} title="Anular" onClick={() => voidCheck({ id: check.id })} />
                    )}
                </>
            ),
        }),
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {!isIssued && (
                    <>
                        <StatCard
                            label="En Cartera"
                            value={<MoneyDisplay amount={kpis.portfolioTotal} />}
                            subtext={`${kpis.portfolioCount} cheques`}
                            icon={CircleDollarSign}
                            onClick={() => setKpiFilter(kpiFilter === 'IN_PORTFOLIO' ? null : 'IN_PORTFOLIO')}
                            active={kpiFilter === 'IN_PORTFOLIO'}
                        />
                        <StatCard
                            label="Depósitos en Tránsito"
                            value={<MoneyDisplay amount={kpis.transitTotal} />}
                            subtext={`${kpis.transitCount} cheques`}
                            icon={Clock}
                            onClick={() => setKpiFilter(kpiFilter === 'DEPOSITED' ? null : 'DEPOSITED')}
                            active={kpiFilter === 'DEPOSITED'}
                        />
                        <StatCard
                            label="Protestados"
                            value={kpis.bouncedCount.toString()}
                            subtext="cheques"
                            icon={BanIcon}
                            onClick={() => setKpiFilter(kpiFilter === 'BOUNCED' ? null : 'BOUNCED')}
                            active={kpiFilter === 'BOUNCED'}
                        />
                    </>
                )}
                {isIssued && (
                    <>
                        <StatCard
                            label="Pendientes de Cobro"
                            value={<MoneyDisplay amount={kpis.pendingIssuedTotal} />}
                            subtext={`${kpis.pendingIssuedCount} cheques`}
                            icon={FileCheck}
                            onClick={() => setKpiFilter(kpiFilter === 'ISSUED' ? null : 'ISSUED')}
                            active={kpiFilter === 'ISSUED'}
                        />
                        <StatCard
                            label="Vencidos"
                            value={checks.filter(c => c.is_overdue && c.status === 'ISSUED').length.toString()}
                            subtext="cheques"
                            icon={AlertTriangle}
                            onClick={() => setKpiFilter(kpiFilter === 'ISSUED' ? null : 'ISSUED')}
                            active={false}
                        />
                        <StatCard
                            label="Anulados"
                            value={checks.filter(c => c.status === 'VOIDED').length.toString()}
                            subtext="cheques"
                            icon={BanIcon}
                            onClick={() => setKpiFilter(kpiFilter === 'VOIDED' ? null : 'VOIDED')}
                            active={kpiFilter === 'VOIDED'}
                        />
                    </>
                )}
            </div>

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.check"
                    columns={columns}
                    data={filteredData}
                    isLoading={isLoading}
                    variant="embedded"
                    emptyState={
                        isIssued
                            ? { context: 'treasury', title: 'Sin cheques girados', description: 'Los cheques propios emitidos en compras aparecerán aquí.' }
                            : { context: 'treasury', title: 'Sin cheques en cartera', description: 'Los cheques recibidos en ventas o registro de pagos aparecerán aquí.' }
                    }
                    renderCard={(check: Check) => (
                        <EntityCard>
                            <EntityCard.Header
                                title={check.check_number}
                                trailing={<StatusBadge status={check.status} />}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field
                                    label={isIssued ? 'Beneficiario' : 'Girador'}
                                    value={check.counterparty_name ?? check.drawer_name ?? '—'}
                                />
                                <EntityCard.Field
                                    label="Monto"
                                    value={<MoneyDisplay amount={parseFloat(check.amount)} className="font-bold" />}
                                />
                                <EntityCard.Field
                                    label="Vencimiento"
                                    value={
                                        <span className="inline-flex items-center gap-1.5">
                                            <span>{check.due_date}</span>
                                            {check.is_overdue && (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-destructive uppercase">
                                                    <AlertTriangle className="h-3 w-3" /> Vencido
                                                </span>
                                            )}
                                        </span>
                                    }
                                />
                            </EntityCard.Body>
                            <EntityCard.Footer>
                                {!isIssued && canDo('deposit', check) && (
                                    <DataCell.Action icon={ArrowDownToLine} title="Depositar" onClick={() => setDepositTarget(check)} />
                                )}
                                {!isIssued && canDo('clear', check) && (
                                    <DataCell.Action icon={CheckCheck} title="Marcar cobrado" onClick={() => clear(check.id)} />
                                )}
                                {!isIssued && canDo('bounce', check) && (
                                    <DataCell.Action icon={XCircle} title="Protestar" onClick={() => bounce({ id: check.id })} />
                                )}
                                {isIssued && canDo('mark_cashed', check) && (
                                    <DataCell.Action icon={CheckCheck} title="Marcar cobrado por banco" onClick={() => markCashed(check.id)} />
                                )}
                                {canDo('void', check) && (
                                    <DataCell.Action icon={Ban} title="Anular" onClick={() => voidCheck({ id: check.id })} />
                                )}
                            </EntityCard.Footer>
                        </EntityCard>
                    )}
                />
            </div>

            {depositTarget && (
                <CheckDepositModal
                    check={depositTarget}
                    open={!!depositTarget}
                    onOpenChange={(open) => { if (!open) setDepositTarget(null) }}
                />
            )}
        </div>
    )
}
