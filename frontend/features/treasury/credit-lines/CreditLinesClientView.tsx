"use client"

import React, {useState, useEffect, useMemo} from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
    DataTableView, SkeletonShell,
    ToolbarCreateButton,
    UnifiedSearchBar, useUnifiedSearch, StaleDataBanner,
    AutoEntityCard
} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { Button } from '@/components/ui/button'
import { useCreditLines, useCreditLineMutations } from '../hooks/useCreditLines'
import { CreditLineDrawer } from './CreditLineDrawer'
import type { CreditLine } from './types'
import type { TreasuryAccount } from '../types'
import { treasuryApi } from '@/features/treasury'
import { creditLineFields } from './creditLineFields'

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

    const columns: ColumnDef<CreditLine>[] = [
        ...creditLineFields.toColumns(),
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
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando líneas de crédito">
        {isError && <StaleDataBanner className="mx-4 mt-2" />}
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
                renderCard={(line) => (
                    <AutoEntityCard 
                        key={line.id}
                        data={line}
                        fields={creditLineFields}

                        entityLabel="treasury.creditline"
                    >
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/50">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingLine(line); setDrawerOpen(true) }}>
                                Editar
                            </Button>
                            {line.status === 'ACTIVE' && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); remove.mutate(line.id) }}>
                                    Archivar
                                </Button>
                            )}
                        </div>
                    </AutoEntityCard>
                )}
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
        </SkeletonShell>
    )
}
