"use client"

import { Collection, GROUP_ROW_LIMIT, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { purchaseReturnEntity, purchaseReturnViews } from "../entity-view/purchaseReturn.entity"
import { usePurchaseReturns } from "../hooks/usePurchasing"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/**
 * Devoluciones de compra (ADR-0090). Standalone list over `purchasing.purchasereturn`, whose
 * `list_url` used to point at the purchase orders list. `?selected` opens the return's own sheet.
 */
export function PurchaseReturnsView() {
    const sheet = useDocumentSheetRoute("purchasing.purchasereturn")
    const query = useCollectionQuery(purchaseReturnEntity)
    const { groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("purchasing.purchasereturn")

    const { page, returns, isLoading, isFetching, isError, refetch } = usePurchaseReturns({
        ...params,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        purchaseReturnEntity,
        { rows: returns, rowCount: page?.count, isLoading, isRefetching: isFetching, error: isError, refetch, isFiltered: query.search.isFiltered },
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
                onOpen={(ret) => sheet.toggle(ret.id, ret)}
                view={view}
                onViewChange={onViewChange}
                query={query}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={purchaseReturnViews.table}
                    card={purchaseReturnViews.card}
                    emptyTitle="Aún no hay devoluciones de compra"
                    emptyDescription="Las devoluciones de mercadería a tus proveedores aparecerán aquí."
                    onResetFilters={query.search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
