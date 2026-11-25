"use client"

import React, { useMemo, useState } from "react"
import { AnalyticsPanelContent, EmptyState, SkeletonShell, type Granularity } from '@/components/shared'
import { Button } from "@/components/ui/button"
import {
    Collection,
    GROUP_ROW_LIMIT,
    useCollectionAnalytics,
    useCollectionQuery,
    useCollectionViewMode,
    useEntityCollection,
    useServerPage,
    type CollectionViewMode,
} from "@/components/entity-view"
import { DocumentRowActions } from "@/features/orders"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { EMPTY_SALES_ANALYTICS, useSaleOrderAnalytics, useSaleOrderGroups, useSalesNotes, useSalesOrders } from "@/features/sales"
import { AlertTriangle } from "lucide-react"
import type { SaleOrderFilters } from "@/features/sales/types"
import { saleOrderEntity, saleOrderViews } from "../entity-view/saleOrder.entity"
import { saleNoteEntity, saleNoteViews } from "../entity-view/saleNote.entity"
import { buildSalesAnalyticsScreen } from "./saleOrderAnalyticsScreen"

interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    onSelectOrder?: (id: number | null) => void
    selectedId?: number | null
}

/** Shared selection: the document sheet (one tab per document, ADR-0152) or, in POS, the host's own selection. */
interface SheetSelection {
    selectedId: number | null
    toggle: (id: number, data?: unknown) => void
}

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }


export function SalesOrdersView({ viewMode, onSelectOrder, selectedId }: SalesOrdersViewProps) {
    // ?selected abre la ficha documental en la pila (ADR-0083): OV en "orders", factura/nota
    // en "notes". Con onSelectOrder (POS) la lista solo selecciona; el panel lo pone el host.
    const sheet = useDocumentSheetRoute(onSelectOrder ? null : (viewMode === "orders" ? "sales.saleorder" : "billing.invoice"))
    const selection: SheetSelection = onSelectOrder
        ? { selectedId: selectedId ?? null, toggle: (id) => onSelectOrder(selectedId === id ? null : id) }
        : { selectedId: sheet.selectedId ?? null, toggle: (id, data) => sheet.toggle(id, data) }

    // One collection per mode, each with its own hook: the hidden mode no longer fetches.
    return viewMode === "orders"
        ? <SaleOrderCollection selection={selection} withActions={!onSelectOrder} />
        : <SaleNoteCollection selection={selection} withActions={!onSelectOrder} />
}

/**
 * Vista (tabla / tarjetas / analítica) de la lista. En la página es estado de URL y preferencia guardada
 * (`?view=`); embebida en el POS (`withActions` falso) es local al drawer: no toca la URL del POS ni la
 * preferencia de la página de Ventas.
 */
interface ViewState { view: CollectionViewMode; onViewChange: (view: CollectionViewMode) => void }
type CollectionProps = { selection: SheetSelection; withActions: boolean }

function useLocalViewMode(initial: CollectionViewMode): ViewState {
    const [view, onViewChange] = useState<CollectionViewMode>(initial)
    return { view, onViewChange }
}

function SaleOrderCollection(props: CollectionProps) {
    return props.withActions ? <UrlSaleOrderCollection {...props} /> : <LocalSaleOrderCollection {...props} />
}
function UrlSaleOrderCollection(props: CollectionProps) {
    return <SaleOrderCollectionBody {...props} {...useCollectionViewMode("sales.saleorder")} />
}
function LocalSaleOrderCollection(props: CollectionProps) {
    return <SaleOrderCollectionBody {...props} {...useLocalViewMode("card")} />
}

function SaleNoteCollection(props: CollectionProps) {
    return props.withActions ? <UrlSaleNoteCollection {...props} /> : <LocalSaleNoteCollection {...props} />
}
function UrlSaleNoteCollection(props: CollectionProps) {
    return <SaleNoteCollectionBody {...props} {...useCollectionViewMode("billing.invoice")} />
}
function LocalSaleNoteCollection(props: CollectionProps) {
    return <SaleNoteCollectionBody {...props} {...useLocalViewMode("card")} />
}

