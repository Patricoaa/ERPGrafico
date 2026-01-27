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
    AlertCircle,
    Plus,
    Pencil,
    Archive,
    RefreshCw
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ProductForm } from "@/components/forms/ProductForm"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"

interface Subscription {
    id: number
    product: number // Added product ID from serializer
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

    // Form & Actions state
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<any>(null) // We'll fetch full product data
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [currentArchivingProduct, setCurrentArchivingProduct] = useState<{ id: number, name: string } | null>(null)

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

    const handleArchive = async () => {
        if (!currentArchivingProduct) return
        try {
            await api.patch(`/inventory/products/${currentArchivingProduct.id}/`, { active: false })
            toast.success("Producto archivado correctamente")
            fetchSubscriptions()
            setIsConfirmModalOpen(false)
        } catch (error) {
            console.error("Error archiving product:", error)
            toast.error("Error al archivar producto")
        }
    }

    const openEditForm = async (productId: number) => {
        try {
            const response = await api.get(`/inventory/products/${productId}/`)
            setEditingProduct(response.data)
            setIsFormOpen(true)
        } catch (error) {
            console.error("Error fetching product details:", error)
            toast.error("Error al cargar detalles del producto")
        }
    }

    const handleTriggerInspection = async () => {
        try {
            const response = await api.post('/inventory/subscriptions/trigger_inspection/')
            toast.success(response.data.message || "Inspección ejecutada correctamente")
            fetchSubscriptions()
            fetchStats()
        } catch (error: any) {
            console.error("Error triggering inspection:", error)
            toast.error(error.response?.data?.error || "Error al ejecutar inspección")
        }
    }

    // Original pause/resume handlers... (kept as is, just commenting for context)
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
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditForm(sub.product)}
                            title="Editar Producto"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>

                        {sub.status === "ACTIVE" && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                onClick={() => handlePause(sub.id)}
                                title="Pausar Suscripción"
                            >
                                <Pause className="h-4 w-4" />
                            </Button>
                        )}
                        {sub.status === "PAUSED" && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleResume(sub.id)}
                                title="Reanudar Suscripción"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                                setCurrentArchivingProduct({ id: sub.product, name: sub.product_name })
                                setIsConfirmModalOpen(true)
                            }}
                            title="Archivar Producto"
                        >
                            <Archive className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold">Gestión de Suscripciones</h1>
                <div className="flex items-center gap-2">
                    <Button
                        size="icon"
                        className="rounded-full h-8 w-8"
                        onClick={() => {
                            setEditingProduct(null)
                            setIsFormOpen(true)
                        }}
                        title="Nueva Suscripción"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full"
                        onClick={handleTriggerInspection}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Ejecutar Inspección
                    </Button>
                </div>
            </div>

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

            <ProductForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open)
                    if (!open) setEditingProduct(null)
                }}
                initialData={editingProduct}
                onSuccess={() => {
                    fetchSubscriptions()
                }}
                lockedType="SUBSCRIPTION"
            />

            <ActionConfirmModal
                open={isConfirmModalOpen}
                onOpenChange={setIsConfirmModalOpen}
                title="Archivar Producto"
                variant="destructive"
                onConfirm={handleArchive}
                confirmText="Archivar"
                description={
                    <div className="space-y-3">
                        <p>
                            ¿Está seguro de que desea archivar el producto <strong>{currentArchivingProduct?.name}</strong>?
                        </p>
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-3 text-amber-800">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <div className="text-xs">
                                <p className="font-bold mb-1">Impacto en Suscripciones</p>
                                <p>Al archivar este producto, esta suscripción se ocultará de la lista.</p>
                            </div>
                        </div>
                    </div>
                }
            />
        </div>
    )
}
