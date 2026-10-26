"use client"

import { useState } from "react"
import { Collection, GROUP_ROW_LIMIT, orderingParam, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId, type SortSpec } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { saleFulfillmentEntity, saleFulfillmentViews } from "../entity-view/saleFulfillment.entity"
import { useSaleFulfillment } from "../hooks/useSaleDeliveries"
import { saleFulfillmentUnifiedSearchDef } from "../unifiedSearchDef"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const GROUPS: Record<string, FieldId<typeof saleFulfillmentEntity.fields>> = {
    date: "date",
    customer: "customer",
    status: "status",
    type: "type",
}

/**
 * Despachos y Devoluciones unificados (ADR-0090).
 * Standalone list over merged `sales.saledelivery` + `sales.salereturn`;
 * `?selected` opens the appropriate sheet (delivery or return).
 */
export function SalesFulfillmentView() {
    const { openEntity } = useGlobalModals()
    const search = useUnifiedSearch(saleFulfillmentUnifiedSearchDef)
    const groupBy = search.groupBy ? GROUPS[search.groupBy] ?? null : null
    const [sort, setSort] = useState<SortSpec<FieldId<typeof saleFulfillmentEntity.fields>> | null>(null)
    const filters = search.filters as Record<string, string>
    const [pageState, setPageState] = useServerPage([filters, sort, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("sales.saledelivery")

    const { page, fulfillments, isLoading, isFetching, isError, refetch } = useSaleFulfillment({
        ...filters,
        ordering: orderingParam(saleFulfillmentEntity, sort),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const collection = useEntityCollection(
        saleFulfillmentEntity,
        { rows: fulfillments, rowCount: page?.count, isLoading, isRefetching: isFetching, error: isError, refetch, isFiltered: search.isFiltered },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            sorting: { mode: "server", state: sort, onChange: setSort },
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
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={saleFulfillmentUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar despachos y devoluciones..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={saleFulfillmentViews.table}
                    card={saleFulfillmentViews.card}
                    emptyTitle="Aún no hay despachos ni devoluciones"
                    emptyDescription="Los documentos de entrega y devolución generados desde tus órdenes de venta aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}

import type { SaleFulfillment } from "../entity-view/saleFulfillment.entity"