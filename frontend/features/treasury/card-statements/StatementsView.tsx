"use client"

import { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, AlertTriangle, Eye, BarChart3, DollarSign, Calendar } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    createActionsColumn, StatusBadge, MoneyDisplay, Skeleton, EmptyState, EntityCard,
    SmartSearchBar,
    useSmartSearch,
    UnderlineTabs,
    StatCard,
} from '@/components/shared'
import type { SearchDefinition } from '@/types/search'
import { useCardStatements } from './hooks'
import { StatementDetailModal } from './StatementDetailModal'
import type { CreditCardStatement } from './types'

interface StatementsViewProps {
    bankId?: number
    creditCardAccounts: Array<{ id: number; name: string; currency: string }>
}

export function StatementsView({ bankId, creditCardAccounts }: StatementsViewProps = { creditCardAccounts: [] }) {
    const [selectedId, setSelectedId] = useState<number | null>(null)

    const searchDef: SearchDefinition = useMemo(() => ({
        fields: [
            {
                key: 'card',
                label: 'Tarjeta',
                type: 'enum',
                serverParam: 'card',
                defaultValue: String(creditCardAccounts[0]?.id ?? ''),
                options: creditCardAccounts.map(a => ({ label: a.name, value: String(a.id) })),
            },
        ],
    }), [creditCardAccounts])

    const { filters, applyFilter } = useSmartSearch(searchDef)

    const cardAccountId = filters.card ? Number(filters.card) : (creditCardAccounts[0]?.id ?? null)

    const params: Record<string, string> = {}
    if (bankId) params.bank = String(bankId)
    if (cardAccountId) params.card_account = String(cardAccountId)
    const { data: statements = [], isLoading, isError } = useCardStatements(
        Object.keys(params).length > 0 ? params : undefined,
    )

    const totalDebt = useMemo(() => statements
        .filter((s) => s.status === 'OPEN' || s.status === 'OVERDUE')
        .reduce((sum, s) => sum + parseFloat(s.total_to_pay), 0),
    [statements])

    const openCount = useMemo(() => statements.filter((s) => s.status === 'OPEN').length, [statements])
    const overdueCount = useMemo(() => statements.filter((s) => s.status === 'OVERDUE').length, [statements])
    const nextDue = useMemo(() => statements
        .filter((s) => s.status === 'OPEN' || s.status === 'OVERDUE')
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0],
    [statements])

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
                    statsAction={{
                        icon: BarChart3,
                        sheet: {
                            title: "Estadísticas de Estados de Cuenta",
                            description: "Resumen de cargos facturados",
                            panels: [
                                {
                                    id: 'resumen',
                                    title: 'Resumen',
                                    colSpan: 3 as const,
                                    content: {
                                        type: 'custom',
                                        render: (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <StatCard label="Deuda Total" value={<MoneyDisplay amount={totalDebt} inline />} icon={DollarSign} accent="warning" />
                                                <StatCard label="Abiertos" value={String(openCount)} icon={BarChart3} accent="primary" />
                                                <StatCard label="Vencidos" value={String(overdueCount)} icon={AlertTriangle} accent={overdueCount > 0 ? 'destructive' : 'success'} />
                                                <StatCard label="Próx. Vencimiento" value={nextDue ? new Date(nextDue.due_date).toLocaleDateString('es-CL') : '—'} icon={Calendar} accent="info" />
                                            </div>
                                        ),
                                    },
                                },
                            ],
                        },
                    }}
                    leftAction={
                        <div className="flex items-center gap-1 w-full">
                            {creditCardAccounts.length > 1 && (
                                <UnderlineTabs
                                    items={creditCardAccounts.map(a => ({ value: String(a.id), label: a.name }))}
                                    value={String(filters.card ?? creditCardAccounts[0]?.id ?? '')}
                                    onValueChange={(v) => applyFilter('card', v)}
                                    orientation="horizontal"
                                    variant="underline"
                                    className="w-auto shrink-0"
                                    headerClassName="h-9 px-0 bg-transparent"
                                    contentClassName="hidden"
                                >
                                    <div />
                                </UnderlineTabs>
                            )}
                            <SmartSearchBar searchDef={searchDef} placeholder="Buscar estados de cuenta..." className="flex-1" />
                        </div>
                    }
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
