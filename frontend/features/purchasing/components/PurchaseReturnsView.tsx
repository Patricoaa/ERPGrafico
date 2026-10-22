"use client"

import { useState } from "react"
import { Collection, GROUP_ROW_LIMIT, orderingParam, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId, type SortSpec } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { purchaseReturnEntity, purchaseReturnViews } from "../entity-view/purchaseReturn.entity"
import { usePurchaseReturns } from "../hooks/usePurchasing"
import { purchaseReturnUnifiedSearchDef } from "../unifiedSearchDef"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const GROUPS: Record<string, FieldId<typeof purchaseReturnEntity.fields>> = {
    date: "date",
    supplier: "supplier",
    status: "status",
}

/**
 * Devoluciones de compra (ADR-0090). Standalone list over `purchasing.purchasereturn`, whose
 * `list_url` used to point at the purchase orders list. `?selected` opens the return's own sheet.
 */
export function PurchaseReturnsView() {
    const sheet = useDocumentSheetRoute("purchasing.purchasereturn")
    const search = useUnifiedSearch(purchaseReturnUnifiedSearchDef)
    const groupBy = search.groupBy ? GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof purchaseReturnEntity.fields>> | null>(null)
    const filters = search.filters as Record<string, string>
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("purchasing.purchasereturn")

    const { page, returns, isLoading, isFetching, isError, refetch } = usePurchaseReturns({
        ...filters,
        ordering: orderingParam(purchaseReturnEntity, sort),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        purchaseReturnEntity,
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
                        config={purchaseReturnUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar devoluciones..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={purchaseReturnViews.table}
                    card={purchaseReturnViews.card}
                    emptyTitle="Aún no hay devoluciones de compra"
                    emptyDescription="Las devoluciones de mercadería a tus proveedores aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
