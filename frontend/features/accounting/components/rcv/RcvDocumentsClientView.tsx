"use client"

import { useCallback, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { EntityPanelTab } from "@/components/providers"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useRcvDocuments } from "../../hooks/useRcvDocuments"
import { rcvDocumentEntity, rcvPurchaseViews, rcvSaleViews } from "../../entity-view/rcvDocument.entity"
import { RCV_MATCH_STATUSES, rcvDocumentUnifiedSearchDef, rcvSaleUnifiedSearchDef } from "../../unifiedSearchDef"
import type { RcvDirection, RcvDocumentFilters } from "../../types"
import { RcvDocumentDrawer } from "./RcvDocumentDrawer"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

const toInt = (v: string | undefined): number | undefined => {
    const n = Number(v)
    return v && Number.isInteger(n) && n > 0 ? n : undefined
}

const isMatchFilter = (v: string | undefined): v is NonNullable<RcvDocumentFilters["match_status"]> =>
    !!v && (RCV_MATCH_STATUSES as readonly string[]).includes(v)

const isIsoDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** URL search params → typed API filters. */
function toRcvFilters(direction: RcvDirection, params: Record<string, string>): RcvDocumentFilters {
    return {
        direction,
        search: params.search || undefined,
        year: toInt(params.year),
        month: toInt(params.month),
        dte_type: toInt(params.dte_type),
        acknowledgement: direction === "PURCHASES" ? params.acknowledgement || undefined : undefined,
        status: direction === "PURCHASES" ? params.status || undefined : undefined,
        issue_date_from: isIsoDate(params.issue_date_from) ? params.issue_date_from : undefined,
        issue_date_to: isIsoDate(params.issue_date_to) ? params.issue_date_to : undefined,
        missing: params.missing === "true" || params.missing === "false" ? params.missing : undefined,
        match_status: isMatchFilter(params.match_status) ? params.match_status : undefined,
    }
}

export function RcvDocumentsClientView({ direction }: { direction: RcvDirection }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const purchases = direction === "PURCHASES"
    const searchDef = purchases ? rcvDocumentUnifiedSearchDef : rcvSaleUnifiedSearchDef
    const views = purchases ? rcvPurchaseViews : rcvSaleViews

    const search = useUnifiedSearch(searchDef)
    // No default period: the tab lists every imported document until the user filters.
    const filters = useMemo(() => toRcvFilters(direction, search.filters), [direction, search.filters])
    const { view, onViewChange } = useCollectionViewMode("accounting.rcvdocument")
    const panel = useEntityPanelRoute({ create: false })

    const [pageState, setPageState] = useServerPage([filters], DEFAULT_PAGE)
    const { page, documents, isLoading, isRefetching, isError, refetch } = useRcvDocuments({
        ...filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const collection = useEntityCollection(
        rcvDocumentEntity,
        { rows: documents, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )

    const openDocument = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const importsAction = (
        <Button asChild variant="outline">
            <Link href="/accounting/rcv/imports">Ir a Importaciones</Link>
        </Button>
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                selection="panel"
                selectedId={panel.selectedId}
                onOpen={(doc) => openDocument(doc.id)}
            >
                <Collection.Toolbar>
                    <UnifiedSearchBar
                        config={searchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder={purchases ? "Buscar por proveedor, RUT o folio..." : "Buscar por cliente, RUT o folio..."}
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={views.table}
                    card={views.card}
                    emptyTitle="Aún no hay documentos importados"
                    emptyDescription="Configura el RCV en Contabilidad → Configuración → RCV / SII o importa desde la pestaña Importaciones."
                    emptyAction={importsAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="accounting.rcvdocument" {...panel.tab}>
                {(open) => (
                    <RcvDocumentDrawer
                        id={panel.selectedId}
                        open={open}
                        onOpenChange={(o) => { if (!o) panel.close() }}
                    />
                )}
            </EntityPanelTab>
        </div>
    )
}

export default RcvDocumentsClientView
