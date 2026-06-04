"use client"

import React, { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckSquare, AlertTriangle, ArrowDownToLine, CheckCheck, XCircle, Ban, CircleDollarSign, Clock, Ban as BanIcon } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell, StatCard,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton,
} from '@/components/shared'
import { useChecks, useCheckPortfolio, useCheckInTransit, useCheckMutations } from './hooks'
import { CheckRegisterDrawer } from './CheckRegisterDrawer'
import { CheckDepositModal } from './CheckDepositModal'
import { CheckEndorseModal } from './CheckEndorseModal'
import type { Check } from './types'

const ACTIONABLE_FROM: Record<string, string[]> = {
    deposit: ['IN_PORTFOLIO'],
    clear:   ['DEPOSITED'],
    bounce:  ['DEPOSITED'],
    void:    ['IN_PORTFOLIO', 'ISSUED'],
    mark_cashed: ['ISSUED'],
    endorse:  ['IN_PORTFOLIO'],
}

export function ChecksView({ bankId }: { bankId?: number } = {}) {
    const { data: checks = [], isLoading } = useChecks(
        bankId ? { bank: String(bankId) } : undefined,
    )
    const { data: portfolio } = useCheckPortfolio(
        bankId ? { bank: String(bankId) } : undefined,
    )
    const { data: inTransit } = useCheckInTransit(
        bankId ? { bank: String(bankId) } : undefined,
    )
    const { clear, bounce, void: voidCheck, markCashed } = useCheckMutations()

    const [registerOpen, setRegisterOpen] = useState(false)
    const [depositTarget, setDepositTarget] = useState<Check | null>(null)
    const [endorseTarget, setEndorseTarget] = useState<Check | null>(null)
    const [kpiFilter, setKpiFilter] = useState<string | null>(null)

    const canDo = (action: string, check: Check) =>
        ACTIONABLE_FROM[action]?.includes(check.status) ?? false

    const kpis = useMemo(() => {
        const portfolioTotal = portfolio ? parseFloat(portfolio.total) : 0
        const portfolioCount = portfolio ? portfolio.checks.length : 0
        const transitTotal = inTransit ? parseFloat(inTransit.total) : 0
        const transitCount = inTransit ? inTransit.checks.length : 0
        const issuedChecks = checks.filter(c => c.direction === 'ISSUED' && c.status === 'ISSUED')
        const issuedTotal = issuedChecks.reduce((s, c) => s + parseFloat(c.amount), 0)
        return { portfolioTotal, portfolioCount, transitTotal, transitCount, issuedTotal, issuedCount: issuedChecks.length }
    }, [portfolio, inTransit, checks])

    const filteredData = useMemo(() => {
        if (!kpiFilter) return checks
        return checks.filter(c => c.status === kpiFilter)
    }, [checks, kpiFilter])

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    const columns: ColumnDef<Check>[] = [
        {
            accessorKey: 'display_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title="N° Cheque" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <DataCell.Code>{row.original.display_id}</DataCell.Code>
                    <DataCell.Secondary>{row.original.check_number}</DataCell.Secondary>
                </div>
            ),
        },
        {
            accessorKey: 'direction',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => (
                <DataCell.Text>{row.original.direction === 'RECEIVED' ? 'Recibido' : 'Propio'}</DataCell.Text>
            ),
        },
        {
            accessorKey: 'bank_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Banco" />,
            cell: ({ row }) => <DataCell.Text>{row.original.bank_name}</DataCell.Text>,
        },
        {
            accessorKey: 'counterparty_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Girador" />,
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
                    {canDo('deposit', check) && (
                        <DataCell.Action icon={ArrowDownToLine} title="Depositar" onClick={() => setDepositTarget(check)} />
                    )}
                    {canDo('clear', check) && (
                        <DataCell.Action icon={CheckCheck} title="Marcar cobrado" onClick={() => clear(check.id)} />
                    )}
                    {canDo('bounce', check) && (
                        <DataCell.Action icon={XCircle} title="Protestar" onClick={() => bounce({ id: check.id })} />
                    )}
                    {canDo('mark_cashed', check) && (
                        <DataCell.Action icon={CheckCheck} title="Marcar cobrado por proveedor" onClick={() => markCashed(check.id)} />
                    )}
                    {canDo('endorse', check) && (
                        <DataCell.Action icon={ArrowDownToLine} title="Endosar" onClick={() => setEndorseTarget(check)} />
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                    label="Cheques Propios Girados"
                    value={<MoneyDisplay amount={kpis.issuedTotal} />}
                    subtext={`${kpis.issuedCount} cheques`}
                    icon={CheckSquare}
                    onClick={() => setKpiFilter(kpiFilter === 'ISSUED' ? null : 'ISSUED')}
                    active={kpiFilter === 'ISSUED'}
                />
                <StatCard
                    label="Protestados"
                    value={checks.filter(c => c.status === 'BOUNCED').length.toString()}
                    subtext="cheques"
                    icon={BanIcon}
                    onClick={() => setKpiFilter(kpiFilter === 'BOUNCED' ? null : 'BOUNCED')}
                    active={kpiFilter === 'BOUNCED'}
                />
            </div>

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.check"
                    columns={columns}
                    data={filteredData}
                    isLoading={isLoading}
                    variant="embedded"
                    createAction={
                        <button
                            onClick={() => setRegisterOpen(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <CheckSquare className="h-4 w-4" /> Registrar Cheque
                        </button>
                    }
                    emptyState={{
                        context: 'treasury',
                        title: 'Sin cheques',
                        description: 'Registra cheques recibidos o propios para gestionar su cobro.',
                    }}
                />
            </div>

            <CheckRegisterDrawer
                open={registerOpen}
                onOpenChange={setRegisterOpen}
            />

            {depositTarget && (
                <CheckDepositModal
                    check={depositTarget}
                    open={!!depositTarget}
                    onOpenChange={(open) => { if (!open) setDepositTarget(null) }}
                />
            )}

            {endorseTarget && (
                <CheckEndorseModal
                    check={endorseTarget}
                    open={!!endorseTarget}
                    onOpenChange={(open) => { if (!open) setEndorseTarget(null) }}
                />
            )}
        </div>
    )
}
