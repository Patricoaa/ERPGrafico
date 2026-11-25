"use client"

import { Collection, GROUP_ROW_LIMIT, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { saleReturnEntity, saleReturnViews } from "../entity-view/saleReturn.entity"
import { useSaleReturns } from "../hooks/useSaleDeliveries"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/**
 * Devoluciones de venta (ADR-0090). Standalone list over `sales.salereturn`; the previously
 * reused notes list (`viewMode="notes"`) + `UnifiedNoteWizard` host is gone. Creating a credit
 * note stays an action on the source invoice; `?selected` opens the return's own sheet.
 */
export function SalesReturnsView() {
    const sheet = useDocumentSheetRoute("sales.salereturn")
    const query = useCollectionQuery(saleReturnEntity)
    const { groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.salereturn")

    const { page, returns, isLoading, isFetching, isError, refetch } = useSaleReturns({
        ...params,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        saleReturnEntity,
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
                    table={saleReturnViews.table}
                    card={saleReturnViews.card}
                    emptyTitle="Aún no hay devoluciones"
                    emptyDescription="Las devoluciones de producto recibidas de tus clientes aparecerán aquí."
                    onResetFilters={query.search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
