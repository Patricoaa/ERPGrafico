"use client"

import { useState } from "react"
import { Collection, GROUP_ROW_LIMIT, orderingParam, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId, type SortSpec } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { purchaseReceiptEntity, purchaseReceiptViews } from "../entity-view/purchaseReceipt.entity"
import { usePurchaseReceipts } from "../hooks/usePurchasing"
import { purchaseReceiptUnifiedSearchDef } from "../unifiedSearchDef"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const GROUPS: Record<string, FieldId<typeof purchaseReceiptEntity.fields>> = {
    date: "date",
    supplier: "supplier",
    status: "status",
}

/**
 * Recepciones (ADR-0090). Standalone list over `purchasing.purchasereceipt`, whose `list_url`
 * used to point at a nonexistent route (`/purchasing/receipts`). `?selected` opens the receipt sheet.
 */
export function PurchaseReceiptsView() {
    const sheet = useDocumentSheetRoute("purchasing.purchasereceipt")
    const search = useUnifiedSearch(purchaseReceiptUnifiedSearchDef)
    const groupBy = search.groupBy ? GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof purchaseReceiptEntity.fields>> | null>(null)
    const filters = search.filters as Record<string, string>
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("purchasing.purchasereceipt")

    const { page, receipts, isLoading, isFetching, isError, refetch } = usePurchaseReceipts({
        ...filters,
        ordering: orderingParam(purchaseReceiptEntity, sort),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        purchaseReceiptEntity,
        { rows: receipts, rowCount: page?.count, isLoading, isRefetching: isFetching, error: isError, refetch, isFiltered: search.isFiltered },
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
                onOpen={(receipt) => sheet.toggle(receipt.id)}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={purchaseReceiptUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar recepciones..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={purchaseReceiptViews.table}
                    card={purchaseReceiptViews.card}
                    emptyTitle="Aún no hay recepciones"
                    emptyDescription="Las recepciones de mercadería de tus órdenes de compra aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
