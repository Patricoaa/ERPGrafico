"use client"

import { Collection, GROUP_ROW_LIMIT, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { saleDeliveryEntity, saleDeliveryViews } from "../entity-view/saleDelivery.entity"
import { useSaleDeliveries } from "../hooks/useSaleDeliveries"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/**
 * Guías de Despacho (ADR-0090). Standalone list over `sales.saledelivery`; `?selected` opens the
 * delivery sheet (`useDocumentSheetRoute`), replacing the old orders list + `DeliveryDrawer` host.
 */
export function SalesDeliveriesView() {
    const sheet = useDocumentSheetRoute("sales.saledelivery")
    const query = useCollectionQuery(saleDeliveryEntity)
    const { groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.saledelivery")

    const { page, deliveries, isLoading, isFetching, isError, refetch } = useSaleDeliveries({
        ...params,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        saleDeliveryEntity,
        { rows: deliveries, rowCount: page?.count, isLoading, isRefetching: isFetching, error: isError, refetch, isFiltered: query.search.isFiltered },
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
                onOpen={(delivery) => sheet.toggle(delivery.id, delivery)}
                view={view}
                onViewChange={onViewChange}
                query={query}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={saleDeliveryViews.table}
                    card={saleDeliveryViews.card}
                    emptyTitle="Aún no hay guías de despacho"
                    emptyDescription="Las entregas generadas desde tus órdenes de venta aparecerán aquí."
                    onResetFilters={query.search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
