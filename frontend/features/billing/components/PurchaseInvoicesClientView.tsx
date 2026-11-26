"use client"

import React from "react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { DocumentRowActions } from "@/features/orders"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { usePurchaseInvoices } from "@/features/billing/hooks/usePurchaseInvoices"
import { useInvoiceGroups } from "@/features/billing/hooks/useInvoiceGroups"
import { type InvoiceFilters } from "@/features/billing/types"
import { purchaseInvoiceEntity, purchaseInvoiceViews } from "../entity-view/purchaseInvoice.entity"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

interface Props {
    createAction?: React.ReactNode
}

export function PurchaseInvoicesClientView({ createAction }: Props) {
    const query = useCollectionQuery(purchaseInvoiceEntity)
    const { search, groupBy, groupKey } = query

    // ?selected abre la ficha documental de la factura de compra (ADR-0083)
    const sheet = useDocumentSheetRoute("billing.invoice")
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const filters = { ...query.params } as InvoiceFilters
    const [pageState, setPageState] = useServerPage([filters, groupBy], DEFAULT_PAGE)

    // Grouping by a field with a server key groups the whole result (`groups/`, ADR-0158 §7).
    const grouped = useInvoiceGroups({ groupKey, params: query.params, mode: "purchase" })
    const list = usePurchaseInvoices({
        filters: {
            ...filters,
            page: pageState.pageIndex + 1,
            page_size: pageState.pageSize,
        },
        enabled: groupKey === null,
    })
    const { page, invoices: documents } = list
    const { isLoading, isRefetching, isError, refetch: fetchDocuments } = groupKey ? grouped : list

    const collection = useEntityCollection(
        purchaseInvoiceEntity,
        { rows: documents, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch: fetchDocuments, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy, serverGroups: grouped.groups },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(doc) => sheet.toggle(doc.id, doc)}
                view={view}
                onViewChange={onViewChange}
                actions={(inv) => <DocumentRowActions id={inv.id} kind="invoice" onOpen={sheet.toggle} />}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={purchaseInvoiceViews.table}
                    card={purchaseInvoiceViews.card}
                    emptyTitle="Aún no hay documentos de compra"
                    emptyDescription="Los documentos de compra registrados aparecerán aquí."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
