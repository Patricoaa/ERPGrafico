"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { Can } from "@/components/auth"
import { ToolbarCreateButton } from "@/components/shared"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useRcvDocuments } from "../../hooks/useRcvDocuments"
import { rcvDocumentEntity, rcvPurchaseViews, rcvSaleQueryEntity, rcvSaleViews } from "../../entity-view/rcvDocument.entity"
import { isFiscalMatchStatus } from "@/lib/fiscal-match"
import type { RcvDirection, RcvDocumentFilters } from "../../types"
import { RcvImportModal } from "./RcvImportModal"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

const toInt = (v: string | undefined): number | undefined => {
    const n = Number(v)
    return v && Number.isInteger(n) && n > 0 ? n : undefined
}

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
        fiscal_match_status: isFiscalMatchStatus(params.fiscal_match_status) ? params.fiscal_match_status : undefined,
    }
}

export function RcvDocumentsClientView({ direction }: { direction: RcvDirection }) {
    const [importOpen, setImportOpen] = useState(false)
    const purchases = direction === "PURCHASES"
    const views = purchases ? rcvPurchaseViews : rcvSaleViews

    const query = useCollectionQuery(purchases ? rcvDocumentEntity : rcvSaleQueryEntity)
    const { search } = query
    // No default period: the tab lists every imported document until the user filters.
    const filters = useMemo(() => toRcvFilters(direction, query.params), [direction, query.params])
    const { view, onViewChange } = useCollectionViewMode("accounting.rcvdocument")
    // ADR-0152: cada documento abre su propia pestaña (abridor por defecto); `?selected` solo es enlace profundo.
    useDeepLinkEntity("accounting.rcvdocument")

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


    const directions = useMemo(() => [direction], [direction])
    const importAction = (
        <Can permission="accounting.add_rcvimport">
            <ToolbarCreateButton label="Sincronizar ahora" icon={Download} onClick={() => setImportOpen(true)} />
        </Can>
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
            >
                <Collection.Toolbar action={importAction} />
                <Collection.View
                    table={views.table}
                    card={views.card}
                    emptyTitle="Aún no hay documentos importados"
                    emptyDescription="Configura el RCV en Contabilidad → Configuración → RCV / SII o usa «Sincronizar ahora»."
                    emptyAction={importAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <RcvImportModal open={importOpen} onOpenChange={setImportOpen} defaultDirections={directions} />
        </div>
    )
}

export default RcvDocumentsClientView
