"use client"

import { useState } from "react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { useInvoices } from "@/features/billing/hooks/useInvoices"
import { useInvoiceGroups } from "@/features/billing/hooks/useInvoiceGroups"
import { type InvoiceFilters } from "@/features/billing/types"
import { DocumentRowActions } from "@/features/orders"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { salesInvoiceEntity, salesInvoiceViews } from "../entity-view/salesInvoice.entity"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

export function SalesInvoicesClientView() {
    const query = useCollectionQuery(salesInvoiceEntity)
    const { search, groupBy, groupKey } = query
    // ?selected abre la ficha documental de la factura (ADR-0083)
    const sheet = useDocumentSheetRoute("billing.invoice")
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const filters = { ...query.params, mode: 'sale' } as InvoiceFilters
    const [pageState, setPageState] = useServerPage([filters, groupBy], DEFAULT_PAGE)

    // Grouping by a field with a server key groups the whole result (`groups/`, ADR-0158 §7).
    const grouped = useInvoiceGroups({ groupKey, params: query.params, mode: "sale" })
    const list = useInvoices({
        filters: {
            ...filters,
            page: pageState.pageIndex + 1,
            page_size: pageState.pageSize,
        },
        enabled: groupKey === null,
    })
    const { page, invoices } = list
    const { isLoading, isRefetching, isError, refetch } = groupKey ? grouped : list

    const collection = useEntityCollection(
        salesInvoiceEntity,
        { rows: invoices, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy, serverGroups: grouped.groups },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(inv) => sheet.toggle(inv.id, inv)}
                actions={(inv) => <DocumentRowActions id={inv.id} kind="invoice" onOpen={sheet.toggle} />}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar />
                <Collection.View
                    table={salesInvoiceViews.table}
                    card={salesInvoiceViews.card}
                    emptyTitle="Aún no hay documentos de venta"
                    emptyDescription="Las boletas y facturas que emitas aparecerán aquí."
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
