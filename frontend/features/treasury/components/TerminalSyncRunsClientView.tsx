"use client"

import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { Can } from "@/components/auth"
import { ToolbarCreateButton } from "@/components/shared"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useTerminalSyncRuns } from "../hooks/useTerminalSync"
import { useTerminalProviders } from "../hooks/useTerminalProviders"
import { terminalSyncRunEntity, terminalSyncRunViews } from "../entity-view/terminalSyncRun.entity"
import type { TerminalSyncRunFilters, TerminalSyncRunStatus, TerminalSyncTrigger } from "../types"
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
    const [syncOpen, setSyncOpen] = useState(false)

    const { providers } = useTerminalProviders()
    const providerOptions = useMemo(
        () => providers.filter((p) => p.provider_type === "TUU").map((p) => ({ label: p.name, value: String(p.id) })),
        [providers],
    )
    const query = useCollectionQuery(terminalSyncRunEntity, { filterOptions: { provider: providerOptions } })
    const { search } = query
    const filters = useMemo(() => toRunFilters(query.params), [query.params])
    const { view, onViewChange } = useCollectionViewMode("treasury.terminalsyncrun")
    // ADR-0152: cada registro abre su propia pestaña (abridor por defecto); `?selected` solo es enlace profundo.
    useDeepLinkEntity("treasury.terminalsyncrun")

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


    const syncAction = (
        <Can permission="treasury.add_terminalsyncrun">
            <ToolbarCreateButton label="Sincronizar ahora" icon={RefreshCw} onClick={() => setSyncOpen(true)} />
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
                <Collection.Toolbar action={syncAction} />
                <Collection.View
                    table={terminalSyncRunViews.table}
                    card={terminalSyncRunViews.card}
                    emptyTitle="Aún no hay importaciones"
                    emptyDescription="Activa la sincronización automática en Tesorería → Configuración → Terminal de cobro o usa «Sincronizar ahora»."
                    emptyAction={syncAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <TerminalSyncModal open={syncOpen} onOpenChange={setSyncOpen} />
        </div>
    )
}

export default TerminalSyncRunsClientView
