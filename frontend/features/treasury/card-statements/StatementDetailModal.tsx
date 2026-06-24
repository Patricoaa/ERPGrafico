"use client"

import React, { useMemo, useState } from 'react'
import { CheckCircle, XCircle, ShoppingCart } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import {
    BaseModal, MoneyDisplay, StatusBadge, SkeletonShell,
    DataTableView, DataTableColumnHeader, DataCell,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useCardStatement, useStatementCharges, useCardStatementMutations } from './hooks'
import { PayStatementModal } from './PayStatementModal'
import { mapToStatementChargeRows } from './utils'
import { parseDateOnly } from '@/lib/utils'
import type { StatementChargeRow } from './types'

interface StatementDetailModalProps {
    statementId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function StatementDetailModal({ statementId, open, onOpenChange }: StatementDetailModalProps) {
    const { data: stmt, isLoading } = useCardStatement(statementId)
    const { data: chargesResponse, isLoading: chargesLoading } = useStatementCharges(statementId)
    const { cancel, isCanceling } = useCardStatementMutations()
    const [payOpen, setPayOpen] = useState(false)

    const movements = chargesResponse?.movements ?? []
    const installments = chargesResponse?.installments ?? []
    const pendingCharges = chargesResponse?.pending_charges ?? []

    const mergedRows = useMemo(
        () => mapToStatementChargeRows(movements, installments, pendingCharges),
        [movements, installments, pendingCharges],
    )

    if (!open || !statementId) return null

    const handleCancel = async () => {
        if (!stmt) return
        if (window.confirm('¿Anular este estado de cuenta? Los cargos volverán a aparecer como no facturados.')) {
            await cancel({ id: stmt.id, notes: 'Anulado desde la UI' })
        }
    }

    const chargesColumns: ColumnDef<StatementChargeRow, any>[] = [
        {
            accessorKey: 'date',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.Date value={row.original.date} />
                </div>
            ),
            sortingFn: 'datetime',
        },
        {
            id: 'descripcion',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" />
            ),
            cell: ({ row }) => {
                const item = row.original
                const group = item.purchaseGroupDetail
                const inst = item.originalInstallment
                return (
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="text-xs font-medium">
                            {item.source === 'installment'
                                ? `Cuota #${item.installmentNumber} de ${item.totalInstallments}${inst?.partner_name ? ` — ${inst.partner_name}` : ''}`
                                : item.source === 'pending'
                                    ? `${item.movementTypeDisplay || 'Cargo'}${item.reference ? `: ${item.reference}` : ''}`
                                    : item.reference
                                        ? item.reference
                                        : item.movementTypeDisplay || `Movimiento #${item.originalMovement?.id}`}
                        </span>
                        {item.source === 'installment' && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">
                                {[inst?.purchase_order_display_id, item.reference].filter(Boolean).join(' — ') || inst?.partner_name}
                            </span>
                        )}
                        {item.source === 'pending' && item.date && (
                            <span className="text-[10px] text-muted-foreground">
                                {parseDateOnly(item.date).toLocaleDateString('es-CL', { year: 'numeric', month: 'long' })}
                            </span>
                        )}
                        {item.source === 'movement' && item.notes && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {item.notes}
                            </span>
                        )}
                        {group?.partner_name && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {group.partner_name}
                            </span>
                        )}
                        {group?.client_reference && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {group.client_reference}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            id: 'cuota',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuota" className="justify-center" />
            ),
            cell: ({ row }) => {
                const item = row.original
                if (!item.installmentNumber || !item.totalInstallments) return null
                return (
                    <div className="flex justify-center text-xs font-medium tabular-nums">
                        {item.installmentNumber}/{item.totalInstallments}
                    </div>
                )
            },
            enableSorting: false,
        },
        {
            accessorKey: 'amount',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" className="justify-end" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <MoneyDisplay amount={row.original.amount} />
                </div>
            ),
        },
        {
            id: 'tipo',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <StatusBadge
                        status={row.original.movementType || ''}
                        label={row.original.movementTypeDisplay || ''}
                    />
                </div>
            ),
            enableSorting: false,
        },
    ]

    const canAct = stmt && (stmt.status === 'OPEN' || stmt.status === 'OVERDUE')

    const footerBtns = canAct ? (
        <div className="flex items-center justify-end gap-2 w-full">
            <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isCanceling}
            >
                <XCircle className="h-4 w-4 mr-1" />
                Anular
            </Button>
            <Button onClick={() => setPayOpen(true)}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Pagar
            </Button>
        </div>
    ) : undefined

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title={stmt ? `Estado de Cuenta ${stmt.display_id}` : 'Estado de Cuenta'}
                size="full"
                icon={ShoppingCart}
                hideScrollArea
                contentClassName="flex flex-col p-5"
                footer={footerBtns}
            >
                <SkeletonShell isLoading={isLoading || !stmt} ariaLabel="Cargando estado de cuenta">
                    {stmt ? (
                        <div className="flex flex-col flex-1 space-y-4 min-h-0">
                            <div className="grid grid-cols-2 gap-4 text-sm shrink-0">
                                <div>
                                    <span className="text-muted-foreground">Período:</span>{' '}
                                    <span className="font-medium">
                                        {String(stmt.period_month).padStart(2, '0')}/{stmt.period_year}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Cierre:</span>{' '}
                                    <span className="font-medium">
                                        {parseDateOnly(stmt.cut_off_date).toLocaleDateString('es-CL')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Vencimiento:</span>{' '}
                                    <span className="font-medium">
                                        {parseDateOnly(stmt.due_date).toLocaleDateString('es-CL')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Estado:</span>{' '}
                                    <StatusBadge status={stmt.status} />
                                </div>
                                {stmt.paid_at && (
                                    <div>
                                        <span className="text-muted-foreground">Pagado el:</span>{' '}
                                        <span className="font-medium">
                                            {new Date(stmt.paid_at).toLocaleDateString('es-CL')}
                                        </span>
                                    </div>
                                )}
                                {stmt.payment_account_name && (
                                    <div>
                                        <span className="text-muted-foreground">Cuenta de pago:</span>{' '}
                                        <span className="font-medium">{stmt.payment_account_name}</span>
                                    </div>
                                )}
                            </div>

                            {stmt.notes && (
                                <div className="rounded-md border p-3 text-sm text-muted-foreground shrink-0">
                                    {stmt.notes}
                                </div>
                            )}

                            <div className="flex-1 min-h-0 flex flex-col">
                                <div className="flex-1 min-h-0 [&_thead]:!bg-transparent [&_thead_tr]:!bg-transparent">
                                    <DataTableView
                                        entityLabel="treasury.treasurymovement"
                                        columns={chargesColumns}
                                        data={mergedRows}
                                        isLoading={chargesLoading}
                                        variant="embedded"
                                        hideToolbar
                                        emptyState={{
                                            context: 'treasury',
                                            icon: ShoppingCart,
                                            title: 'Sin cargos',
                                            description: 'No hay movimientos vinculados a este statement.',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}
                </SkeletonShell>
            </BaseModal>

            <PayStatementModal
                statement={stmt ?? null}
                open={payOpen}
                onOpenChange={setPayOpen}
            />
        </>
    )
}