/** Pilot of the command bar (ADR-0158 stage 3c): search, filters, sort, grouping and views come from `saleOrderEntity.query`. */
function SaleOrderCollectionBody({ selection, withActions, view, onViewChange }: CollectionProps & ViewState) {
    const query = useCollectionQuery(saleOrderEntity)
    const { groupBy, groupKey, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)

    // Grouping by a field with a server key groups the whole result (`groups/`, ADR-0158 §7).
    const grouped = useSaleOrderGroups({ groupKey, params })
    const list = useSalesOrders({
        filters: {
            ...params,
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
        enabled: groupKey === null,
    })
    const { page, orders } = list
    const { isLoading, isRefetching, isError, refetch } = groupKey ? grouped : list

    // Figures over the filtered list (or everything, «Analizar sin filtros»), fetched only while the modal is open.
    const analyticsUi = useCollectionAnalytics("resumen")
    const analyticsFilters = useMemo<SaleOrderFilters | undefined>(() => {
        if (analyticsUi.scope === "all") return undefined
        // Sorting does not change the figures: leave it out so a sort does not refetch.
        const filters: SaleOrderFilters = { ...params }
        delete filters.ordering
        return filters
    }, [params, analyticsUi.scope])
    const [granularity, setGranularity] = useState<Granularity>("month")
    const { analytics, isLoading: isLoadingAnalytics, isError: isAnalyticsError, refetch: refetchAnalytics } = useSaleOrderAnalytics({ filters: analyticsFilters, granularity, enabled: analyticsUi.open })
    const analyticsScreen = useMemo(
        () => buildSalesAnalyticsScreen(analytics ?? EMPTY_SALES_ANALYTICS, { activeTab: analyticsUi.tab, onTabChange: analyticsUi.onTabChange, granularity, onGranularityChange: setGranularity }),
        [analytics, analyticsUi.tab, analyticsUi.onTabChange, granularity],
    )

    const collection = useEntityCollection(
        saleOrderEntity,
        { rows: orders, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: query.search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: query.sorting,
            groupBy,
            serverGroups: grouped.groups,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={selection.selectedId}
                onOpen={(order) => selection.toggle(order.id, order)}
                actions={withActions ? (order) => <DocumentRowActions id={order.id} kind="sale-order" onOpen={selection.toggle} /> : undefined}
                view={view}
                onViewChange={onViewChange}
                analytics={analyticsUi}
                query={query}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={saleOrderViews.table}
                    card={saleOrderViews.card}
                    emptyTitle="Aún no hay órdenes de venta"
                    emptyDescription="Crea una orden de venta o regístrala desde el punto de venta."
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

function SaleNoteCollectionBody({ selection, withActions, view, onViewChange }: CollectionProps & ViewState) {
    const query = useCollectionQuery(saleNoteEntity)
    const { groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)

    const { page, notes, isLoading, isRefetching, isError, refetch } = useSalesNotes({
        filters: {
            ...params,
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    const collection = useEntityCollection(
        saleNoteEntity,
        { rows: notes, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: query.search.isFiltered },
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
                selection="panel"
                selectedId={selection.selectedId}
                onOpen={(note) => selection.toggle(note.id, note)}
                actions={withActions ? (note) => <DocumentRowActions id={note.id} kind="invoice" onOpen={selection.toggle} /> : undefined}
                view={view}
                onViewChange={onViewChange}
                query={query}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={saleNoteViews.table}
                    card={saleNoteViews.card}
                    emptyTitle="Aún no hay notas"
                    emptyDescription="Las notas de crédito y débito asociadas a tus ventas aparecerán aquí."
                    onResetFilters={query.search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
