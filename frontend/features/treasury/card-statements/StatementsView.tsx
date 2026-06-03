"use client"

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, FileText, AlertTriangle, Calendar, Eye } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell, StatCard,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EmptyState,
} from '@/components/shared'
import { useCardStatements } from './hooks'
import { StatementDetailModal } from './StatementDetailModal'
import type { CreditCardStatement } from './types'

export function StatementsView() {
    const { data: statements = [], isLoading, isError } = useCardStatements()
    const [selectedId, setSelectedId] = useState<number | null>(null)

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

    if (isError) {
        return (
            <EmptyState
                title="Error al cargar estados de cuenta"
                description="Intente nuevamente más tarde."
                icon={AlertTriangle}
            />
        )
    }

    const totalDebt = statements
        .filter((s) => s.status === 'OPEN' || s.status === 'OVERDUE')
        .reduce((sum, s) => sum + parseFloat(s.total_to_pay), 0)
    const openCount = statements.filter((s) => s.status === 'OPEN').length
    const overdueCount = statements.filter((s) => s.status === 'OVERDUE').length
    const nextDue = statements
        .filter((s) => s.status === 'OPEN' || s.status === 'OVERDUE')
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0]

    const columns: ColumnDef<CreditCardStatement, unknown>[] = [
        {
            accessorKey: 'display_id',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center">
                    <DataCell.Code>{row.original.display_id}</DataCell.Code>
                    <DataCell.Secondary>{row.original.card_account_name}</DataCell.Secondary>
                </div>
            ),
        },
        {
            accessorKey: 'period',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Período" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {String(row.original.period_month).padStart(2, '0')}/{row.original.period_year}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: 'billed_amount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Facturado" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={parseFloat(row.original.billed_amount)} />
                </div>
            ),
        },
        {
            accessorKey: 'total_to_pay',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total a Pagar" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay
                        amount={parseFloat(row.original.total_to_pay)}
                        className="font-bold"
                    />
                </div>
            ),
        },
        {
            accessorKey: 'due_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Vencimiento" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {new Date(row.original.due_date).toLocaleDateString('es-CL')}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        createActionsColumn<CreditCardStatement>({
            renderActions: (stmt) => (
                <DataCell.Action
                    icon={Eye}
                    title="Ver detalle"
                    onClick={() => setSelectedId(stmt.id)}
                />
            ),
        }),
    ]

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    label="Deuda Total Tarjeta"
                    value={<MoneyDisplay amount={totalDebt} inline />}
                    icon={CreditCard}
                    accent="warning"
                />
                <StatCard
                    label="Estados Abiertos"
                    value={openCount.toString()}
                    icon={FileText}
                    accent="primary"
                />
                <StatCard
                    label="Vencidos"
                    value={overdueCount.toString()}
                    icon={AlertTriangle}
                    accent={overdueCount > 0 ? 'destructive' : 'success'}
                />
                <StatCard
                    label="Próx. Vencimiento"
                    value={nextDue
                        ? new Date(nextDue.due_date).toLocaleDateString('es-CL')
                        : '—'}
                    icon={Calendar}
                    accent="info"
                />
            </div>

            {statements.length === 0 ? (
                <EmptyState
                    title="No hay estados de cuenta"
                    description="Los estados de cuenta de la tarjeta de crédito aparecerán aquí."
                    icon={CreditCard}
                />
            ) : (
                <DataTableView
                    entityLabel="treasury.creditcardstatement"
                    columns={columns as ColumnDef<unknown, unknown>[]}
                    data={statements as unknown[]}
                    variant="embedded"
                />
            )}

            <StatementDetailModal
                statementId={selectedId}
                open={selectedId != null}
                onOpenChange={(open) => { if (!open) setSelectedId(null) }}
            />
        </div>
    )
}
