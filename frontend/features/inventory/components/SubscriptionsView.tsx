"use client"

import { showApiError } from "@/lib/errors"

import { useState, useMemo, useCallback } from "react"
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
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { StatusBadge, Chip } from "@/components/shared"
import { ProductForm } from "@/features/inventory/components/ProductForm"
import { SubscriptionHistoryModal } from "@/features/inventory/components/SubscriptionHistoryModal"
import { ArchivingRestrictionsModal } from "@/features/inventory/components/ArchivingRestrictionsModal"
import { DataTable } from '@/components/shared'
import type { Product } from "@/types/entities"
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, createActionsColumn, StatCard } from '@/components/shared'
import { PageHeader, PageHeaderButton, SmartSearchBar, useSmartSearch } from "@/components/shared"
import { Restriction } from "@/features/inventory/types"
import { PageContainer } from "@/components/shared"
import { cn } from "@/lib/utils"
import { useSubscriptions, useSubscriptionStats, type Subscription } from "@/features/inventory/hooks/useSubscriptions"
import { useProducts } from "@/features/inventory/hooks/useProducts"
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
    const { subscriptions, isLoading: loading, refetch: fetchSubscriptions, pauseSubscription, resumeSubscription } = useSubscriptions(filters)
    const { data: stats } = useSubscriptionStats<Stats>()
    const { updateProduct, fetchProductById } = useProducts()

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

    // stats viene reactivo de useSubscriptionStats (declarado al inicio).
    // pause/resume invalidan SUBSCRIPTIONS + PRODUCTS_KEYS automáticamente.

    const handlePause = useCallback(async (id: number) => {
        try {
            await pauseSubscription(id)
            toast.success("Suscripción pausada")
        } catch (error: unknown) {
            showApiError(error, "Error al pausar suscripción")
        }
    }, [pauseSubscription])

    const handleArchive = useCallback(async () => {
        if (!currentArchivingProduct) return

        if (isRestrictionsDialogOpen) {
            setIsRetrying(true)
        }

        try {
            await updateProduct({ id: currentArchivingProduct.id, payload: { active: false } as never })
            toast.success("Producto archivado correctamente")
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
    }, [currentArchivingProduct, isRestrictionsDialogOpen, updateProduct])

    const openEditForm = useCallback(async (productId: number) => {
        try {
            // fetchProductById usa cache de TanStack Query si está fresh, fetch en otro caso.
            const product = await fetchProductById(productId)
            setEditingProduct(product as Product)
            setIsFormOpen(true)
        } catch (error) {
            console.error("Error fetching product details:", error)
            showApiError(error, "Error al cargar detalles del producto")
        }
    }, [fetchProductById])



    const handleResume = useCallback(async (id: number) => {
        try {
            await resumeSubscription(id)
            toast.success("Suscripción reactivada")
        } catch (error: unknown) {
            showApiError(error, "Error al reactivar suscripción")
        }
    }, [resumeSubscription])

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
                                <Chip size="xs" className="opacity-80">{sub.product_internal_code}</Chip>
                            )}
                            {sub.product_code && sub.product_code !== sub.product_internal_code && (
                                <Chip size="xs" intent="primary" className="opacity-80">{sub.product_code}</Chip>
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
                        <DataCell.Text className="font-normal">
                            {value || "Sin Categoría"}
                        </DataCell.Text>
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
                    <DataCell.Text className="font-normal">{getPaymentScheduleText(row.original)}</DataCell.Text>
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
                    await Promise.all(items.map(s => pauseSubscription(s.id)))
                    toast.success(`${items.length} suscripciones pausadas`)
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
                    await Promise.all(items.map(s => resumeSubscription(s.id)))
                    toast.success(`${items.length} suscripciones reactivadas`)
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
                    await Promise.all(items.map(s => updateProduct({ id: s.product, payload: { active: false } as never })))
                    toast.success(`${items.length} productos de suscripción archivados`)
                } catch (error) {
                    showApiError(error, "Error al archivar suscripciones")
                }
            },
        },
    ], [pauseSubscription, resumeSubscription, updateProduct])

    return (
        <PageContainer className={cn("h-full flex flex-col", hideHeader && "pt-0")}>
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


            <div className="flex-1 h-full flex flex-col">


                <div className="flex-1 min-h-0 flex flex-col space-y-6">
                    {/* Industrial Stats Panel */}
                    {stats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                label="Suscripciones Activas"
                                value={stats.active_subscriptions}
                                variant="minimal"
                                accent="muted"
                                className="bg-card/50 shadow-sm flex-col gap-1 items-center md:items-start p-4 rounded-md"
                            />
                            <StatCard
                                label="Costo Mensual Total"
                                value={<DataCell.Currency value={stats.total_monthly_cost} />}
                                variant="minimal"
                                accent="muted"
                                className="bg-card/50 shadow-sm flex-col gap-1 items-center md:items-start p-4 rounded-md"
                            />
                            <StatCard
                                label="Próximas Renovaciones"
                                value={stats.upcoming_renewals_30_days}
                                variant="minimal"
                                accent="warning"
                                className="bg-card/50 shadow-sm flex-col gap-1 items-center md:items-start p-4 rounded-md"
                            />
                            <StatCard
                                label="Estado Pausadas"
                                value={stats.paused_subscriptions}
                                variant="minimal"
                                accent="muted"
                                className="bg-card/50 shadow-sm flex-col gap-1 items-center md:items-start p-4 rounded-md"
                            />
                        </div>
                    )}
                    <div className="flex-1 min-h-0">
                        <DataTable
                            columns={columns}
                            data={subscriptions}
                            isLoading={loading}
                            variant="embedded"
                            leftAction={<SmartSearchBar searchDef={subscriptionSearchDef} placeholder="Buscar suscripciones..." className="w-full" />}
                            defaultPageSize={20}
                            bulkActions={bulkActions}
                            createAction={createAction}
                        />
                    </div>
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
