"use client"

import { Collection, GROUP_ROW_LIMIT, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { saleFulfillmentEntity, saleFulfillmentViews } from "../entity-view/saleFulfillment.entity"
import { useSaleFulfillment } from "../hooks/useSaleDeliveries"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/**
 * Despachos y Devoluciones unificados (ADR-0090).
 * Standalone list over merged `sales.saledelivery` + `sales.salereturn`;
 * `?selected` opens the appropriate sheet (delivery or return).
 */
export function SalesFulfillmentView() {
    const { openEntity } = useGlobalModals()
    const query = useCollectionQuery(saleFulfillmentEntity)
    const { groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.saledelivery")

    const { page, fulfillments, isLoading, isFetching, isError, refetch } = useSaleFulfillment({
        ...params,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        saleFulfillmentEntity,
        { rows: fulfillments, rowCount: page?.count, isLoading, isRefetching: isFetching, error: isError, refetch, isFiltered: query.search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            groupBy,
        },
    )

    const handleOpen = (doc: SaleFulfillment) => {
        // Route to the correct entity sheet based on type
        const entityLabel = doc.fulfillment_type === "DELIVERY" ? "sales.saledelivery" : "sales.salereturn"
        openEntity(entityLabel, doc.id, { display_id: doc.display_id, number: doc.number }, undefined, { display: doc.display_id ?? undefined })
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={null}
                onOpen={handleOpen}
                view={view}
                onViewChange={onViewChange}
                query={query}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={saleFulfillmentViews.table}
                    card={saleFulfillmentViews.card}
                    emptyTitle="Aún no hay despachos ni devoluciones"
                    emptyDescription="Los documentos de entrega y devolución generados desde tus órdenes de venta aparecerán aquí."
                    onResetFilters={query.search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}

import type { SaleFulfillment } from "../entity-view/saleFulfillment.entity"