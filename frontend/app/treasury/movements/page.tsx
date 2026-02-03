"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, translateStatus } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowRight, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, History as HistoryIcon, User as UserIcon, Monitor as TerminalIcon } from "lucide-react"

interface CashMovement {
    id: number
    movement_type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'BANK_DEPOSIT' | 'ADJUSTMENT'
    movement_type_display: string
    date: string
    amount: string
    status: string
    status_display: string
    from_container: number | null
    from_container_name: string | null
    to_container: number | null
    to_container_name: string | null
    pos_session: number | null
    created_by: number
    created_by_name: string
    notes: string
    created_at: string
}

export default function CashMovementsPage() {
    const [movements, setMovements] = useState<CashMovement[]>([])
    const [loading, setLoading] = useState(true)

    const fetchMovements = async () => {
        setLoading(true)
        try {
            const res = await api.get('/treasury/cash-movements/')
            setMovements(res.data.results || res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMovements()
    }, [])

    const columns: ColumnDef<CashMovement>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => {
                const date = new Date(row.getValue("date"))
                return (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">
                            {format(date, "dd MMM yyyy", { locale: es })}
                        </span>
                        <span className="text-[10px] text-muted-foreground italic">
                            {format(date, "HH:mm", { locale: es })}
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "movement_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo Movimiento" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("movement_type") as string
                const iconMap: Record<string, any> = {
                    'DEPOSIT': <ArrowDownLeft className="h-4 w-4 text-emerald-600" />,
                    'WITHDRAWAL': <ArrowUpRight className="h-4 w-4 text-amber-600" />,
                    'TRANSFER': <ArrowLeftRight className="h-4 w-4 text-blue-600" />,
                    'BANK_DEPOSIT': <ArrowRight className="h-4 w-4 text-slate-600" />,
                    'ADJUSTMENT': <HistoryIcon className="h-4 w-4 text-purple-600" />,
                }
                return (
                    <div className="flex items-center gap-2">
                        {iconMap[type]}
                        {row.original.movement_type_display}
                    </div>
                )
            },
        },
        {
            id: "flow",
            header: "Flujo",
            cell: ({ row }) => {
                const m = row.original
                return (
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-muted-foreground max-w-[120px] truncate">
                            {m.from_container_name || (m.pos_session ? `Sesión #${m.pos_session}` : 'Exterior')}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50" />
                        <span className="font-medium max-w-[120px] truncate">
                            {m.to_container_name || (m.pos_session ? `Sesión #${m.pos_session}` : 'Exterior')}
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" />
            ),
            cell: ({ row }) => (
                <div className="font-bold">
                    {formatCurrency(row.getValue("amount"))}
                </div>
            ),
        },
        {
            accessorKey: "pos_session",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Origen/Sesión" />
            ),
            cell: ({ row }) => {
                const sessionId = row.getValue("pos_session")
                if (!sessionId) return <span className="text-muted-foreground text-[10px] italic">Manual/Interno</span>
                return (
                    <div className="flex items-center gap-2">
                        <TerminalIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium underline cursor-help" title="Ver sesión POS">
                            Sesión #{String(sessionId || '')}
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "created_by_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Registrado Por" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-[10px]">
                    <UserIcon className="h-3 w-3 text-muted-foreground" />
                    {row.original.created_by_name}
                </div>
            ),
        },
        {
            accessorKey: "notes",
            header: "Notas/Ref",
            cell: ({ row }) => (
                <div className="text-[10px] text-muted-foreground italic max-w-[200px] truncate" title={row.getValue("notes")}>
                    {row.getValue("notes") || '-'}
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Trazabilidad de Efectivo</h2>
                    <p className="text-muted-foreground">
                        Historial completo de depósitos, retiros y traslados físicos de dinero.
                    </p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={movements}
                filterColumn="notes"
                searchPlaceholder="Buscar en notas..."
                facetedFilters={[
                    {
                        column: "movement_type",
                        title: "Tipo",
                        options: [
                            { label: "Depósito", value: "DEPOSIT" },
                            { label: "Retiro", value: "WITHDRAWAL" },
                            { label: "Transferencia", value: "TRANSFER" },
                            { label: "Dep. Bancario", value: "BANK_DEPOSIT" },
                            { label: "Ajuste", value: "ADJUSTMENT" },
                        ],
                    },
                ]}
            />
        </div>
    )
}
