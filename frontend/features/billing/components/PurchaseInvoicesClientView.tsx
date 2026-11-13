"use client"

import React from "react"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, GROUP_ROW_LIMIT, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId } from "@/components/entity-view"
import { purchaseInvoiceUnifiedSearchDef } from "@/features/billing/unifiedSearchDef"
import { DocumentRowActions } from "@/features/orders"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { usePurchaseInvoices } from "@/features/billing/hooks/usePurchaseInvoices"
import { type InvoiceFilters } from "@/features/billing/types"
import { purchaseInvoiceEntity, purchaseInvoiceViews } from "../entity-view/purchaseInvoice.entity"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const INVOICE_GROUPS: Record<string, FieldId<typeof purchaseInvoiceEntity.fields>> = { date: "date", status: "hub" }

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

interface Props {
    createAction?: React.ReactNode
}

export function PurchaseInvoicesClientView({ createAction }: Props) {
    const search = useUnifiedSearch(purchaseInvoiceUnifiedSearchDef)

    // ?selected abre la ficha documental de la factura de compra (ADR-0083)
    const sheet = useDocumentSheetRoute("billing.invoice")
    const groupBy = search.groupBy ? INVOICE_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const filters = { ...search.filters } as InvoiceFilters
    const [pageState, setPageState] = useServerPage([filters, groupBy], DEFAULT_PAGE)

    const { page, invoices: documents, isLoading, isRefetching, isError, refetch: fetchDocuments } = usePurchaseInvoices({
        filters: {
            ...filters,
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    const collection = useEntityCollection(
        purchaseInvoiceEntity,
        { rows: documents, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch: fetchDocuments, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(doc) => sheet.toggle(doc.id)}
                view={view}
                onViewChange={onViewChange}
                actions={(inv) => <DocumentRowActions id={inv.id} kind="invoice" onOpen={sheet.toggle} />}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={purchaseInvoiceUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar facturas de compra..." />
                </Collection.Toolbar>
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
