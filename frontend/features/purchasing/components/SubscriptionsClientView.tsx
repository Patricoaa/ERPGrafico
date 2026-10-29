"use client"

import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { EntityPanelTab } from "@/components/providers"
import { showApiError } from "@/lib/errors"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Pause, Play, AlertCircle, Archive } from "lucide-react"
import { toast } from "sonner"
import {
    ActionConfirmModal,
    DataCell,
    PageHeader,
    PageHeaderButton,
    StatCard,
    UnifiedSearchBar,
    bindUnifiedSearch,
    useUnifiedSearch,
    type BulkAction,
    type KpiCardDef,
} from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { ProductDrawer, ArchivingRestrictionsModal, useProducts, type Restriction } from "@/features/inventory"
import type { ProductInitialData } from "@/types/forms"
import type { Product } from "@/types/entities"
import { SubscriptionHistoryModal } from "./SubscriptionHistoryModal"
import { subscriptionActions, type SubscriptionActionsCtx } from "../subscriptionActions"
import { useSubscriptions, useSubscriptionStats, type Subscription } from "../hooks/useSubscriptions"
import { subscriptionUnifiedSearchDef } from "../unifiedSearchDef"
import { subscriptionEntity, subscriptionViews } from "../entity-view/subscription.entity"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const SUBSCRIPTION_GROUPS: Record<string, FieldId<typeof subscriptionEntity.fields>> = { status: "status", recurrence_period: "period" }

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
    const search = useUnifiedSearch(subscriptionUnifiedSearchDef)
    const { subscriptions, isLoading: loading, isError, refetch: fetchSubscriptions, pauseSubscription, resumeSubscription } = useSubscriptions(search.filters)
    const groupBy = search.groupBy ? SUBSCRIPTION_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("inventory.subscription")
    const collection = useEntityCollection(
        subscriptionEntity,
        { rows: subscriptions, isLoading: loading, error: isError, refetch: fetchSubscriptions, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy },
    )
    const { data: stats } = useSubscriptionStats<Stats>()
    const kpiCards = useMemo<KpiCardDef[] | undefined>(() => {
        if (!stats) return undefined
        return [
            {
                label: "Suscripciones Activas",
                value: stats.active_subscriptions,
                variant: "minimal",
                accent: "muted",
                className: "gap-1 items-center md:items-start p-4",
            },
            {
                label: "Costo Mensual Total",
                value: <DataCell.Currency value={stats.total_monthly_cost} />,
                variant: "minimal",
                accent: "muted",
                className: "gap-1 items-center md:items-start p-4",
            },
            {
                label: "Próximas Renovaciones",
                value: stats.upcoming_renewals_30_days,
                variant: "minimal",
                accent: "warning",
                className: "gap-1 items-center md:items-start p-4",
            },
            {
                label: "Estado Pausadas",
                value: stats.paused_subscriptions,
                variant: "minimal",
                accent: "muted",
                className: "gap-1 items-center md:items-start p-4",
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
    // Crear (`?modal=new`) o editar (`?selected&action=edit`) comparten el drawer de producto.
    const formPanel = useEntityPanelRoute({ actions: ['edit'], external: { open: externalOpen } })
    const isEditOpen = formPanel.open
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
    const [prevEditOpen, setPrevEditOpen] = useState(isEditOpen)
    // Adjust state during render: reset editing product when form closes
    if (!isEditOpen && isEditOpen !== prevEditOpen) {
        setPrevEditOpen(isEditOpen)
        setEditingProduct(null)
    }
    useEffect(() => {
        if (selectedSubscription && action === "edit") {
            fetchProductById(selectedSubscription.product).then((p) => setEditingProduct(p as Product)).catch(() => {})
        }
    }, [selectedSubscription, action, fetchProductById])

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

    const actionsCtx: SubscriptionActionsCtx = useMemo(() => ({
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
    }), [subscriptions, handlePause, handleResume, openSubscription])

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
        <div className="flex-1 min-h-0 flex flex-col">
            {!hideHeader && (
                <PageHeader
                    title="Suscripciones"
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

            {kpiCards && (
                <div className="grid shrink-0 gap-4 md:grid-cols-4">
                    {kpiCards.map((card) => <StatCard key={card.label} {...card} loading={loading} />)}
                </div>
            )}

            <Collection.Root
                collection={collection}
                selection="bulk"
                view={view}
                onViewChange={onViewChange}
                onOpen={(sub) => openSubscription(sub.id, "edit")}
                actions={subscriptionActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={subscriptionUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar suscripciones..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={subscriptionViews.table}
                    card={subscriptionViews.card}
                    emptyTitle="Aún no hay suscripciones"
                    emptyDescription="Crea una suscripción para gestionar cobros o pagos recurrentes."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
                <Collection.BulkBar actions={bulkActions} />
            </Collection.Root>

            <EntityPanelTab label="inventory.subscription" {...formPanel.tab}>
                {(open) => (
                    <ProductDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) formPanel.close() }}
                        initialData={(editingProduct || undefined) as ProductInitialData | undefined}
                        onSuccess={() => {
                            formPanel.close()
                            fetchSubscriptions()
                        }}
                        lockedType="SUBSCRIPTION"
                    />
                )}
            </EntityPanelTab>

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
        </div>
    )
}
