"use client"

import { showApiError } from "@/lib/errors"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
    ColumnDef
} from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import type { BulkAction } from "@/components/shared"
import {
    Pause,
    Play,
    AlertCircle,
    Pencil,
    Archive,
    History
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ProductForm } from "@/features/inventory/components/ProductForm"
import { SubscriptionHistoryModal } from "@/features/inventory/components/SubscriptionHistoryModal"
import { ArchivingRestrictionsModal } from "@/features/inventory/components/ArchivingRestrictionsModal"
import { DataTable } from "@/components/ui/data-table"
import type { Product } from "@/types/entities"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { PageHeader, PageHeaderButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { Restriction } from "@/features/inventory/types"
import { PageContainer } from "@/components/shared"
import { cn } from "@/lib/utils"
import { useSubscriptions, type Subscription } from "@/features/inventory/hooks/useSubscriptions"
import { subscriptionSearchDef } from "@/features/inventory/searchDef"

// Subscription type imported from useSubscriptions hook

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
    createAction?: React.ReactNode
}

export function SubscriptionsView({ hideHeader = false, externalOpen = false, createAction }: SubscriptionsViewProps) {
    const { filters } = useSmartSearch(subscriptionSearchDef)
    const { subscriptions, isLoading: loading, refetch: fetchSubscriptions } = useSubscriptions(filters)
    const [stats, setStats] = useState<Stats | null>(null)

    // Form & Actions state
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
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

    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/inventory/subscriptions/stats/')
            setStats(response.data)
        } catch (error) {
            console.error("Error fetching stats:", error)
        }
    }, [])

    useEffect(() => {
        fetchStats()
    }, [])

    const handlePause = useCallback(async (id: number) => {
        try {
            await api.post(`/inventory/subscriptions/${id}/pause/`)
            toast.success("Suscripción pausada")
            fetchSubscriptions()
            fetchStats()
        } catch (error: unknown) {
            showApiError(error, "Error al pausar suscripción")
        }
    }, [fetchSubscriptions, fetchStats])

    const handleArchive = useCallback(async () => {
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
            const err = error as { response?: { status: number, data?: { restrictions: Restriction[] } } };
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
    }, [currentArchivingProduct, isRestrictionsDialogOpen, fetchSubscriptions])

    const openEditForm = useCallback(async (productId: number) => {
        try {
            const response = await api.get(`/inventory/products/${productId}/`)
            setEditingProduct(response.data)
            setIsFormOpen(true)
        } catch (error) {
            console.error("Error fetching product details:", error)
            showApiError(error, "Error al cargar detalles del producto")
        }
    }, [])



    const handleResume = useCallback(async (id: number) => {
        try {
            await api.post(`/inventory/subscriptions/${id}/resume/`)
            toast.success("Suscripción reactivada")
            fetchSubscriptions()
            fetchStats()
        } catch (error: unknown) {
            showApiError(error, "Error al reactivar suscripción")
        }
    }, [fetchSubscriptions, fetchStats])

    const getPaymentScheduleText = (sub: Subscription) => {
        if (sub.payment_day_type === "FIXED_DAY" && sub.payment_day) {
            return `Día ${sub.payment_day} de cada ${sub.recurrence_display.toLowerCase()}`
        } else if (sub.payment_day_type === "INTERVAL" && sub.payment_interval_days) {
            return `Cada ${sub.payment_interval_days} días`
        }
        return sub.recurrence_display
    }

    const columns = useMemo<ColumnDef<Subscription>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            id: "product",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" className="justify-center" />
            ),
            accessorFn: (row) => row.product_name,
            cell: ({ row }) => {
                const sub = row.original;
                return (
                    <div className="flex flex-col items-center gap-1 py-1 w-full">
                        <DataCell.Text className="font-medium text-xs leading-tight text-center">{sub.product_name}</DataCell.Text>
                        <div className="flex flex-wrap justify-center gap-1 mt-1">
                            {sub.product_internal_code && (
                                <DataCell.Badge className="text-[10px] h-4 px-1.5 font-normal opacity-80 uppercase">
                                    {sub.product_internal_code}
                                </DataCell.Badge>
                            )}
                            {sub.product_code && sub.product_code !== sub.product_internal_code && (
                                <DataCell.Badge className="text-[10px] h-4 px-1.5 font-normal opacity-80 uppercase bg-primary/5 text-primary border-primary/20">
                                    {sub.product_code}
                                </DataCell.Badge>
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
            cell: ({ row }) => {
                const value = row.getValue("category_name") as string;
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Secondary className="text-xs text-center">
                            {value || "Sin Categoría"}
                        </DataCell.Secondary>
                    </div>
                );
            },
        },
        {
            accessorKey: "supplier_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.ContactLink 
                        contactId={row.original.supplier_id} 
                    >
                        {row.getValue("supplier_name")}
                    </DataCell.ContactLink>
                </div>
            ),
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
                    <StatusBadge
                        status={row.getValue("status")}
                    />
                </div>
            ),
        },
        createActionsColumn<Subscription>({
            renderActions: (sub) => (
                <>
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar Producto"
                        onClick={() => openEditForm(sub.product)}
                    />

                    {sub.status === "ACTIVE" && (
                        <DataCell.Action
                            icon={Pause}
                            title="Pausar Suscripción"
                            color="text-warning"
                            onClick={() => handlePause(sub.id)}
                        />
                    )}
                    {sub.status === "PAUSED" && (
                        <DataCell.Action
                            icon={Play}
                            title="Reanudar Suscripción"
                            color="text-success"
                            onClick={() => handleResume(sub.id)}
                        />
                    )}

                    <DataCell.Action
                        icon={History}
                        title="Ver Historial"
                        color="text-primary"
                        onClick={() => {
                            setCurrentHistorySubscriptionId(sub.id)
                            setIsHistoryOpen(true)
                        }}
                    />

                    <DataCell.Action
                        icon={Archive}
                        title="Archivar Producto"
                        className="text-destructive/70 hover:text-destructive"
                        onClick={() => {
                            setCurrentArchivingProduct({ id: sub.product, name: sub.product_name })
                            setIsConfirmModalOpen(true)
                        }}
                    />
                </>
            ),
        }),
    ], [handlePause, handleResume, openEditForm, handleArchive])

    const bulkActions = useMemo<BulkAction<Subscription>[]>(() => [
        {
            key: "pause",
            label: "Pausar",
            icon: Pause,
            intent: "warning",
            disabled: (items) => items.length === 0 || !items.every(s => s.status === "ACTIVE"),
            onClick: async (items) => {
                try {
                    await Promise.all(items.map(s => api.post(`/inventory/subscriptions/${s.id}/pause/`)))
                    toast.success(`${items.length} suscripciones pausadas`)
                    fetchSubscriptions()
                    fetchStats()
                } catch (error) {
                    showApiError(error, "Error al pausar suscripciones")
                }
            },
        },
        {
            key: "resume",
            label: "Reanudar",
            icon: Play,
            intent: "success",
            disabled: (items) => items.length === 0 || !items.every(s => s.status === "PAUSED"),
            onClick: async (items) => {
                try {
                    await Promise.all(items.map(s => api.post(`/inventory/subscriptions/${s.id}/resume/`)))
                    toast.success(`${items.length} suscripciones reactivadas`)
                    fetchSubscriptions()
                    fetchStats()
                } catch (error) {
                    showApiError(error, "Error al reactivar suscripciones")
                }
            },
        },
        {
            key: "archive",
            label: "Archivar",
            icon: Archive,
            intent: "destructive",
            disabled: (items) => items.length === 0 || !items.every(s => s.status === "ACTIVE" || s.status === "PAUSED"),
            onClick: async (items) => {
                try {
                    await Promise.all(items.map(s => api.patch(`/inventory/products/${s.product}/`, { active: false })))
                    toast.success(`${items.length} productos de suscripción archivados`)
                    fetchSubscriptions()
                } catch (error) {
                    showApiError(error, "Error al archivar suscripciones")
                }
            },
        },
    ], [fetchSubscriptions, fetchStats])

    return (
        <PageContainer className={cn(hideHeader && "pt-0")}>
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

                </PageHeader>
            )}

            <div className="space-y-4">

                <div className="space-y-6">
                {/* Industrial Stats Panel */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-md border bg-card/50 shadow-sm flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suscripciones Activas</span>
                            <span className="text-2xl font-black text-foreground tabular-nums">{stats.active_subscriptions}</span>
                        </div>
                        <div className="p-4 rounded-md border bg-card/50 shadow-sm flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Costo Mensual Total</span>
                            <div className="text-2xl font-black text-foreground tabular-nums">
                                <DataCell.Currency value={stats.total_monthly_cost} />
                            </div>
                        </div>
                        <div className="p-4 rounded-md border bg-card/50 shadow-sm flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximas Renovaciones</span>
                            <span className="text-2xl font-black text-warning tabular-nums">{stats.upcoming_renewals_30_days}</span>
                        </div>
                        <div className="p-4 rounded-md border bg-card/50 shadow-sm flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado Pausadas</span>
                            <span className="text-2xl font-black text-muted-foreground tabular-nums">{stats.paused_subscriptions}</span>
                        </div>
                    </div>
                )}
                <DataTable
                    columns={columns}
                    data={subscriptions}
                    isLoading={loading}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={subscriptionSearchDef} placeholder="Buscar suscripciones..." className="w-80" />}
                    defaultPageSize={20}
                    bulkActions={bulkActions}
                    createAction={createAction}
                />
            </div>
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
                initialData={editingProduct || undefined}
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
                        <div className="bg-warning/10 border border-warning/20 p-3 rounded-md flex gap-3 text-warning">
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

            <ArchivingRestrictionsModal
                open={isRestrictionsDialogOpen}
                onOpenChange={setIsRestrictionsDialogOpen}
                productName={currentArchivingProduct?.name || ""}
                restrictions={restrictions}
                onRetry={handleArchive}
                isRetrying={isRetrying}
            />
        </PageContainer>
    )
}
