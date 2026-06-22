"use client"

import { showApiError } from "@/lib/errors"

import { useState, useMemo, useCallback, useEffect } from "react"
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

import { ActionConfirmModal, Chip, EntityCard, StatusBadge } from '@/components/shared'
import { ProductDrawer } from "@/features/inventory/components/ProductDrawer"
import { SubscriptionHistoryModal } from "@/features/inventory/components/SubscriptionHistoryModal"
import { ArchivingRestrictionsModal } from "@/features/inventory/components/ArchivingRestrictionsModal"
import { DataTableView } from '@/components/shared'
import type { Product } from "@/types/entities"
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell } from '@/components/shared'
import type { KpiCardDef } from '@/components/shared'
import { subscriptionActions, type SubscriptionActionsCtx } from "@/features/inventory/subscriptionActions"
import { PageHeader, PageHeaderButton, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"
import { Restriction } from "@/features/inventory/types"
import { PageContainer } from "@/components/shared"
import { cn } from "@/lib/utils"
import { useSubscriptions, useSubscriptionStats, type Subscription } from "@/features/inventory/hooks/useSubscriptions"
import { useProducts } from "@/features/inventory/hooks/useProducts"
import { subscriptionSearchDef } from "@/features/inventory/searchDef"
import { subscriptionSegDef } from "@/features/inventory/segmentationDef"

// Subscription type imported from useSubscriptions hook

interface Stats {
    active_subscriptions: number
    paused_subscriptions: number
    cancelled_subscriptions: number
    total_monthly_cost: number
    upcoming_renewals_30_days: number
}

interface SubscriptionsClientViewProps {
    hideHeader?: boolean
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export function SubscriptionsClientView({ hideHeader = false, externalOpen = false, createAction }: SubscriptionsClientViewProps) {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(subscriptionSearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(subscriptionSegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = useMemo(() => ({ ...textFilters, ...segFilters }), [textFilters, segFilters])
    const { subscriptions, isLoading: loading, refetch: fetchSubscriptions, pauseSubscription, resumeSubscription } = useSubscriptions(allFilters)
    const { data: stats } = useSubscriptionStats<Stats>()
    const kpiCards = useMemo<KpiCardDef[] | undefined>(() => {
        if (!stats) return undefined
        return [
            {
                label: "Suscripciones Activas",
                value: stats.active_subscriptions,
                variant: "minimal",
                accent: "muted",
                className: "bg-card/50 shadow-card flex-col gap-1 items-center md:items-start p-4 rounded-md",
            },
            {
                label: "Costo Mensual Total",
                value: <DataCell.Currency value={stats.total_monthly_cost} />,
                variant: "minimal",
                accent: "muted",
                className: "bg-card/50 shadow-card flex-col gap-1 items-center md:items-start p-4 rounded-md",
            },
            {
                label: "Próximas Renovaciones",
                value: stats.upcoming_renewals_30_days,
                variant: "minimal",
                accent: "warning",
                className: "bg-card/50 shadow-card flex-col gap-1 items-center md:items-start p-4 rounded-md",
            },
            {
                label: "Estado Pausadas",
                value: stats.paused_subscriptions,
                variant: "minimal",
                accent: "muted",
                className: "bg-card/50 shadow-card flex-col gap-1 items-center md:items-start p-4 rounded-md",
            },
        ]
    }, [stats])
    const { updateProduct, fetchProductById } = useProducts()

    // Archive confirmation state (local — not URL-driven, it's a transient flow)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [currentArchivingProduct, setCurrentArchivingProduct] = useState<{ id: number, name: string } | null>(null)
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const [isRestrictionsDialogOpen, setIsRestrictionsDialogOpen] = useState(false)
    const [isRetrying, setIsRetrying] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // URL-driven state
    const selectedId = searchParams.get("selected") ? Number(searchParams.get("selected")) : null
    const action = searchParams.get("action")
    const isCreateOpen = searchParams.get("modal") === "new" || !!externalOpen
    const isEditOpen = isCreateOpen || (!!selectedId && action === "edit")
    const isHistoryOpen = !!selectedId && action === "history"

    // Find subscription from the local list
    const selectedSubscription = useMemo(
        () => selectedId && (action === "edit" || action === "history")
            ? subscriptions.find(s => s.id === selectedId) ?? null
            : null,
        [selectedId, action, subscriptions],
    )

    // Fetch product for edit mode
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    useEffect(() => {
        if (selectedSubscription && action === "edit") {
            fetchProductById(selectedSubscription.product).then((p) => setEditingProduct(p as Product)).catch(() => {})
        } else if (!isEditOpen) {
            setEditingProduct(null)
        }
    }, [selectedSubscription, action, fetchProductById, isEditOpen])

    const clearAll = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        const changed = params.has("selected") || params.has("action") || params.has("modal")
        params.delete("selected")
        params.delete("action")
        params.delete("modal")
        if (changed) {
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [router, pathname, searchParams])

    const openSubscription = useCallback((id: number, actionType: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        params.set("action", actionType)
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

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
            await updateProduct({ id: currentArchivingProduct.id, payload: { is_active: false } as never })
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

    const actionsCtx: SubscriptionActionsCtx = {
        onEdit: (productId) => {
            const sub = subscriptions.find(s => s.product === productId)
            if (sub) openSubscription(sub.id, "edit")
        },
        onPause: (id) => handlePause(id),
        onResume: (id) => handleResume(id),
        onViewHistory: (id) => openSubscription(id, "history"),
        onArchive: (product) => {
            setCurrentArchivingProduct(product)
            setIsConfirmModalOpen(true)
        },
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
        subscriptionActions.column(actionsCtx),
    ], [actionsCtx])

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
                    await Promise.all(items.map(s => updateProduct({ id: s.product, payload: { is_active: false } as never })))
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
                                const params = new URLSearchParams(searchParams.toString())
                                params.set("modal", "new")
                                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
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
                    <div className="flex-1 min-h-0">
                        <DataTableView
                            kpiCards={kpiCards}
                            entityLabel="inventory.subscription"
                            columns={columns}
                            data={subscriptions}
                            isLoading={loading}
                            variant="embedded"
                            smartSearch={<SmartSearchBar searchDef={subscriptionSearchDef} placeholder="Buscar suscripciones..." className="w-full" />}
                            segmentation={<SegmentationBar def={subscriptionSegDef} basePeriod={basePeriod} />}
                            showReset={isFiltered}
                            onReset={() => { clearText(); clearSeg() }}
                            defaultPageSize={20}
                            bulkActions={bulkActions}
                            createAction={createAction}
                            isFiltered={isFiltered}
                            emptyState={{
                                context: "generic",
                                title: "Aún no hay suscripciones",
                                description: "Crea una suscripción para gestionar cobros o pagos recurrentes.",
                            }}
                            renderCard={(sub: Subscription) => (
                                <EntityCard key={sub.id} onClick={() => openSubscription(sub.id, "edit")}>
                                    <EntityCard.Header
                                        title={sub.product_name}
                                        subtitle={`${sub.recurrence_display || ''}${sub.amount ? ` - $${sub.amount}` : ''}`}
                                        trailing={<StatusBadge status={sub.status} label={sub.status_display || sub.status} size="sm" />}
                                    />
                                    <EntityCard.Body actions={subscriptionActions.render(sub, actionsCtx)}>
                                        <EntityCard.Field label="Categoría" value={sub.category_name || '-'} />
                                        <EntityCard.Field label="Proveedor" value={sub.supplier_name || '-'} />
                                        {sub.next_payment_date && (
                                            <EntityCard.Field label="Próximo Pago" value={sub.next_payment_date} />
                                        )}
                                    </EntityCard.Body>
                                </EntityCard>
                            )}
                        />
                    </div>
                </div>
            </div>

            <ProductDrawer
                open={isEditOpen}
                onOpenChange={(open) => {
                    if (!open) clearAll()
                }}
                initialData={editingProduct || undefined}
                onSuccess={() => {
                    clearAll()
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
                onOpenChange={(open) => { if (!open) clearAll() }}
                subscriptionId={selectedSubscription?.id ?? null}
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
