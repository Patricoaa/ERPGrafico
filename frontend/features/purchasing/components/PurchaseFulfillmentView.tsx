"use client"

import { Collection, GROUP_ROW_LIMIT, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { purchaseFulfillmentEntity, purchaseFulfillmentViews } from "../entity-view/purchaseFulfillment.entity"
import { usePurchaseFulfillment } from "../hooks/usePurchasing"
import { usePurchaseFulfillmentGroups } from "../hooks/usePurchaseLogisticsGroups"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/**
 * Recepciones y Devoluciones unificadas (ADR-0090).
 * Standalone list over merged `purchasing.purchasereceipt` + `purchasing.purchasereturn`;
 * `?selected` opens the appropriate sheet (receipt or return).
 */
export function PurchaseFulfillmentView() {
    const { openEntity } = useGlobalModals()
    const query = useCollectionQuery(purchaseFulfillmentEntity)
    const { groupBy, groupKey, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("purchasing.purchasereceipt")

    // Grouping groups the whole result on the server (`fulfillment/groups/`, ADR-0158 §7).
    const grouped = usePurchaseFulfillmentGroups({ groupKey, params })
    const list = usePurchaseFulfillment({
        ...params,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    }, groupKey === null)
    const { page, fulfillments } = list
    const { isLoading, isRefetching, isError, refetch } = groupKey ? grouped : { ...list, isRefetching: list.isFetching }

    const collection = useEntityCollection(
        purchaseFulfillmentEntity,
        { rows: fulfillments, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: query.search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: query.sorting,
            groupBy,
            serverGroups: grouped.groups,
        },
    )

    const handleOpen = (doc: PurchaseFulfillment) => {
        // Route to the correct entity sheet based on type
        const entityLabel = doc.fulfillment_type === "RECEIPT" ? "purchasing.purchasereceipt" : "purchasing.purchasereturn"
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
                    table={purchaseFulfillmentViews.table}
                    card={purchaseFulfillmentViews.card}
                    emptyTitle="Aún no hay recepciones ni devoluciones"
                    emptyDescription="Los documentos de recepción y devolución de tus órdenes de compra aparecerán aquí."
                    onResetFilters={query.search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}

import type { PurchaseFulfillment } from "../entity-view/purchaseFulfillment.entity"