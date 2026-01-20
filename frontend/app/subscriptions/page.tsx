"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ColumnDef,
} from "@tanstack/react-table"
import {
    Calendar,
    DollarSign,
    Pause,
    Play,
    X,
    TrendingUp,
    AlertCircle
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"

interface Subscription {
    id: number
    product_name: string
    product_code: string
    product_internal_code?: string
    category_name?: string
    supplier_name: string
    supplier_id: number
    start_date: string
    end_date: string | null
    next_payment_date: string
    amount: string
    currency: string
    status: string
    status_display: string
    recurrence_period: string
    recurrence_display: string
    payment_day_type: string | null
    payment_day: number | null
    payment_interval_days: number | null
    notes: string
}

interface Stats {
    active_subscriptions: number
    paused_subscriptions: number
    cancelled_subscriptions: number
    total_monthly_cost: number
    upcoming_renewals_30_days: number
}

export default function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchSubscriptions = async () => {
        try {
            setLoading(true)
            const response = await api.get('/inventory/subscriptions/')
            setSubscriptions(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching subscriptions:", error)
            toast.error("Error al cargar suscripciones")
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const response = await api.get('/inventory/subscriptions/stats/')
            setStats(response.data)
        } catch (error) {
            console.error("Error fetching stats:", error)
        }
    }

    useEffect(() => {
        fetchSubscriptions()
        fetchStats()
    }, [])

    const handlePause = async (id: number) => {
        try {
            await api.post(`/inventory/subscriptions/${id}/pause/`)
            toast.success("Suscripción pausada")
            fetchSubscriptions()
            fetchStats()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al pausar suscripción")
        }
    }

    const handleResume = async (id: number) => {
        try {
            await api.post(`/inventory/subscriptions/${id}/resume/`)
            toast.success("Suscripción reactivada")
            fetchSubscriptions()
            fetchStats()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al reactivar suscripción")
        }
    }


    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return "bg-green-500"
            case "PAUSED":
                return "bg-yellow-500"
            case "CANCELLED":
                return "bg-red-500"
            default:
                return "bg-gray-500"
        }
    }

    const getPaymentScheduleText = (sub: Subscription) => {
        if (sub.payment_day_type === "FIXED_DAY" && sub.payment_day) {
            return `Día ${sub.payment_day} de cada ${sub.recurrence_display.toLowerCase()}`
        } else if (sub.payment_day_type === "INTERVAL" && sub.payment_interval_days) {
            return `Cada ${sub.payment_interval_days} días`
        }
        return sub.recurrence_display
    }

    const columns: ColumnDef<Subscription>[] = [
        {
            id: "product",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" />
            ),
            accessorFn: (row) => row.product_name,
            cell: ({ row }) => {
                const sub = row.original;
                return (
                    <div className="flex flex-col gap-1 py-1">
                        <span className="font-medium text-xs leading-tight">{sub.product_name}</span>
                        <div className="flex flex-wrap gap-1">
                            {sub.product_internal_code && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                                    {sub.product_internal_code}
                                </Badge>
                            )}
                            {sub.product_code && sub.product_code !== sub.product_internal_code && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase">
                                    {sub.product_code}
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Categoría" />
            ),
            cell: ({ row }) => <DataCell.Text className="text-xs">{row.getValue("category_name")}</DataCell.Text>,
        },
        {
            accessorKey: "supplier_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("supplier_name")}</DataCell.Text>,
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("amount")} />,
        },
        {
            id: "frequency",
            header: "Frecuencia",
            cell: ({ row }) => (
                <DataCell.Secondary className="text-foreground">{getPaymentScheduleText(row.original)}</DataCell.Secondary>
            ),
        },
        {
            accessorKey: "next_payment_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Próximo Pago" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("next_payment_date")} />,
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => (
                <DataCell.Status
                    status={row.getValue("status")}
                    map={{
                        ACTIVE: "success",
                        PAUSED: "warning",
                        CANCELLED: "destructive",
                        PENDING: "secondary"
                    }}
                />
            ),
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => {
                const sub = row.original
                return (
                    <div className="flex gap-2 justify-end">
                        {sub.status === "ACTIVE" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePause(sub.id)}
                            >
                                <Pause className="h-4 w-4" />
                            </Button>
                        )}
                        {sub.status === "PAUSED" && (
                            <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleResume(sub.id)}
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Gestión de Suscripciones</h1>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Activas</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.active_subscriptions}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pausadas</CardTitle>
                            <Pause className="h-4 w-4 text-yellow-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.paused_subscriptions}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
                            <X className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.cancelled_subscriptions}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Costo Mensual</CardTitle>
                            <DollarSign className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.total_monthly_cost)}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Próximas (30d)</CardTitle>
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.upcoming_renewals_30_days}</div>
                        </CardContent>
                    </Card>
                </div>
            )}


            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Suscripciones</h3>
                {loading ? (
                    <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center">
                        Cargando...
                    </div>
                ) : (
                    <div className="">
                        <DataTable
                            columns={columns}
                            data={subscriptions}
                            filterColumn="product"
                            searchPlaceholder="Buscar por producto..."
                            facetedFilters={[
                                {
                                    column: "status",
                                    title: "Estado",
                                    options: [
                                        { label: "Activo", value: "ACTIVE" },
                                        { label: "Pausado", value: "PAUSED" },
                                        { label: "Cancelado", value: "CANCELLED" },
                                    ],
                                },
                            ]}
                            useAdvancedFilter={true}
                            defaultPageSize={20}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
