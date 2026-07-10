"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    StatusBadge, MoneyDisplay, Skeleton, EmptyState,
    ToolbarCreateButton,
    UnifiedSearchBar, useUnifiedSearch,
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { Button } from '@/components/ui/button'
import { useCreditLines, useCreditLineMutations } from '../hooks/useCreditLines'
import { CreditLineDrawer } from './CreditLineDrawer'
import type { CreditLine } from './types'
import type { TreasuryAccount } from '../types'
import { treasuryApi } from '@/features/treasury'

interface Props {
    bankId?: number
}

export function CreditLinesClientView({ bankId }: Props) {
    const { data: creditLines, isLoading, isError } = useCreditLines({ bank_id: bankId })
    const { remove } = useCreditLineMutations()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingLine, setEditingLine] = useState<CreditLine | null>(null)
    const [bankCheckingAccounts, setBankCheckingAccounts] = useState<TreasuryAccount[]>([])

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Código / Cuenta / Límite', serverParam: 'search', clientKey: ['code', 'account_name', 'credit_limit'] },
        ],
        groupBy: [
            { key: 'status', label: 'Estado', field: 'status' },
        ],
    }), [])
    const search = useUnifiedSearch(config)
    const filteredData = useMemo(() => search.filterFn(creditLines ?? []), [search.filterFn, creditLines])

    useEffect(() => {
        if (bankId && !editingLine) {
            treasuryApi.getAccounts({ account_type: 'CHECKING', bank_id: bankId }).then(setBankCheckingAccounts).catch(() => {})
        }
    }, [bankId, editingLine])

    const handleNewLine = () => {
        setEditingLine(null)
        setDrawerOpen(true)
    }



    if (isLoading) {
        return <Skeleton className="h-full" />
    }

    if (isError) {
        return (
            <EmptyState
                title="Error al cargar líneas de crédito"
                description="Intente nuevamente más tarde."
                icon={AlertTriangle}
            />
        )
    }

    const columns: ColumnDef<CreditLine>[] = [
        {
            accessorKey: 'code',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
            cell: ({ row }) => <DataCell.Code>{row.original.code || '—'}</DataCell.Code>,
        },
        {
            accessorKey: 'account_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cuenta" />,
            cell: ({ row }) => <DataCell.Text>{row.original.account_name}</DataCell.Text>,
        },
        {
            accessorKey: 'credit_limit',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Límite" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={Number(row.original.credit_limit)} />
                </div>
            ),
        },
        {
            accessorKey: 'used_amount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Utilizado" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={Number(row.original.used_amount)} />
                </div>
            ),
        },
        {
            accessorKey: 'available_amount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Disponible" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={Number(row.original.available_amount)} />
                </div>
            ),
        },
        {
            accessorKey: 'utilization_rate',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Uso %" className="justify-end" />,
            cell: ({ row }) => {
                const rate = row.original.utilization_rate
                if (rate === null) return <DataCell.Text>—</DataCell.Text>
                return (
                    <div className="flex justify-end">
                        <DataCell.Text>{Number(rate).toFixed(1)}%</DataCell.Text>
                    </div>
                )
            },
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingLine(row.original); setDrawerOpen(true) }}>
                        Editar
                    </Button>
                    {row.original.status === 'ACTIVE' && (
                        <Button variant="ghost" size="sm" onClick={() => remove.mutate(row.original.id)}>
                            Archivar
                        </Button>
                    )}
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <DataTableView
                columns={columns}
                data={filteredData}
                entityLabel="treasury.creditline"
                createAction={
                    <ToolbarCreateButton
                        label="Nueva Línea"
                        onClick={handleNewLine}
                    />
                }
                isFiltered={search.isFiltered}
                showReset={search.isFiltered}
                onReset={search.clearAll}
                unifiedSearch={<UnifiedSearchBar
                    config={config}
                    chips={search.chips}
                    isFiltered={search.isFiltered}
                    inputValue={search.inputValue}
                    onInputChange={search.setInputValue}
                    onApply={search.applyFilter}
                    onRemove={search.removeFilter}
                    onClearAll={search.clearAll}
                    groupBy={search.groupBy}
                    onGroupBySelect={search.setGroupBy}
                    paramValues={search.paramValues}
                    placeholder="Buscar por código, cuenta o límite..."
                />}
            />

            <CreditLineDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                creditLine={editingLine}
                treasuryAccountId={
                    !editingLine && bankCheckingAccounts.length === 1
                        ? bankCheckingAccounts[0].id
                        : undefined
                }
            />

        </div>
    )
}
