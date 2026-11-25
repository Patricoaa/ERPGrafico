"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { Can } from "@/components/auth"
import { ToolbarCreateButton } from "@/components/shared"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useRcvImports } from "../../hooks/useRcvImports"
import { rcvImportEntity, rcvImportViews } from "../../entity-view/rcvImport.entity"
import type { RcvDirection, RcvImportFilters, RcvImportStatus, RcvImportTrigger } from "../../types"
import { RcvImportModal } from "./RcvImportModal"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

const DIRECTIONS: readonly RcvDirection[] = ["PURCHASES", "SALES"]
const STATUSES: readonly RcvImportStatus[] = ["QUEUED", "RUNNING", "SUCCESS", "FAILED"]
const TRIGGERS: readonly RcvImportTrigger[] = ["SCHEDULED", "MANUAL"]

const isDirection = (v: string | undefined): v is RcvDirection => DIRECTIONS.some((d) => d === v)
const isStatus = (v: string | undefined): v is RcvImportStatus => STATUSES.some((s) => s === v)
const isTrigger = (v: string | undefined): v is RcvImportTrigger => TRIGGERS.some((t) => t === v)
const toInt = (v: string | undefined): number | undefined => {
    const n = Number(v)
    return v && Number.isInteger(n) && n > 0 ? n : undefined
}

/** URL search params → typed API filters. */
function toImportFilters(params: Record<string, string>): RcvImportFilters {
    return {
        direction: isDirection(params.direction) ? params.direction : undefined,
        status: isStatus(params.status) ? params.status : undefined,
        trigger: isTrigger(params.trigger) ? params.trigger : undefined,
        year: toInt(params.year),
        month: toInt(params.month),
    }
}

export function RcvImportsClientView() {
    const [importOpen, setImportOpen] = useState(false)

    const query = useCollectionQuery(rcvImportEntity)
    const { search } = query
    const filters = useMemo(() => toImportFilters(query.params), [query.params])
    const { view, onViewChange } = useCollectionViewMode("accounting.rcvimport")
    // ADR-0152: cada documento abre su propia pestaña (abridor por defecto); `?selected` solo es enlace profundo.
    useDeepLinkEntity("accounting.rcvimport")

    const [pageState, setPageState] = useServerPage([filters], DEFAULT_PAGE)
    const { page, imports, isLoading, isRefetching, isError, refetch } = useRcvImports({
        ...filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const collection = useEntityCollection(
        rcvImportEntity,
        { rows: imports, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )


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
                    table={rcvImportViews.table}
                    card={rcvImportViews.card}
                    emptyTitle="Aún no hay importaciones"
                    emptyDescription="Activa la importación automática en Contabilidad → Configuración → RCV / SII o usa «Sincronizar ahora»."
                    emptyAction={importAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <RcvImportModal open={importOpen} onOpenChange={setImportOpen} />
        </div>
    )
}

export default RcvImportsClientView
