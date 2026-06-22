"use client"

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, AlertTriangle } from 'lucide-react'
import {
    DataTableView, DataTableColumnHeader, DataCell,
    StatusBadge, MoneyDisplay, Skeleton, EmptyState,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useCreditLines, useCreditLineMutations } from './hooks'
import { CreditLineDrawer } from './CreditLineDrawer'
import type { CreditLine } from './types'

interface Props {
    bankId?: number
}

export function CreditLinesClientView({ bankId }: Props) {
    const { data: creditLines, isLoading, isError } = useCreditLines({ bank_id: bankId })
    const { remove } = useCreditLineMutations()
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingLine, setEditingLine] = useState<CreditLine | null>(null)

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
            accessorKey: 'bank_name',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Banco" />,
            cell: ({ row }) => <DataCell.Text>{row.original.bank_name}</DataCell.Text>,
        },
        {
            accessorKey: 'approved_amount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto Aprobado" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={Number(row.original.approved_amount)} />
                </div>
            ),
        },
        {
            accessorKey: 'drawn_amount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Utilizado" className="justify-end" />,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={Number(row.original.drawn_amount)} />
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
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Líneas de Crédito</h2>
                <Button onClick={() => { setEditingLine(null); setDrawerOpen(true) }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Línea
                </Button>
            </div>

            <DataTableView
                columns={columns}
                data={creditLines ?? []}
                entityLabel="treasury.creditline"
            />

            <CreditLineDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                creditLine={editingLine}
                bankId={bankId}
            />

        </div>
    )
}
