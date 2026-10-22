"use client"

import React, { useMemo, useState } from "react"
import { AnalyticsPanelContent, EmptyState, SkeletonShell, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type Granularity } from "@/components/shared"
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
import { AlertTriangle } from "lucide-react"
import type { OrderFilters } from "../api/purchasingApi"
import { purchaseOrderEntity, purchaseOrderViews } from "../entity-view/purchaseOrder.entity"
import { purchaseNoteEntity, purchaseNoteViews } from "../entity-view/purchaseNote.entity"
import { EMPTY_PURCHASING_ANALYTICS, usePurchaseOrderAnalytics } from "../hooks/usePurchaseOrderAnalytics"
import { usePurchasingNotes, usePurchasingOrders } from "../hooks/usePurchasing"
import { purchaseInvoiceUnifiedSearchDef } from "@/features/billing"
import { purchaseOrderUnifiedSearchDef } from "../unifiedSearchDef"
import { buildPurchaseAnalyticsScreen } from "./purchaseOrderAnalyticsScreen"

interface PurchaseOrdersViewProps {
    viewMode: "orders" | "notes"
    createAction?: React.ReactNode
}

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const ORDER_GROUPS: Record<string, FieldId<typeof purchaseOrderEntity.fields>> = { date: "date", status: "hub", receiving_status: "receiving" }
const NOTE_GROUPS: Record<string, FieldId<typeof purchaseNoteEntity.fields>> = { date: "date", status: "hub" }

/** Purchase orders or their credit/debit notes (ADR-0087 lote 2c); ?selected opens the document sheet (ADR-0083). */
export function PurchaseOrdersView({ viewMode, createAction }: PurchaseOrdersViewProps) {
    // One collection per mode, each with its own hook: the hidden mode does not fetch.
    return viewMode === "orders" ? <PurchaseOrderCollection createAction={createAction} /> : <PurchaseNoteCollection />
}

function PurchaseOrderCollection({ createAction }: { createAction?: React.ReactNode }) {
    const sheet = useDocumentSheetRoute("purchasing.purchaseorder")
    const search = useUnifiedSearch(purchaseOrderUnifiedSearchDef)
    const groupBy = search.groupBy ? ORDER_GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof purchaseOrderEntity.fields>> | null>(null)
    const filters = search.filters as OrderFilters
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("purchasing.purchaseorder")

    const { page, orders, isLoading, isRefetching, isError, refetch } = usePurchasingOrders({
        filters: {
            ...filters,
            ordering: orderingParam(purchaseOrderEntity, sort),
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    // Figures over the whole filtered list, fetched only while the analytics view is open.
    const [activeTab, setActiveTab] = useState("financiero")
    const [granularity, setGranularity] = useState<Granularity>("month")
    const { analytics, isLoading: isLoadingAnalytics, isError: isAnalyticsError, refetch: refetchAnalytics } = usePurchaseOrderAnalytics({ filters, granularity, enabled: view === "analytics" })
    const analyticsScreen = useMemo(
        () => buildPurchaseAnalyticsScreen(analytics ?? EMPTY_PURCHASING_ANALYTICS, { activeTab, onTabChange: setActiveTab, granularity, onGranularityChange: setGranularity }),
        [analytics, activeTab, granularity],
    )

    const collection = useEntityCollection(
        purchaseOrderEntity,
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
                selectedId={sheet.selectedId ?? null}
                onOpen={(order) => sheet.toggle(order.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={purchaseOrderUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar por proveedor..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={purchaseOrderViews.table}
                    card={purchaseOrderViews.card}
                    emptyTitle="Aún no hay órdenes de compra"
                    emptyDescription="Crea una orden de compra para registrar tus adquisiciones a proveedores."
                    emptyAction={createAction}
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

function PurchaseNoteCollection() {
    const sheet = useDocumentSheetRoute("billing.invoice")
    const search = useUnifiedSearch(purchaseInvoiceUnifiedSearchDef)
    const groupBy = search.groupBy ? NOTE_GROUPS[search.groupBy] ?? null : null
    const filters = search.filters as Record<string, string>
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
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(note) => sheet.toggle(note.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={purchaseInvoiceUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar notas..."
                    />
                </Collection.Toolbar>
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
