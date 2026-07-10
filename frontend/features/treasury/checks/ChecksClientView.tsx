"use client"

import React, { useMemo, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    StatusBadge, MoneyDisplay, Skeleton, EntityCard,
    UnifiedSearchBar, useUnifiedSearch,
} from '@/components/shared'
import type { UnifiedSearchConfig, MultiSelectOption } from '@/types/unified-search'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { useChecks, useCheckMutations } from '../hooks/useChecks'
import { CheckDepositModal } from './CheckDepositModal'
import { checkActions, type CheckActionsCtx } from './checkActions'
import { useBanks } from '@/features/treasury'
import type { Check, CheckDirection } from './types'

const ACTIONABLE_FROM: Record<string, string[]> = {
    deposit:     ['IN_PORTFOLIO'],
    clear:       ['DEPOSITED'],
    bounce:      ['DEPOSITED'],
    void:        ['IN_PORTFOLIO', 'ISSUED'],
    mark_cashed: ['ISSUED'],
}

interface ChecksClientViewProps {
    bankId?: number
    direction?: CheckDirection
}

export function ChecksClientView({ bankId, direction }: ChecksClientViewProps = {}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { openEntity } = useGlobalModals()

    const { banks } = useBanks()

    const filterOptions: Record<string, MultiSelectOption[]> = useMemo(() => ({
        bank: banks.map((b) => ({ label: b.name, value: String(b.id) })),
    }), [banks])

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'N° Cheque / Girador / Monto', serverParam: 'search' },
        ],
        filters: [
            { key: 'bank', label: 'Banco', type: 'single', serverParam: 'bank', dynamic: true },
            { key: 'status', label: 'Estado', type: 'single', serverParam: 'status', options: [
                { label: 'En Cartera', value: 'IN_PORTFOLIO' },
                { label: 'Depositado', value: 'DEPOSITED' },
                { label: 'Cobrado', value: 'CLEARED' },
                { label: 'Protestado', value: 'BOUNCED' },
                { label: 'Anulado', value: 'VOIDED' },
            ]},
        ],
        dateFilters: [{
            key: 'due_date',
            label: 'Vencimiento',
            type: 'date',
            options: [
                { label: 'Personalizado', value: 'custom', serverParamFrom: 'due_date_after', serverParamTo: 'due_date_before' },
            ],
        }],
    }), [])
    const search = useUnifiedSearch(config, filterOptions)

    const queryParams = useMemo(() => {
        const p: Record<string, string> = { ...search.filters }
        if (bankId && !p.bank) p.bank = String(bankId)
        if (direction) p.direction = direction
        return Object.keys(p).length ? p : undefined
    }, [search.filters, bankId, direction])

    const { checks = [], isLoading } = useChecks(queryParams)

    const { clear, bounce, void: voidCheck, markCashed } = useCheckMutations()

    const selectedId = searchParams.get("selected") ? Number(searchParams.get("selected")) : null
    const action = searchParams.get("action")
    const isDepositOpen = !!selectedId && action === "deposit"

    const depositCheck = useMemo(
        () => isDepositOpen ? checks.find(c => c.id === selectedId) ?? null : null,
        [selectedId, isDepositOpen, checks],
    )

    const clearModalParams = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        const changed = params.has("selected") || params.has("action")
        params.delete("selected")
        params.delete("action")
        if (changed) {
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [router, pathname, searchParams])

    const isFiltered = search.isFiltered

    const handleViewDetail = useCallback(
        (id: number) => {
            const check = checks.find((c) => c.id === id)
            if (check) openEntity('treasury.check', id, check)
        },
        [checks, openEntity],
    )

    const handleReset = useCallback(() => {
        search.clearAll()
    }, [search.clearAll])

    const canDo = (action: string, check: Check) =>
        ACTIONABLE_FROM[action]?.includes(check.status) ?? false

    if (isLoading) {
        return <Skeleton className="h-full" />
    }

    const isIssued = direction === 'ISSUED'

    const actionsCtx: CheckActionsCtx = {
        isIssued,
        canDo,
        onViewDetail: handleViewDetail,
        onDeposit: (check) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("selected", String(check.id))
            params.set("action", "deposit")
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
        onClear: (id) => clear(id),
        onBounce: (id) => bounce({ id }),
        onMarkCashed: (id) => markCashed(id),
        onVoid: (id) => voidCheck({ id }),
    }

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
            id: 'sale_order',
            accessorFn: (row) => row.sale_order_display?.number ?? null,
            header: ({ column }) => <DataTableColumnHeader column={column} title="NV Asociada" className="justify-center" />,
            cell: ({ row }) => {
                const so = row.original.sale_order_display
                if (!so) return null
                return (
                    <div className="flex justify-center">
                        <DataCell.Entity entityLabel="sales.saleorder" number={so.number} />
                    </div>
                )
            },
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
        checkActions.column(actionsCtx),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
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
                        filterOptions={search.filterOptions}
                        placeholder="Buscar por N° cheque, girador o monto..."
                    />}
                    isFiltered={isFiltered}
                    showReset={isFiltered}
                    onReset={handleReset}
                    renderCard={(check: Check) => (
                        <EntityCard>
                            <EntityCard.Header
                                title={check.check_number}
                                trailing={<StatusBadge status={check.status} />}
                            />
                            <EntityCard.Body actions={checkActions.render(check, actionsCtx)}>
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
                        </EntityCard>
                    )}
                />
            </div>

            {depositCheck && (
                <CheckDepositModal
                    check={depositCheck}
                    open={isDepositOpen}
                    onOpenChange={(open) => { if (!open) clearModalParams() }}
                />
            )}
        </div>
    )
}
