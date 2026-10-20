"use client"

import { useState } from "react"
import { Collection, GROUP_ROW_LIMIT, orderingParam, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId, type SortSpec } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { saleReturnEntity, saleReturnViews } from "../entity-view/saleReturn.entity"
import { useSaleReturns } from "../hooks/useSaleDeliveries"
import { saleReturnUnifiedSearchDef } from "../unifiedSearchDef"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const GROUPS: Record<string, FieldId<typeof saleReturnEntity.fields>> = {
    date: "date",
    customer: "customer",
    status: "status",
}

/**
 * Devoluciones de venta (ADR-0090). Standalone list over `sales.salereturn`; the previously
 * reused notes list (`viewMode="notes"`) + `UnifiedNoteWizard` host is gone. Creating a credit
 * note stays an action on the source invoice; `?selected` opens the return's own sheet.
 */
export function SalesReturnsView() {
    const sheet = useDocumentSheetRoute("sales.salereturn")
    const search = useUnifiedSearch(saleReturnUnifiedSearchDef)
    const groupBy = search.groupBy ? GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof saleReturnEntity.fields>> | null>(null)
    const filters = search.filters as Record<string, string>
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.salereturn")

    const { page, returns, isLoading, isFetching, isError, refetch } = useSaleReturns({
        ...filters,
        ordering: orderingParam(saleReturnEntity, sort),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        saleReturnEntity,
        { rows: returns, rowCount: page?.count, isLoading, isRefetching: isFetching, error: isError, refetch, isFiltered: search.isFiltered },
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
                onOpen={(ret) => sheet.toggle(ret.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={saleReturnUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar devoluciones..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={saleReturnViews.table}
                    card={saleReturnViews.card}
                    emptyTitle="Aún no hay devoluciones"
                    emptyDescription="Las devoluciones de producto recibidas de tus clientes aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
