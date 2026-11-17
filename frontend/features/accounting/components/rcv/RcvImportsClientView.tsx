"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Download } from "lucide-react"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { EntityPanelTab } from "@/components/providers"
import { Can } from "@/components/auth"
import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useRcvImports } from "../../hooks/useRcvImports"
import { rcvImportEntity, rcvImportViews } from "../../entity-view/rcvImport.entity"
import { rcvImportUnifiedSearchDef } from "../../unifiedSearchDef"
import type { RcvDirection, RcvImportFilters, RcvImportStatus, RcvImportTrigger } from "../../types"
import { RcvImportDrawer } from "./RcvImportDrawer"
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
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [importOpen, setImportOpen] = useState(false)

    const search = useUnifiedSearch(rcvImportUnifiedSearchDef)
    const filters = useMemo(() => toImportFilters(search.filters), [search.filters])
    const { view, onViewChange } = useCollectionViewMode("accounting.rcvimport")
    const panel = useEntityPanelRoute({ create: false })

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

    const openImport = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const importAction = (
        <Can permission="accounting.add_rcvimport">
            <ToolbarCreateButton label="Sincronizar ahora" icon={Download} onClick={() => setImportOpen(true)} />
        </Can>
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                selection="panel"
                selectedId={panel.selectedId}
                onOpen={(imp) => openImport(imp.id)}
            >
                <Collection.Toolbar action={importAction}>
                    <UnifiedSearchBar
                        config={rcvImportUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Filtrar importaciones..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={rcvImportViews.table}
                    card={rcvImportViews.card}
                    emptyTitle="Aún no hay importaciones"
                    emptyDescription="Activa la importación automática en Contabilidad → Configuración → RCV / SII o usa «Sincronizar ahora»."
                    emptyAction={impirtAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="accounting.rcvimport" {...panel.tab}>
                {(open) => (
                    <RcvImportDrawer
                        id={panel.selectedId}
                        open={open}
                        onOpenChange={(o) => { if (!o) panel.close() }}
                    />
                )}
            </EntityPanelTab>
            <RcvImportModal open={importOpen} onOpenChange={setImportOpen} />
        </div>
    )
}

export default RcvImportsClientView
