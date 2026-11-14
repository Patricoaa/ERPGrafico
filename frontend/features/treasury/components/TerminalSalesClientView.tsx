"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { EntityPanelTab } from "@/components/providers"
import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useTerminalSales } from "../hooks/useTerminalSales"
import { useTerminalProviders } from "../hooks/useTerminalProviders"
import { terminalSaleUnifiedSearchDef } from "../unifiedSearchDef"
import { terminalSaleEntity, terminalSaleViews } from "../entity-view/terminalSale.entity"
import type { TerminalSalePaymentType, TerminalSaleStatus, TerminalSalesSummaryFilters } from "../types"
import { TerminalSaleDrawer } from "./TerminalSaleDrawer"
import { TerminalSyncModal } from "./TerminalSyncModal"

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

const PAYMENT_TYPES: readonly TerminalSalePaymentType[] = ["CASH", "DEBIT", "CREDIT", "PREPAID", "UNKNOWN"]
const STATUSES: readonly TerminalSaleStatus[] = ["COMPLETED", "REVERSED", "OTHER"]

const isPaymentType = (v: string | undefined): v is TerminalSalePaymentType => PAYMENT_TYPES.some((p) => p === v)
const isStatus = (v: string | undefined): v is TerminalSaleStatus => STATUSES.some((s) => s === v)
const toId = (v: string | undefined): number | undefined => {
    const n = Number(v)
    return v && Number.isInteger(n) && n >= 0 ? n : undefined
}

/** URL search params → typed API filters. */
function toSalesFilters(params: Record<string, string>): TerminalSalesSummaryFilters {
    return {
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
        provider: toId(params.provider),
        document_type: toId(params.document_type),
        payment_type: isPaymentType(params.payment_type) ? params.payment_type : undefined,
        status: isStatus(params.status) ? params.status : undefined,
    }
}

export function TerminalSalesClientView() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [syncOpen, setSyncOpen] = useState(false)

    const { providers } = useTerminalProviders()
    const providerOptions = useMemo(
        () => providers.filter((p) => p.provider_type === "TUU").map((p) => ({ label: p.name, value: String(p.id) })),
        [providers],
    )
    const search = useUnifiedSearch(terminalSaleUnifiedSearchDef, { provider: providerOptions })
    // No default period: the tab lists every synced sale until the user filters.
    const filters = useMemo(() => toSalesFilters(search.filters), [search.filters])
    const { view, onViewChange } = useCollectionViewMode("treasury.terminalsale")
    const panel = useEntityPanelRoute({ create: false })

    const [pageState, setPageState] = useServerPage([filters], DEFAULT_PAGE)
    const { page, sales, isLoading, isRefetching, isError, refetch } = useTerminalSales({
        ...filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const collection = useEntityCollection(
        terminalSaleEntity,
        { rows: sales, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )

    const openSale = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const syncAction = <ToolbarCreateButton label="Sincronizar ahora" icon={RefreshCw} onClick={() => setSyncOpen(true)} />

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                selection="panel"
                selectedId={panel.selectedId}
                onOpen={(sale) => openSale(sale.id)}
            >
                <Collection.Toolbar action={syncAction}>
                    <UnifiedSearchBar
                        config={terminalSaleUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        filterOptions={{ provider: providerOptions }}
                        placeholder="Filtrar ventas..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={terminalSaleViews.table}
                    card={terminalSaleViews.card}
                    emptyTitle="Aún no hay ventas sincronizadas"
                    emptyDescription="Activa la sincronización en Tesorería → Configuración o usa «Sincronizar ahora»."
                    emptyAction={syncAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.terminalsale" {...panel.tab}>
                {(open) => (
                    <TerminalSaleDrawer
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

export default TerminalSalesClientView
