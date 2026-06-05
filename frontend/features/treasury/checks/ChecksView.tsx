"use client"

import React, { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, ArrowDownToLine, CheckCheck, XCircle, Ban } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EntityCard,
} from '@/components/shared'
import { useChecks, useCheckMutations } from './hooks'
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

    const { clear, bounce, void: voidCheck, markCashed } = useCheckMutations()

    const [depositTarget, setDepositTarget] = useState<Check | null>(null)

    const canDo = (action: string, check: Check) =>
        ACTIONABLE_FROM[action]?.includes(check.status) ?? false

    if (isLoading) {
        return <Skeleton className="h-full" />
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
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.check"
                    columns={columns}
                    data={checks}
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
