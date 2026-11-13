"use client"

import { useState } from "react"
import { Collection, GROUP_ROW_LIMIT, useCollectionViewMode, useEntityCollection, useServerPage, type FieldId } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useInvoices } from "@/features/billing/hooks/useInvoices"
import { type InvoiceFilters } from "@/features/billing/types"
import { DocumentRowActions } from "@/features/orders"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { invoiceUnifiedSearchDef } from "@/features/billing/unifiedSearchDef"
import { salesInvoiceEntity, salesInvoiceViews } from "../entity-view/salesInvoice.entity"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const INVOICE_GROUPS: Record<string, FieldId<typeof salesInvoiceEntity.fields>> = { date: "date", status: "hub", dte_type: "dteType" }

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

export function SalesInvoicesClientView() {
    const search = useUnifiedSearch(invoiceUnifiedSearchDef)
    // ?selected abre la ficha documental de la factura (ADR-0083)
    const sheet = useDocumentSheetRoute("billing.invoice")
    const groupBy = search.groupBy ? INVOICE_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const filters = { ...search.filters, mode: 'sale' } as InvoiceFilters
    const [pageState, setPageState] = useServerPage([filters, groupBy], DEFAULT_PAGE)

    const { page, invoices, isLoading, isRefetching, isError, refetch } = useInvoices({
        filters: {
            ...filters,
            page: groupBy ? 1 : pageState.pageIndex + 1,
            page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
        },
    })

    const collection = useEntityCollection(
        salesInvoiceEntity,
        { rows: invoices, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(inv) => sheet.toggle(inv.id)}
                actions={(inv) => <DocumentRowActions id={inv.id} kind="invoice" onOpen={sheet.toggle} />}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar config={invoiceUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar facturas..." />
                </Collection.Toolbar>
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
