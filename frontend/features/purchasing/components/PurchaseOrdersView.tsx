"use client"

import React, { useMemo, useState } from "react"
import { AnalyticsPanelContent, EmptyState, SkeletonShell, type Granularity } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
    Collection,
    GROUP_ROW_LIMIT,
    useCollectionAnalytics,
    useCollectionQuery,
    useCollectionViewMode,
    useEntityCollection,
    useServerPage,
} from "@/components/entity-view"
import { DocumentRowActions } from "@/features/orders"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { AlertTriangle } from "lucide-react"
import type { OrderFilters } from "../api/purchasingApi"
import { purchaseOrderEntity, purchaseOrderViews } from "../entity-view/purchaseOrder.entity"
import { purchaseNoteEntity, purchaseNoteViews } from "../entity-view/purchaseNote.entity"
import { EMPTY_PURCHASING_ANALYTICS, usePurchaseOrderAnalytics } from "../hooks/usePurchaseOrderAnalytics"
import { usePurchasingNotes, usePurchasingOrders } from "../hooks/usePurchasing"
import { buildPurchaseAnalyticsScreen } from "./purchaseOrderAnalyticsScreen"

interface PurchaseOrdersViewProps {
    viewMode: "orders" | "notes"
    createAction?: React.ReactNode
}

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */

/** Purchase orders or their credit/debit notes (ADR-0087 lote 2c); ?selected opens the document sheet (ADR-0083). */
export function PurchaseOrdersView({ viewMode, createAction }: PurchaseOrdersViewProps) {
    // One collection per mode, each with its own hook: the hidden mode does not fetch.
    return viewMode === "orders" ? <PurchaseOrderCollection createAction={createAction} /> : <PurchaseNoteCollection />
}

function PurchaseOrderCollection({ createAction }: { createAction?: React.ReactNode }) {
    const sheet = useDocumentSheetRoute("purchasing.purchaseorder")
    const query = useCollectionQuery(purchaseOrderEntity)
    const { groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("purchasing.purchaseorder")

    const { page, orders, isLoading, isRefetching, isError, refetch } = usePurchasingOrders({
        filters: {
            ...params,
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    // Figures over the filtered list (or everything, «Analizar sin filtros»), fetched only while the modal is open.
    const analyticsUi = useCollectionAnalytics("financiero")
    const analyticsFilters = useMemo<OrderFilters | undefined>(() => {
        if (analyticsUi.scope === "all") return undefined
        // Sorting does not change the figures: leave it out so a sort does not refetch.
        const filters: OrderFilters = { ...params }
        delete filters.ordering
        return filters
    }, [params, analyticsUi.scope])
    const [granularity, setGranularity] = useState<Granularity>("month")
    const { analytics, isLoading: isLoadingAnalytics, isError: isAnalyticsError, refetch: refetchAnalytics } = usePurchaseOrderAnalytics({ filters: analyticsFilters, granularity, enabled: analyticsUi.open })
    const analyticsScreen = useMemo(
        () => buildPurchaseAnalyticsScreen(analytics ?? EMPTY_PURCHASING_ANALYTICS, { activeTab: analyticsUi.tab, onTabChange: analyticsUi.onTabChange, granularity, onGranularityChange: setGranularity }),
        [analytics, analyticsUi.tab, analyticsUi.onTabChange, granularity],
    )

    const collection = useEntityCollection(
        purchaseOrderEntity,
        { rows: orders, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: query.search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: query.sorting,
            groupBy,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(order) => sheet.toggle(order.id, order)}
                actions={(order) => <DocumentRowActions id={order.id} kind="purchase-order" onOpen={sheet.toggle} />}
                view={view}
                onViewChange={onViewChange}
                analytics={analyticsUi}
                query={query}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={purchaseOrderViews.table}
                    card={purchaseOrderViews.card}
                    emptyTitle="Aún no hay órdenes de compra"
                    emptyDescription="Crea una orden de compra para registrar tus adquisiciones a proveedores."
                    emptyAction={createAction}
                    onResetFilters={query.search.clearAll}
                />
                <Collection.Analytics>
                    {isAnalyticsError ? (
                        <EmptyState
                            icon={AlertTriangle}
                            context="generic"
                            title="No pudimos cargar la analítica"
                            description="Revisa tu conexión e intenta nuevamente."
                            action={<Button variant="outline" size="sm" onClick={() => void refetchAnalytics()}>Reintentar</Button>}
                        />
                    ) : (
                        // Zeros under a shimmer while loading: never shown as real figures.
                        <SkeletonShell isLoading={isLoadingAnalytics} ariaLabel="Cargando analítica" className="flex min-h-0 flex-1 flex-col">
                            <AnalyticsPanelContent {...analyticsScreen} />
                        </SkeletonShell>
                    )}
                </Collection.Analytics>
            </Collection.Root>
        </div>
    )
}

function PurchaseNoteCollection() {
    const sheet = useDocumentSheetRoute("billing.invoice")
    const query = useCollectionQuery(purchaseNoteEntity)
    const { search, groupBy } = query
    const filters = query.params
    const [pageState, setPageState] = useServerPage([filters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const { page, notes, isLoading, isRefetching, isError, refetch } = usePurchasingNotes({
        filters,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        purchaseNoteEntity,
        { rows: notes, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            // No `sorting`: with server pagination the core disables sorting (invoices have no server ordering yet).
            groupBy,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(note) => sheet.toggle(note.id, note)}
                actions={(note) => <DocumentRowActions id={note.id} kind="invoice" onOpen={sheet.toggle} />}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={purchaseNoteViews.table}
                    card={purchaseNoteViews.card}
                    emptyTitle="Aún no hay notas de compra"
                    emptyDescription="Las notas asociadas a tus documentos de compra aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
