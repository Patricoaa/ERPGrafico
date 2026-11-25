"use client"

import { Collection, GROUP_ROW_LIMIT, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { purchaseReceiptEntity, purchaseReceiptViews } from "../entity-view/purchaseReceipt.entity"
import { usePurchaseReceipts } from "../hooks/usePurchasing"
import { usePurchaseReceiptGroups } from "../hooks/usePurchaseLogisticsGroups"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/**
 * Recepciones (ADR-0090). Standalone list over `purchasing.purchasereceipt`, whose `list_url`
 * used to point at a nonexistent route (`/purchasing/receipts`). `?selected` opens the receipt sheet.
 */
export function PurchaseReceiptsView() {
    const sheet = useDocumentSheetRoute("purchasing.purchasereceipt")
    const query = useCollectionQuery(purchaseReceiptEntity)
    const { groupBy, groupKey, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("purchasing.purchasereceipt")

    // Grouping by a field with a server key groups the whole result (`groups/`, ADR-0158 §7).
    const grouped = usePurchaseReceiptGroups({ groupKey, params })
    const list = usePurchaseReceipts({
        ...params,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    }, groupKey === null)
    const { page, receipts } = list
    const { isLoading, isRefetching, isError, refetch } = groupKey ? grouped : { ...list, isRefetching: list.isFetching }

    const collection = useEntityCollection(
        purchaseReceiptEntity,
        { rows: receipts, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: query.search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: query.sorting,
            groupBy,
            serverGroups: grouped.groups,
        },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(receipt) => sheet.toggle(receipt.id, receipt)}
                view={view}
                onViewChange={onViewChange}
                query={query}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={purchaseReceiptViews.table}
                    card={purchaseReceiptViews.card}
                    emptyTitle="Aún no hay recepciones"
                    emptyDescription="Las recepciones de mercadería de tus órdenes de compra aparecerán aquí."
                    onResetFilters={query.search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
