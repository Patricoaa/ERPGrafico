"use client"

import React, { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { CheckSquare, AlertTriangle, ArrowDownToLine, CheckCheck, XCircle, Ban } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay,
} from '@/components/shared'
import { useChecks, useCheckMutations } from './hooks'
import { CheckRegisterDrawer } from './CheckRegisterDrawer'
import { CheckDepositModal } from './CheckDepositModal'
import type { Check } from './types'

const ACTIONABLE_FROM: Record<string, string[]> = {
    deposit: ['IN_PORTFOLIO'],
    clear:   ['DEPOSITED'],
    bounce:  ['DEPOSITED'],
    void:    ['IN_PORTFOLIO'],
}

export function ChecksView() {
    const { data: checks = [], isLoading } = useChecks()
    const { deposit, clear, bounce, void: voidCheck } = useCheckMutations()

    const [registerOpen, setRegisterOpen] = useState(false)
    const [depositTarget, setDepositTarget] = useState<Check | null>(null)

    const canDo = (action: string, check: Check) =>
        ACTIONABLE_FROM[action]?.includes(check.status) ?? false

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
                    {canDo('void', check) && (
                        <DataCell.Action icon={Ban} title="Anular" onClick={() => voidCheck({ id: check.id })} />
                    )}
                </>
            ),
        }),
    ]

    return (
        <>
            <DataTableView
                entityLabel="treasury.check"
                columns={columns}
                data={checks}
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
                    title: 'Sin cheques en cartera',
                    description: 'Registra cheques recibidos de clientes para gestionar su cobro.',
                }}
            />

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
        </>
    )
}
