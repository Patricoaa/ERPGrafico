"use client"

import React, { useMemo, useState } from "react"
import { AnalyticsPanelContent, EmptyState, SkeletonShell, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type Granularity } from '@/components/shared'
import { Button } from "@/components/ui/button"
import {
    Collection,
    GROUP_ROW_LIMIT,
    orderingParam,
    useCollectionViewMode,
    useEntityCollection,
    useServerPage,
    type FieldId,
    type SortSpec,
} from "@/components/entity-view"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { EMPTY_SALES_ANALYTICS, useSaleOrderAnalytics, useSalesNotes, useSalesOrders } from "@/features/sales"
import { AlertTriangle } from "lucide-react"
import { salesOrderUnifiedSearchDef, salesNoteUnifiedSearchDef } from "@/features/sales/unifiedSearchDef"
import type { SaleOrderFilters } from "@/features/sales/types"
import { saleOrderEntity, saleOrderViews } from "../entity-view/saleOrder.entity"
import { saleNoteEntity, saleNoteViews } from "../entity-view/saleNote.entity"
import { buildSalesAnalyticsScreen } from "./saleOrderAnalyticsScreen"

interface SalesOrdersViewProps {
    viewMode: 'orders' | 'notes'
    posSessionId?: number | null
    onSelectOrder?: (id: number | null) => void
    selectedId?: number | null
}

/** Shared selection: the document sheet (?selected, ADR-0083) or, in POS, the host's own selection. */
interface SheetSelection {
    selectedId: number | null
    toggle: (id: number) => void
}

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const ORDER_GROUPS: Record<string, FieldId<typeof saleOrderEntity.fields>> = { date: "date", customer: "customer", status: "hub", channel: "channel" }
const NOTE_GROUPS: Record<string, FieldId<typeof saleNoteEntity.fields>> = { date: "date", customer: "customer", status: "hub" }

export function SalesOrdersView({ viewMode, posSessionId, onSelectOrder, selectedId }: SalesOrdersViewProps) {
    // ?selected abre la ficha documental en la pila (ADR-0083): OV en "orders", factura/nota
    // en "notes". Con onSelectOrder (POS) la lista solo selecciona; el panel lo pone el host.
    const sheet = useDocumentSheetRoute(onSelectOrder ? null : (viewMode === "orders" ? "sales.saleorder" : "billing.invoice"))
    const selection: SheetSelection = onSelectOrder
        ? { selectedId: selectedId ?? null, toggle: (id) => onSelectOrder(selectedId === id ? null : id) }
        : { selectedId: sheet.selectedId ?? null, toggle: (id) => sheet.toggle(id) }

    // One collection per mode, each with its own hook: the hidden mode no longer fetches.
    return viewMode === "orders"
        ? <SaleOrderCollection posSessionId={posSessionId} selection={selection} />
        : <SaleNoteCollection selection={selection} />
}

function SaleOrderCollection({ posSessionId, selection }: { posSessionId?: number | null; selection: SheetSelection }) {
    const search = useUnifiedSearch(salesOrderUnifiedSearchDef)
    const groupBy = search.groupBy ? ORDER_GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof saleOrderEntity.fields>> | null>(null)
    const filters = useMemo<SaleOrderFilters>(
        () => ({ ...(search.filters as SaleOrderFilters), pos_session: posSessionId || undefined }),
        [search.filters, posSessionId],
    )
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.saleorder")

    const { page, orders, isLoading, isRefetching, isError, refetch } = useSalesOrders({
        filters: {
            ...filters,
            ordering: orderingParam(saleOrderEntity, sort),
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    // Figures over the whole filtered list, fetched only while the analytics view is open.
    const [activeTab, setActiveTab] = useState("resumen")
    const [granularity, setGranularity] = useState<Granularity>("month")
    const { analytics, isLoading: isLoadingAnalytics, isError: isAnalyticsError, refetch: refetchAnalytics } = useSaleOrderAnalytics({ filters, granularity, enabled: view === "analytics" })
    const analyticsScreen = useMemo(
        () => buildSalesAnalyticsScreen(analytics ?? EMPTY_SALES_ANALYTICS, { activeTab, onTabChange: setActiveTab, granularity, onGranularityChange: setGranularity }),
        [analytics, activeTab, granularity],
    )

    const collection = useEntityCollection(
        saleOrderEntity,
        { rows: orders, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: { mode: "server", state: sort, onChange: setSort },
            groupBy,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={selection.selectedId}
                onOpen={(order) => selection.toggle(order.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={salesOrderUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar órdenes..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={saleOrderViews.table}
                    card={saleOrderViews.card}
                    emptyTitle="Aún no hay órdenes de venta"
                    emptyDescription="Crea una orden de venta o regístrala desde el punto de venta."
                    onResetFilters={search.clearAll}
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

function SaleNoteCollection({ selection }: { selection: SheetSelection }) {
    const search = useUnifiedSearch(salesNoteUnifiedSearchDef)
    const groupBy = search.groupBy ? NOTE_GROUPS[search.groupBy] ?? null : null
    const filters = search.filters as Record<string, string>
    const [pageState, setPageState] = useServerPage([filters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const { page, notes, isLoading, isRefetching, isError, refetch } = useSalesNotes({
        filters: {
            ...filters,
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    const collection = useEntityCollection(
        saleNoteEntity,
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
                selection="panel"
                selectedId={selection.selectedId}
                onOpen={(note) => selection.toggle(note.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={salesNoteUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar notas..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={saleNoteViews.table}
                    card={saleNoteViews.card}
                    emptyTitle="Aún no hay notas"
                    emptyDescription="Las notas de crédito y débito asociadas a tus ventas aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
