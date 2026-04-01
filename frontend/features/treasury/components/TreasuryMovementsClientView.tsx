"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, ArrowDown, Eye } from "lucide-react"
import { cn, formatCurrency, formatPlainDate } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { Badge } from "@/components/ui/badge"
import { DataCell } from "@/components/ui/data-table-cells"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { EmptyState } from "@/components/shared/EmptyState"
import { StatusBadge } from "@/components/shared/StatusBadge"

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

export function TreasuryMovementsClientView() {
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

    const handleViewDetails = (id: number) => {
        setSelectedMovementId(id)
        setDetailsOpen(true)
    }

    const columns: ColumnDef<TreasuryMovement>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" />,
            cell: ({ row }) => {
                const m = row.original
                return <DataCell.DocumentId type={m.payment_method === 'WRITE_OFF' ? 'WRITE_OFF' : m.movement_type} number={m.id} />
            },
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-xs">{formatPlainDate(row.getValue("date"))}</span>
                </div>
            ),
        },
        {
            accessorKey: "movement_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
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
                    <StatusBadge 
                        status={status} 
                        label={label} 
                        size="sm" 
                        className="uppercase font-bold tracking-tight"
                    />
                )
            },
        },
        {
            id: "flow",
            header: "Flujo",
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

                const EntityLink = ({ data, colorClass = "text-muted-foreground" }: { data: typeof sourceData, colorClass?: string }) => {
                    if (data.type === 'contact' && data.id) {
                        return (
                            <span 
                                onClick={(e) => { e.stopPropagation(); openContact(data.id!); }}
                                className={cn("font-bold truncate max-w-[150px] cursor-pointer hover:text-primary hover:underline transition-colors", colorClass)}
                                title={data.label}
                            >
                                {data.label}
                            </span>
                        );
                    }
                    if (data.type === 'account' && data.id) {
                        return (
                            <span 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    // Use the treasury account ID (m.from_account or m.to_account) 
                                    // instead of the accounting account ID (data.id)
                                    // because the TreasuryAccountModal expects the TreasuryAccount ID.
                                    // Wait, I should check which ID I put in sourceData.id
                                    openTreasuryAccount(m.movement_type === 'INBOUND' && data === destData ? m.to_account : (m.movement_type === 'OUTBOUND' && data === sourceData ? m.from_account : (m.movement_type === 'TRANSFER' || m.movement_type === 'ADJUSTMENT' ? (data === sourceData ? m.from_account : m.to_account) : null)));
                                }}
                                className={cn("font-bold truncate max-w-[150px] cursor-pointer hover:text-primary hover:underline transition-colors", colorClass)}
                                title={data.label}
                            >
                                {data.label}
                            </span>
                        );
                    }
                    return <span className={cn("font-bold truncate max-w-[150px] opacity-70", colorClass)} title={data.label}>{data.label}</span>;
                };

                return (
                    <div className="flex flex-col items-center gap-0.5 text-[11px] py-1 w-full min-w-[120px]">
                        <EntityLink data={sourceData} colorClass="text-muted-foreground" />
                        <ArrowDown className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                        <EntityLink data={destData} colorClass="text-foreground" />
                    </div>
                );
            },
        },
        {
            accessorKey: "payment_method",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Método" />,
            cell: ({ row }) => (
                <span className="text-[10px] uppercase bg-muted/30 px-1.5 py-0.5 rounded border border-border/50">
                    {row.original.payment_method_display}
                </span>
            )
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" />,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                const type = row.getValue("movement_type") as string
                const signedAmount = type === 'OUTBOUND' ? -amount : amount
                return (
                    <div className="text-right">
                        <MoneyDisplay amount={signedAmount} className="font-bold" />
                    </div>
                )
            },
        },
        {
            id: "origin",
            header: "Origen / Sistema",
            cell: ({ row }) => {
                const session = row.original.pos_session
                if (session) {
                    return (
                        <div className="text-[10px] text-info font-medium">
                            POS #{session}
                        </div>
                    )
                }
                return (
                    <div className="text-[10px] text-muted-foreground font-medium">
                        SISTEMA
                    </div>
                )
            },
        },
        {
            accessorKey: "created_by_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Usuario" />,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {row.getValue("created_by_name")}
                </span>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleViewDetails(row.original.id)}
                        title="Ver Detalle"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Movimientos de Tesorería"
                description="Registro histórico de ingresos, egresos y traslados de fondos."
                titleActions={
                    <PageHeaderButton
                        onClick={() => setOpenModal(true)}
                        icon={Plus}
                        circular
                        title="Nuevo Movimiento"
                    />
                }
            />

            <Suspense fallback={null}>
                <CashMovementModal
                    open={openModal}
                    onOpenChange={(open: boolean) => setOpenModal(open)}
                    onSuccess={fetchMovements}
                />
            </Suspense>

            {movements.length === 0 && !loading ? (
                <div className="bg-white rounded-xl border shadow-sm">
                    <EmptyState
                        icon={ArrowDown}
                        title="No hay movimientos"
                        description="Aún no se han registrado ingresos o egresos de fondos en el sistema para el periodo actual."
                        action={
                            <Button onClick={() => setOpenModal(true)} variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Registrar Movimiento
                            </Button>
                        }
                    />
                </div>
            ) : (
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
                />
            )}

            <Suspense fallback={null}>
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

