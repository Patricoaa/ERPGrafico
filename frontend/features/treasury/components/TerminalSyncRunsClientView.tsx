"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { EntityPanelTab } from "@/components/providers"
import { Can } from "@/components/auth"
import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useTerminalSyncRuns } from "../hooks/useTerminalSync"
import { useTerminalProviders } from "../hooks/useTerminalProviders"
import { terminalSyncRunUnifiedSearchDef } from "../unifiedSearchDef"
import { terminalSyncRunEntity, terminalSyncRunViews } from "../entity-view/terminalSyncRun.entity"
import type { TerminalSyncRunFilters, TerminalSyncRunStatus, TerminalSyncTrigger } from "../types"
import { TerminalSyncRunDrawer } from "./TerminalSyncRunDrawer"
import { TerminalSyncModal } from "./TerminalSyncModal"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

const STATUSES: readonly TerminalSyncRunStatus[] = ["RUNNING", "SUCCESS", "PARTIAL", "FAILED"]
const TRIGGERS: readonly TerminalSyncTrigger[] = ["SCHEDULED", "MANUAL"]

const isStatus = (v: string | undefined): v is TerminalSyncRunStatus => STATUSES.some((s) => s === v)
const isTrigger = (v: string | undefined): v is TerminalSyncTrigger => TRIGGERS.some((t) => t === v)
const toId = (v: string | undefined): number | undefined => {
    const n = Number(v)
    return v && Number.isInteger(n) && n > 0 ? n : undefined
}

/** URL search params → typed API filters. */
function toRunFilters(params: Record<string, string>): Omit<TerminalSyncRunFilters, "page" | "page_size"> {
    return {
        provider: toId(params.provider),
        status: isStatus(params.status) ? params.status : undefined,
        trigger: isTrigger(params.trigger) ? params.trigger : undefined,
    }
}

/** Historial de importaciones de ventas TUU: cada ejecución de sincronización es una entidad. */
export function TerminalSyncRunsClientView() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [syncOpen, setSyncOpen] = useState(false)

    const { providers } = useTerminalProviders()
    const providerOptions = useMemo(
        () => providers.filter((p) => p.provider_type === "TUU").map((p) => ({ label: p.name, value: String(p.id) })),
        [providers],
    )
    const search = useUnifiedSearch(terminalSyncRunUnifiedSearchDef, { provider: providerOptions })
    const filters = useMemo(() => toRunFilters(search.filters), [search.filters])
    const { view, onViewChange } = useCollectionViewMode("treasury.terminalsyncrun")
    const panel = useEntityPanelRoute({ create: false })

    const [pageState, setPageState] = useServerPage([filters], DEFAULT_PAGE)
    const { page, runs, isLoading, isRefetching, isError, refetch } = useTerminalSyncRuns({
        ...filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const collection = useEntityCollection(
        terminalSyncRunEntity,
        { rows: runs, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )

    const openRun = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const syncAction = (
        <Can permission="treasury.add_terminalsyncrun">
            <ToolbarCreateButton label="Sincronizar ahora" icon={RefreshCw} onClick={() => setSyncOpen(true)} />
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
                onOpen={(run) => openRun(run.id)}
            >
                <Collection.Toolbar action={syncAction}>
                    <UnifiedSearchBar
                        config={terminalSyncRunUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        filterOptions={{ provider: providerOptions }}
                        placeholder="Filtrar importaciones..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={terminalSyncRunViews.table}
                    card={terminalSyncRunViews.card}
                    emptyTitle="Aún no hay importaciones"
                    emptyDescription="Activa la sincronización automática en Tesorería → Configuración → Terminal de cobro o usa «Sincronizar ahora»."
                    emptyAction={syncAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.terminalsyncrun" {...panel.tab}>
                {(open) => (
                    <TerminalSyncRunDrawer
                        id={panel.selectedId}
                        open={open}
                        onOpenChange={(o) => { if (!o) panel.close() }}
                    />
                )}
            </EntityPanelTab>
            <TerminalSyncModal open={syncOpen} onOpenChange={setSyncOpen} />
        </div>
    )
}

export default TerminalSyncRunsClientView
