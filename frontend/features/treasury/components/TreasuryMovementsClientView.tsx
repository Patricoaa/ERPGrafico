"use client"

import React, { useState, useEffect, lazy, Suspense } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, ArrowDown, Eye } from "lucide-react"
import { cn, formatCurrency, formatPlainDate } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { EmptyState } from "@/components/shared/EmptyState"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { FormSkeleton } from "@/components/shared"

// Lazy load heavy components
const CashMovementModal = lazy(() => import("./CashMovementModal"))
const TransactionViewModal = lazy(() =>
    import("@/components/shared/TransactionViewModal").then(module => ({ default: module.TransactionViewModal }))
)

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
    const { openContact, openTreasuryAccount } = useGlobalModalActions()
    const [movements, setMovements] = useState<TreasuryMovement[]>([])
    const [loading, setLoading] = useState(true)
    const [openModal, setOpenModal] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | string>(0)

    const fetchMovements = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/movements/')
            setMovements(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch movements", error)
            toast.error("Error al cargar los movimientos.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMovements()
    }, [])

    useEffect(() => {
        if (externalOpen) {
            requestAnimationFrame(() => setOpenModal(true))
        }
    }, [externalOpen])

    const handleViewDetails = React.useCallback((id: number) => {
        setSelectedMovementId(id)
        setDetailsOpen(true)
    }, [])

    const columns = React.useMemo<ColumnDef<TreasuryMovement>[]>(() => [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => {
                const m = row.original
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.DocumentId type={m.payment_method === 'WRITE_OFF' ? 'WRITE_OFF' : m.movement_type} number={m.id} />
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
                                className="text-[11px] font-bold"
                            >
                                {data.label}
                            </DataCell.ContactLink>
                        );
                    }
                    if (data.type === 'account' && data.id) {
                        const accountId = m.movement_type === 'INBOUND' && data === destData ? m.to_account : (m.movement_type === 'OUTBOUND' && data === sourceData ? m.from_account : (m.movement_type === 'TRANSFER' || m.movement_type === 'ADJUSTMENT' ? (data === sourceData ? m.from_account : m.to_account) : null));
                        return (
                            <DataCell.Link
                                onClick={() => openTreasuryAccount(accountId)}
                                className="text-[11px] font-bold"
                            >
                                {data.label}
                            </DataCell.Link>
                        );
                    }
                    return <DataCell.Secondary className="text-[11px] font-bold opacity-70"> {/* intentional: badge density */} {data.label}</DataCell.Secondary>;
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
                    <DataCell.Secondary className="uppercase font-bold tracking-tighter">
                        {row.original.payment_method_display}
                    </DataCell.Secondary>
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
                        <DataCell.Currency value={signedAmount} className="font-bold" />
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
                            <div className="text-[10px] text-info font-medium">
                                POS #{session}
                            </div>
                        ) : (
                            <div className="text-[10px] text-muted-foreground font-medium">
                                SISTEMA
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "created_by_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Usuario" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {row.getValue("created_by_name")}
                    </span>
                </div>
            ),
        },
        createActionsColumn<TreasuryMovement>({
            renderActions: (item) => (
                <DataCell.Action icon={Eye} title="Ver Detalle" onClick={() => handleViewDetails(item.id)} />
            ),
        })
    ], [openTreasuryAccount, handleViewDetails])

    return (
        <div className="space-y-6">
            <Suspense fallback={<FormSkeleton />}>
                <CashMovementModal
                    open={openModal}
                    onOpenChange={(open: boolean) => setOpenModal(open)}
                    onSuccess={fetchMovements}
                />
            </Suspense>

            <DataTable
                columns={columns}
                data={movements}
                cardMode
                isLoading={loading}
                globalFilterFields={["notes", "reference", "partner_name", "from_account_name", "to_account_name"]}
                searchPlaceholder="Buscar movimientos..."
                useAdvancedFilter={true}
                facetedFilters={[
                    {
                        column: "movement_type",
                        title: "Tipo",
                        options: [
                            { label: "Depósito", value: "INBOUND" },
                            { label: "Retiro", value: "OUTBOUND" },
                            { label: "Traspaso", value: "TRANSFER" },
                            { label: "Ajuste", value: "ADJUSTMENT" },
                        ],
                    },
                ]}
                createAction={createAction}
                emptyState={{
                    context: "finance",
                    title: "No hay movimientos",
                    description: "Aún no se han registrado ingresos o egresos de fondos en el sistema para el periodo actual.",

                }}
            />

            <Suspense fallback={<FormSkeleton />}>
                <TransactionViewModal
                    open={detailsOpen}
                    onOpenChange={setDetailsOpen}
                    type="payment"
                    id={selectedMovementId}
                    view="details"
                />
            </Suspense>
        </div>
    )
}

export default TreasuryMovementsClientView
