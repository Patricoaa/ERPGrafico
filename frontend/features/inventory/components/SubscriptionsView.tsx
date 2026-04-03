"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ColumnDef,
} from "@tanstack/react-table"
import {
    Pause,
    Play,
    AlertCircle,
    Pencil,
    Archive,
    RefreshCw,
    History
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ProductForm } from "@/features/inventory/components/ProductForm"
import { SubscriptionHistoryModal } from "@/features/inventory/components/SubscriptionHistoryModal"
import { ArchivingRestrictionsDialog } from "@/features/inventory/components/ArchivingRestrictionsDialog"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Restriction } from "@/features/inventory/types"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface Subscription {
    id: number
    product: number
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

interface SubscriptionsViewProps {
    hideHeader?: boolean
    externalOpen?: boolean
}

export function SubscriptionsView({ hideHeader = false, externalOpen = false }: SubscriptionsViewProps) {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    // Form & Actions state
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<any>(null)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [currentArchivingProduct, setCurrentArchivingProduct] = useState<{ id: number, name: string } | null>(null)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [currentHistorySubscriptionId, setCurrentHistorySubscriptionId] = useState<number | null>(null)

    // Restrictions state
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const [isRestrictionsDialogOpen, setIsRestrictionsDialogOpen] = useState(false)
    const [isRetrying, setIsRetrying] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingProduct(null)
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

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
        } catch (error: unknown) {
            showApiError(error, "Error al pausar suscripción")
        }
    }

    const handleArchive = async () => {
        if (!currentArchivingProduct) return

        if (isRestrictionsDialogOpen) {
            setIsRetrying(true)
        }

        try {
            await api.patch(`/inventory/products/${currentArchivingProduct.id}/`, { active: false })
            toast.success("Producto archivado correctamente")
            fetchSubscriptions()
            setIsConfirmModalOpen(false)
            setIsRestrictionsDialogOpen(false)
        } catch (error: unknown) {
            const err = error as any;
            if (err.response?.status === 400 && err.response?.data?.restrictions) {
                setRestrictions(err.response.data.restrictions)
                setIsRestrictionsDialogOpen(true)
                setIsConfirmModalOpen(false)
                if (isRestrictionsDialogOpen) {
                    toast.error("Aún existen dependencias por resolver.")
                }
            } else {
                toast.error("Error al archivar producto")
            }
        } finally {
            setIsRetrying(false)
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
        } catch (error: unknown) {
            console.error("Error triggering inspection:", error)
            showApiError(error, "Error al ejecutar inspección")
        }
    }

    const handleResume = async (id: number) => {
        try {
            await api.post(`/inventory/subscriptions/${id}/resume/`)
            toast.success("Suscripción reactivada")
            fetchSubscriptions()
            fetchStats()
        } catch (error: unknown) {
            showApiError(error, "Error al reactivar suscripción")
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
                <DataTableColumnHeader column={column} title="Producto" className="justify-center" />
            ),
            accessorFn: (row) => row.product_name,
            cell: ({ row }) => {
                const sub = row.original;
                return (
                    <div className="flex flex-col items-center gap-1 py-1">
                        <span className="font-medium text-xs leading-tight text-center">{sub.product_name}</span>
                        <div className="flex flex-wrap justify-center gap-1">
                            {sub.product_internal_code && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase text-center">
                                    {sub.product_internal_code}
                                </Badge>
                            )}
                            {sub.product_code && sub.product_code !== sub.product_internal_code && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal opacity-80 uppercase text-center">
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
                <DataTableColumnHeader column={column} title="Categoría" className="justify-center" />
            ),
            cell: ({ row }) => <DataCell.Text className="text-xs text-center">{row.getValue("category_name")}</DataCell.Text>,
        },
        {
            accessorKey: "supplier_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor" className="justify-center" />
            ),
            cell: ({ row }) => <div className="text-center"><DataCell.Text>{row.getValue("supplier_name")}</DataCell.Text></div>,
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center"><DataCell.Currency value={row.getValue("amount")} /></div>,
        },
        {
            id: "frequency",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Frecuencia" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="text-center">
                    <DataCell.Secondary className="text-foreground">{getPaymentScheduleText(row.original)}</DataCell.Secondary>
                </div>
            ),
        },
        {
            accessorKey: "next_payment_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Próximo Pago" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center"><DataCell.Date value={row.getValue("next_payment_date")} /></div>,
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DataCell.Status
                        status={row.getValue("status")}
                        map={{
                            ACTIVE: "success",
                            PAUSED: "warning",
                            CANCELLED: "destructive",
                            PENDING: "secondary"
                        }}
                    />
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => {
                const sub = row.original
                return (
                    <div className="flex gap-2 justify-center">
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
                                className="h-8 w-8 text-amber-700 hover:text-amber-700 hover:bg-yellow-50"
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
                                className="h-8 w-8 text-emerald-700 hover:text-emerald-700 hover:bg-green-50"
                                onClick={() => handleResume(sub.id)}
                                title="Reanudar Suscripción"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-blue-50"
                            onClick={() => {
                                setCurrentHistorySubscriptionId(sub.id)
                                setIsHistoryOpen(true)
                            }}
                            title="Ver Historial"
                        >
                            <History className="h-4 w-4" />
                        </Button>

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
        <div className={cn(LAYOUT_TOKENS.view, hideHeader && "pt-0")}>
            {!hideHeader && (
                <PageHeader
                    title="Suscripciones y Recurrentes"
                    description="Gestión de servicios mensuales, contratos y facturación automática."
                    variant="minimal"
                    iconName="calendar-clock"
                    titleActions={
                        <PageHeaderButton
                            onClick={() => {
                                setEditingProduct(null)
                                setIsFormOpen(true)
                            }}
                            iconName="plus"
                            circular
                            title="Nueva Suscripción"
                        />
                    }
                >
                    <div className="flex items-center gap-2">
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
                </PageHeader>
            )}

            <div className="space-y-4">
                {hideHeader && (
                    <div className="flex justify-end mb-4">
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
                )}
                {loading ? (
                    <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center text-muted-foreground">
                        Cargando suscripciones...
                    </div>
                ) : (
                    <div className="">
                        <DataTable
                            columns={columns}
                            data={subscriptions}
                            cardMode
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
                open={isFormOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsFormOpen(true)
                    }
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
                        <div className="bg-amber-100/10 border border-amber-500/20 p-3 rounded-lg flex gap-3 text-amber-500">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <div className="text-xs">
                                <p className="font-bold mb-1">Impacto en Suscripciones</p>
                                <p>Al archivar este producto, esta suscripción se ocultará de la lista.</p>
                            </div>
                        </div>
                    </div>
                }
            />

            <SubscriptionHistoryModal
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                subscriptionId={currentHistorySubscriptionId}
            />

            <ArchivingRestrictionsDialog
                open={isRestrictionsDialogOpen}
                onOpenChange={setIsRestrictionsDialogOpen}
                productName={currentArchivingProduct?.name || ""}
                restrictions={restrictions}
                onRetry={handleArchive}
                isRetrying={isRetrying}
            />
        </div>
    )
}
