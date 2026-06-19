"use client"

import React, { useState, useEffect, lazy, Suspense } from "react"
import { DataTableView, EntityCard, StatusBadge } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import {ArrowDown} from "lucide-react"

import { DataCell, createActionsColumn } from '@/components/shared'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { SkeletonShell, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { treasuryMovementsSearchDef } from "@/features/treasury/searchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"


// Lazy load heavy components
import { CashMovementDrawer } from "@/features/treasury/components/CashMovementDrawer"
const CashMovementModal = lazy(() => import("./CashMovementModal"))

interface TreasuryMovement {
    id: number
    display_id: string
    movement_type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    movement_type_display: string
    payment_method: string
    payment_method_display: string
    amount: number
    created_at: string
    date: string
    created_by: number | null
    created_by_name: string
    notes: string
    pos_session: number | null
    from_account: number | null
    from_account_name: string | null
    from_account_account_id: number | null
    from_account_code: string | null
    to_account: number | null
    to_account_name: string | null
    to_account_account_id: number | null
    to_account_code: string | null
    justify_reason: string | null
    justify_reason_display: string | null
    partner_name: string | null
    partner_id: number | null
    reference: string | null
    involved_accounts?: string[]
    document_info?: {
        type: string | null
        id: number | null
        number: string | null
        label: string | null
    } | null
}

interface TreasuryMovementsClientViewProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export function TreasuryMovementsClientView({ externalOpen, createAction }: TreasuryMovementsClientViewProps) {
    const { openEntity } = useGlobalModalActions()
    const { filters, isFiltered } = useSmartSearch(treasuryMovementsSearchDef)
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, movements, totalCount, isLoading, refetch } = useTreasuryMovements({
        ...(filters as TreasuryMovementFilters),
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const [openModal, setOpenModal] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<TreasuryMovement>({
        endpoint: '/treasury/movements'
    })

    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setSelectedMovementId(selectedFromUrl.id)
                setDetailsOpen(true)
            })
        }
    }, [selectedFromUrl])

    // T-105: cancelAnimationFrame cleanup prevents setState on unmounted component
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setOpenModal(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    const handleViewDetails = React.useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const columns = React.useMemo<ColumnDef<TreasuryMovement>[]>(() => [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Code>{row.getValue("display_id")}</DataCell.Code>
            ),
        },
        {
            accessorKey: "movement_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const m = row.original
                const type = m.movement_type
                const isWriteOff = m.payment_method === 'WRITE_OFF'

                let status = "info"
                let label = m.movement_type_display

                if (isWriteOff) {
                    status = "voided"
                    label = "Castigo"
                } else if (type === 'INBOUND') {
                    status = "received"
                    label = "Depósito"
                } else if (type === 'OUTBOUND') {
                    status = "sent"
                    label = "Retiro"
                } else if (type === 'TRANSFER' || type === 'ADJUSTMENT') {
                    status = "in_progress"
                    label = type === 'TRANSFER' ? "Traspaso" : "Ajuste"
                }

                return (
                    <div className="flex justify-center w-full">
                        <StatusBadge
                            status={status}
                            label={label}
                            size="sm"
                            className="uppercase font-bold tracking-tight"
                        />
                    </div>
                )
            },
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.getValue("date")} />
                </div>
            ),
        },
        {
            id: "flow",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Flujo" className="justify-center" />,
            cell: ({ row }) => {
                const m = row.original;
                const type = m.movement_type;

                // Define entities in the flow
                let sourceData: { label: string, type: 'contact' | 'account' | 'text', id?: number, accountCode?: string } = { label: 'Particular', type: 'text' };
                let destData: { label: string, type: 'contact' | 'account' | 'text', id?: number, accountCode?: string } = { label: 'Particular', type: 'text' };

                if (type === 'TRANSFER' || type === 'ADJUSTMENT') {
                    sourceData = {
                        label: m.from_account_name || 'Origen',
                        type: 'account',
                        id: m.from_account_account_id || undefined,
                        accountCode: m.from_account_code || ''
                    };
                    destData = {
                        label: m.to_account_name || 'Destino',
                        type: 'account',
                        id: m.to_account_account_id || undefined,
                        accountCode: m.to_account_code || ''
                    };
                } else if (type === 'INBOUND') {
                    sourceData = m.partner_id ? { label: m.partner_name || 'Particular', type: 'contact', id: m.partner_id } : { label: m.partner_name || 'Particular', type: 'text' };
                    destData = {
                        label: m.to_account_name || 'Caja',
                        type: 'account',
                        id: m.to_account_account_id || undefined,
                        accountCode: m.to_account_code || ''
                    };
                } else if (type === 'OUTBOUND') {
                    sourceData = {
                        label: m.from_account_name || 'Caja',
                        type: 'account',
                        id: m.from_account_account_id || undefined,
                        accountCode: m.from_account_code || ''
                    };
                    destData = m.partner_id ? { label: m.partner_name || 'Particular', type: 'contact', id: m.partner_id } : { label: m.partner_name || 'Particular', type: 'text' };
                }

                const EntityLink = ({ data }: { data: typeof sourceData }) => {
                    if (data.type === 'contact' && data.id) {
                        return (
                            <DataCell.ContactLink
                                contactId={data.id}
                            >
                                {data.label}
                            </DataCell.ContactLink>
                        );
                    }
                    if (data.type === 'account' && data.id) {
                        const accountId = m.movement_type === 'INBOUND' && data === destData ? m.to_account : (m.movement_type === 'OUTBOUND' && data === sourceData ? m.from_account : (m.movement_type === 'TRANSFER' || m.movement_type === 'ADJUSTMENT' ? (data === sourceData ? m.from_account : m.to_account) : null));
                        return (
                            <DataCell.Link
                                onClick={() => { if (accountId) openEntity('treasury.treasuryaccount', accountId) }}
                            >
                                {data.label}
                            </DataCell.Link>
                        );
                    }
                    return <DataCell.Text>{data.label}</DataCell.Text>;
                };

                return (
                    <div className="flex flex-col items-center gap-0.5 py-1 w-full min-w-[120px]">
                        <EntityLink data={sourceData} />
                        <ArrowDown className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                        <EntityLink data={destData} />
                    </div>
                );
            },
        },
        {
            accessorKey: "payment_method",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Método" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>
                        {row.original.payment_method_display}
                    </DataCell.Text>
                </div>
            )
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="justify-center" />,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                const type = row.getValue("movement_type") as string
                const signedAmount = type === 'OUTBOUND' ? -amount : amount
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Currency value={signedAmount} />
                    </div>
                )
            },
        },
        {
            id: "origin",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Origen / Sistema" className="justify-center" />,
            cell: ({ row }) => {
                const session = row.original.pos_session
                return (
                    <div className="flex justify-center w-full">
                        {session ? (
                            <DataCell.Text >
                                POS #{session}
                            </DataCell.Text>
                        ) : (
                            <DataCell.Text>
                                SISTEMA
                            </DataCell.Text>
                        )}
                    </div>
                )
            },
        },
        createActionsColumn<TreasuryMovement>({
            renderActions: (item) => (
                <DataCell.Action action="detail" onClick={() => handleViewDetails(item.id)} />
            ),
        })
    ], [openEntity, handleViewDetails])

    return (
        <div className="h-full flex flex-col">
            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando modal de movimiento de tesorería">
                <Suspense fallback={<div />}>
                    <CashMovementModal
                        open={openModal}
                        onOpenChange={(open: boolean) => setOpenModal(open)}
                        onSuccess={refetch}
                    />
                </Suspense>
            </SkeletonShell>

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.treasurymovement"
                    columns={columns}
                    data={movements}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination
                    pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={pageState}
                    onPaginationChange={setPageState}
                    smartSearch={<SmartSearchBar searchDef={treasuryMovementsSearchDef} placeholder="Buscar movimientos..." className="w-full" />}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "treasury",
                        title: "Aún no hay movimientos de caja",
                        description: "Los ingresos y egresos de fondos que registres aparecerán aquí.",
                    }}
                    renderCard={(m) => {
                        const type = m.movement_type
                        const isWriteOff = m.payment_method === 'WRITE_OFF'

                        let status = "info" as any
                        let label = m.movement_type_display

                        if (isWriteOff) {
                            status = "voided"
                            label = "Castigo"
                        } else if (type === 'INBOUND') {
                            status = "received"
                            label = "Depósito"
                        } else if (type === 'OUTBOUND') {
                            status = "sent"
                            label = "Retiro"
                        } else if (type === 'TRANSFER' || type === 'ADJUSTMENT') {
                            status = "in_progress"
                            label = type === 'TRANSFER' ? "Traspaso" : "Ajuste"
                        }

                        let sourceLabel = m.partner_name || m.from_account_name || 'Origen'
                        let destLabel = m.to_account_name || m.partner_name || 'Destino'

                        if (type === 'INBOUND') {
                            sourceLabel = m.partner_name || 'Particular'
                            destLabel = m.to_account_name || 'Caja'
                        } else if (type === 'OUTBOUND') {
                            sourceLabel = m.from_account_name || 'Caja'
                            destLabel = m.partner_name || 'Particular'
                        } else if (type === 'TRANSFER' || type === 'ADJUSTMENT') {
                            sourceLabel = m.from_account_name || 'Origen'
                            destLabel = m.to_account_name || 'Destino'
                        }

                        const amount = typeof m.amount === 'string' ? parseFloat(m.amount) : m.amount
                        const signedAmount = type === 'OUTBOUND' ? -amount : amount

                        return (
                            <EntityCard key={m.id} onClick={() => handleViewDetails(m.id)}>
                                <EntityCard.Header
                                    title={`Movimiento ${m.display_id}`}
                                    subtitle={m.date}
                                    trailing={
                                        <div className="flex flex-col items-end gap-2">
                                            <StatusBadge status={status} label={label} size="sm" className="uppercase font-bold tracking-tight" />
                                            <DataCell.Currency value={signedAmount} />
                                        </div>
                                    }
                                />
                                <EntityCard.Body>
                                    <EntityCard.Field label="Origen" value={sourceLabel} />
                                    <EntityCard.Field label="Destino" value={destLabel} />
                                    <EntityCard.Field label="Método" value={m.payment_method_display} />
                                    <EntityCard.Field label="Usuario" value={m.created_by_name} />
                                </EntityCard.Body>
                            </EntityCard>
                        )
                    }}
                />
            </div>

            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando vista de detalle de movimiento">
                {selectedMovementId && (
                    <CashMovementDrawer
                        id={selectedMovementId}
                        open={detailsOpen}
                        onOpenChange={(open) => {
                            setDetailsOpen(open)
                            if (!open) clearSelection()
                        }}
                    />
                )}
            </SkeletonShell>
        </div>
    )
}

export default TreasuryMovementsClientView
