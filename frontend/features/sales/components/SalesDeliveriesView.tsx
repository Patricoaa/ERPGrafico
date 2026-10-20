"use client"

import { useState } from "react"
import { Collection, GROUP_ROW_LIMIT, orderingParam, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId, type SortSpec } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { saleDeliveryEntity, saleDeliveryViews } from "../entity-view/saleDelivery.entity"
import { useSaleDeliveries } from "../hooks/useSaleDeliveries"
import { saleDeliveryUnifiedSearchDef } from "../unifiedSearchDef"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const GROUPS: Record<string, FieldId<typeof saleDeliveryEntity.fields>> = {
    date: "date",
    customer: "customer",
    status: "status",
}

/**
 * Guías de Despacho (ADR-0090). Standalone list over `sales.saledelivery`; `?selected` opens the
 * delivery sheet (`useDocumentSheetRoute`), replacing the old orders list + `DeliveryDrawer` host.
 */
export function SalesDeliveriesView() {
    const sheet = useDocumentSheetRoute("sales.saledelivery")
    const search = useUnifiedSearch(saleDeliveryUnifiedSearchDef)
    const groupBy = search.groupBy ? GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof saleDeliveryEntity.fields>> | null>(null)
    const filters = search.filters as Record<string, string>
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.saledelivery")

    const { page, deliveries, isLoading, isFetching, isError, refetch } = useSaleDeliveries({
        ...filters,
        ordering: orderingParam(saleDeliveryEntity, sort),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        saleDeliveryEntity,
        { rows: deliveries, rowCount: page?.count, isLoading, isRefetching: isFetching, error: isError, refetch, isFiltered: search.isFiltered },
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
                onOpen={(delivery) => sheet.toggle(delivery.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={saleDeliveryUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar guías de despacho..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={saleDeliveryViews.table}
                    card={saleDeliveryViews.card}
                    emptyTitle="Aún no hay guías de despacho"
                    emptyDescription="Las entregas generadas desde tus órdenes de venta aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
