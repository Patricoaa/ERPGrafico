"use client"

import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useInvoices } from "@/features/billing/hooks/useInvoices"
import { type InvoiceFilters } from "@/features/billing/types"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { invoiceUnifiedSearchDef } from "@/features/billing/unifiedSearchDef"
import { salesInvoiceEntity, salesInvoiceViews } from "../entity-view/salesInvoice.entity"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const INVOICE_GROUPS: Record<string, FieldId<typeof salesInvoiceEntity.fields>> = { date: "date", status: "hub", dte_type: "dteType" }

export function SalesInvoicesClientView() {
    const search = useUnifiedSearch(invoiceUnifiedSearchDef)
    const { invoices, isLoading, isRefetching, isError, refetch } = useInvoices({ filters: { ...search.filters, mode: 'sale' } as InvoiceFilters })
    // ?selected abre la ficha documental de la factura (ADR-0083)
    const sheet = useDocumentSheetRoute("billing.invoice")
    const groupBy = search.groupBy ? INVOICE_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("billing.invoice")

    const collection = useEntityCollection(
        salesInvoiceEntity,
        { rows: invoices, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(inv) => sheet.toggle(inv.id)}
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
