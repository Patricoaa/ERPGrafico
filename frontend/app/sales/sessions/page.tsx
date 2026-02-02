"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { Eye, Store, Calendar, DollarSign, User as UserIcon } from "lucide-react"
import api from "@/lib/api"
import { formatCurrency } from "@/lib/currency"

interface POSSession {
    id: number
    id_display: string // Usually handled by frontend formatting if not in API, but let's assume simple ID for now
    user_name: string
    treasury_account_name: string
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    start_amount: number
    current_cash?: number // Not always available in list
    expected_cash?: number
}

export default function POSSessionsPage() {
    const router = useRouter()
    const [sessions, setSessions] = useState<POSSession[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSessions()
    }, [])

    const fetchSessions = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/pos-sessions/')
            setSessions(response.data)
        } catch (error) {
            console.error('Error fetching sessions:', error)
        } finally {
            setLoading(false)
        }
    }

    const columns: ColumnDef<POSSession>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="ID" />
            ),
            cell: ({ row }) => <DataCell.Code className="font-bold">SES-{row.original.id}</DataCell.Code>,
        },
        {
            accessorKey: "user_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cajero" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("user_name")}</DataCell.Text>,
        },
        {
            accessorKey: "opened_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Apertura" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("opened_at")} showTime />,
        },
        {
            accessorKey: "closed_at",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cierre" />
            ),
            cell: ({ row }) => {
                const val = row.getValue("closed_at") as string
                return val ? <DataCell.Date value={val} showTime /> : <span className="text-muted-foreground">-</span>
            },
        },
        {
            accessorKey: "start_amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fondo Inicial" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("start_amount")} className="text-muted-foreground" />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const state = row.getValue("status") as string
                const variant = state === 'OPEN' ? 'success' : state === 'CLOSED' ? 'secondary' : 'warning'
                return (
                    <DataCell.Badge variant={variant}>
                        {row.original.status_display}
                    </DataCell.Badge>
                )
            },
        },
        {
            id: "actions",
            header: "Acción",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    {/* Access detailed view or generic generic session info. For now, no detail page requested explicitly, but useful. */}
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground/90">Sesiones Punto de Venta</h2>
                    <p className="text-muted-foreground">
                        Historial de aperturas y cierres de caja.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => router.push('/sales/pos')} className="bg-primary hover:bg-primary/90">
                        <Store className="mr-2 h-4 w-4" />
                        Ir al POS
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Sesiones Totales</CardTitle>
                        <Calendar className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{sessions.length}</div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Abiertas Ahora</CardTitle>
                        <Store className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {sessions.filter(s => s.status === 'OPEN').length}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-gray-400 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios Únicos</CardTitle>
                        <UserIcon className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Set(sessions.map(s => s.user_name)).size}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="bg-card rounded-xl border shadow-sm">
                    <DataTable
                        columns={columns}
                        data={sessions}
                        filterColumn="user_name"
                        searchPlaceholder="Buscar por cajero..."
                        facetedFilters={[
                            {
                                column: "status",
                                title: "Estado",
                                options: [
                                    { label: "Abierta", value: "OPEN" },
                                    { label: "Cerrada", value: "CLOSED" },
                                    { label: "Cerrando", value: "CLOSING" },
                                ]
                            }
                        ]}
                        useAdvancedFilter={true}
                        defaultPageSize={10}
                    />
                </div>
            )}
        </div>
    )
}
