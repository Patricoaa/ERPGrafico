"use client"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, ArrowRight, Eye, RefreshCw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { CashMovementModal } from "@/components/treasury/CashMovementModal"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"

// Define the type for our data
interface CashMovement {
    id: number
    movement_type: string
    movement_type_display: string
    amount: number
    created_at: string
    created_by_name: string
    notes: string
    pos_session: number | null
    from_container_name: string | null
    to_container_name: string | null
    justify_reason: string | null
    justify_reason_display: string | null
    involved_accounts: string[]
}

export default function TreasuryMovementsPage() {
    const [movements, setMovements] = useState<CashMovement[]>([])
    const [loading, setLoading] = useState(true)
    const [openModal, setOpenModal] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | string>(0)

    const fetchMovements = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/cash-movements/')
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

    const columns: ColumnDef<CashMovement>[] = [
        {
            accessorKey: "created_at",
            header: "Fecha",
            cell: ({ row }) => {
                const date = new Date(row.getValue("created_at"))
                return (
                    <div className="flex flex-col">
                        <span className="font-medium text-xs">{date.toLocaleDateString()}</span>
                        <span className="text-[10px] text-muted-foreground">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "movement_type",
            header: "Tipo",
            cell: ({ row }) => {
                const type = row.getValue("movement_type") as string
                const label = row.original.movement_type_display

                let variant: "default" | "destructive" | "outline" | "secondary" = "outline"
                if (type === 'DEPOSIT' || type === 'SALE') variant = "default"
                if (type === 'WITHDRAWAL' || type === 'EXPENSE') variant = "destructive"
                if (type === 'TRANSFER' || type === 'BANK_DEPOSIT') variant = "secondary"

                return (
                    <Badge variant={variant} className="text-[10px] uppercase font-bold tracking-tight px-2 py-0">
                        {label}
                    </Badge>
                )
            },
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            id: "flow",
            header: "Flujo / Detalle",
            cell: ({ row }) => {
                const m = row.original;
                const isTransfer = m.movement_type === 'TRANSFER' || m.movement_type === 'BANK_DEPOSIT';
                const isDeposit = m.movement_type === 'DEPOSIT' || m.movement_type === 'SALE';
                const isWithdrawal = m.movement_type === 'WITHDRAWAL' || m.movement_type === 'EXPENSE';

                // Determine motive label
                const motive = m.justify_reason_display || (m.notes ? "Ver notas" : null);

                return (
                    <div className="flex flex-col gap-1 py-1">
                        {/* Physical Flow */}
                        <div className="flex items-center gap-2 text-xs">
                            {isTransfer ? (
                                <>
                                    <span className="font-bold text-muted-foreground truncate max-w-[100px]" title={m.from_container_name || '?'}>
                                        {m.from_container_name || 'Origen'}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50 flex-shrink-0" />
                                    <span className="font-bold truncate max-w-[100px]" title={m.to_container_name || '?'}>
                                        {m.to_container_name || 'Destino'}
                                    </span>
                                </>
                            ) : isDeposit ? (
                                <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[180px]">
                                    {m.to_container_name || 'Entra a Caja'}
                                </span>
                            ) : (
                                <span className="font-bold text-red-700 dark:text-red-400 truncate max-w-[180px]">
                                    {m.from_container_name || 'Sale de Caja'}
                                </span>
                            )}
                        </div>

                        {/* Motive / Justification */}
                        {motive && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px] italic">
                                {motive}
                            </div>
                        )}

                        {/* Accounting Impact */}
                        {m.involved_accounts && m.involved_accounts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                                {m.involved_accounts.map((acc, idx) => (
                                    <span key={idx} className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground/80 border border-muted-foreground/10">
                                        {acc}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right">Monto</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                const type = row.getValue("movement_type") as string
                const isOut = ['WITHDRAWAL', 'EXPENSE', 'BANK_DEPOSIT'].includes(type)
                const colorClass = isOut ? 'text-red-600' : 'text-emerald-600'

                return <div className={`text-right font-bold font-mono ${colorClass}`}>{formatCurrency(amount)}</div>
            },
        },
        {
            id: "origin",
            header: "Origen",
            cell: ({ row }) => {
                const session = row.original.pos_session
                if (session) {
                    return (
                        <Badge variant="outline" className="font-mono text-[10px] bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400">
                            POS #{session}
                        </Badge>
                    )
                }
                return (
                    <Badge variant="secondary" className="text-[10px] dark:bg-slate-800 dark:text-slate-400 opacity-80 uppercase tracking-tighter">
                        Sistema
                    </Badge>
                )
            },
        },
        {
            accessorKey: "created_by_name",
            header: "Usuario",
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {row.getValue("created_by_name")}
                </span>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                return (
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
        }
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4 space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Movimientos de Tesorería</h2>
                <Button
                    size="icon"
                    className="rounded-full h-8 w-8"
                    onClick={() => setOpenModal(true)}
                    title="Nuevo Movimiento"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <CashMovementModal
                open={openModal}
                onOpenChange={setOpenModal}
                onSuccess={() => {
                    fetchMovements()
                }}
            />

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando movimientos...</div>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={movements}
                    globalFilterFields={["notes", "from_container_name", "to_container_name"]}
                    searchPlaceholder="Buscar movimientos..."
                    useAdvancedFilter={true}
                    facetedFilters={[
                        {
                            column: "movement_type",
                            title: "Tipo",
                            options: [
                                { label: "Depósito", value: "DEPOSIT" },
                                { label: "Retiro", value: "WITHDRAWAL" },
                                { label: "Traspaso", value: "TRANSFER" },
                                { label: "Depósito Bancario", value: "BANK_DEPOSIT" },
                                { label: "Venta", value: "SALE" },
                                { label: "Gasto/Compra", value: "EXPENSE" },
                            ],
                        },
                    ]}
                />
            )}

            <TransactionViewModal
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                type="cash_movement"
                id={selectedMovementId}
                view="details"
            />
        </div >
    )
}
