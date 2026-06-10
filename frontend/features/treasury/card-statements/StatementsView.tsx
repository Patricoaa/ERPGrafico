"use client"

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, AlertTriangle, Eye } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EmptyState, EntityCard,
} from '@/components/shared'
import { useCardStatements } from './hooks'
import { StatementDetailModal } from './StatementDetailModal'
import type { CreditCardStatement } from './types'

interface StatementsViewProps {
    bankId?: number
    cardAccountId?: number | null
}

export function StatementsView({ bankId, cardAccountId }: StatementsViewProps = {}) {
    const params: Record<string, string> = {}
    if (bankId) params.bank = String(bankId)
    if (cardAccountId) params.card_account = String(cardAccountId)
    const { data: statements = [], isLoading, isError } = useCardStatements(
        Object.keys(params).length > 0 ? params : undefined,
    )
    const [selectedId, setSelectedId] = useState<number | null>(null)

    if (isLoading) {
        return <Skeleton className="h-full" />
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

    const columns: ColumnDef<CreditCardStatement>[] = [
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
            renderActions: (stmt) => renderStatementActions(stmt),
        }),
    ]

    function renderStatementActions(stmt: CreditCardStatement) {
        return (
            <DataCell.Action
                icon={Eye}
                title="Ver detalle"
                onClick={() => setSelectedId(stmt.id)}
            />
        )
    }

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.creditcardstatement"
                    columns={columns}
                    data={statements}
                    variant="embedded"
                    filterColumn="display_id"
                    searchPlaceholder="Buscar por estado de cuenta..."
                    emptyState={{
                        context: 'treasury',
                        icon: CreditCard,
                        title: 'No hay estados de cuenta',
                        description: 'Los estados de cuenta de la tarjeta de crédito aparecerán aquí.',
                    }}
                    renderCard={(stmt: CreditCardStatement) => (
                        <EntityCard>
                            <EntityCard.Header
                                title={stmt.display_id}
                                subtitle={stmt.card_account_name}
                                trailing={<StatusBadge status={stmt.status} />}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field
                                    label="Período"
                                    value={`${String(stmt.period_month).padStart(2, '0')}/${stmt.period_year}`}
                                />
                                <EntityCard.Field
                                    label="Facturado"
                                    value={<MoneyDisplay amount={parseFloat(stmt.billed_amount)} />}
                                />
                                <EntityCard.Field
                                    label="Total a Pagar"
                                    value={<MoneyDisplay amount={parseFloat(stmt.total_to_pay)} className="font-bold" />}
                                />
                                <EntityCard.Field
                                    label="Vencimiento"
                                    value={new Date(stmt.due_date).toLocaleDateString('es-CL')}
                                />
                            </EntityCard.Body>
                            <EntityCard.Footer>
                                {renderStatementActions(stmt)}
                            </EntityCard.Footer>
                        </EntityCard>
                    )}
                />
            </div>

            <StatementDetailModal
                statementId={selectedId}
                open={selectedId != null}
                onOpenChange={(open) => { if (!open) setSelectedId(null) }}
            />
        </div>
    )
}
