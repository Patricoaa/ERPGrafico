"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { MoneyDisplay, StatCard, ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useTerminalSales, useTerminalSalesSummary } from "../hooks/useTerminalSales"
import { useTerminalProviders } from "../hooks/useTerminalProviders"
import { lastSevenDays, terminalSaleUnifiedSearchDef } from "../unifiedSearchDef"
import { terminalSaleEntity, terminalSaleViews } from "../entity-view/terminalSale.entity"
import type { TerminalSalePaymentType, TerminalSaleStatus, TerminalSalesSummary, TerminalSalesSummaryFilters } from "../types"
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

/** URL search params → typed API filters. Without a date in the URL the period is the last 7 days. */
function toSalesFilters(params: Record<string, string>): TerminalSalesSummaryFilters {
    const hasDate = !!(params.date_from || params.date_to)
    const range = hasDate ? { from: params.date_from, to: params.date_to } : lastSevenDays()
    return {
        date_from: range.from || undefined,
        date_to: range.to || undefined,
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
    const filters = useMemo(() => toSalesFilters(search.filters), [search.filters])
    const { view, onViewChange } = useCollectionViewMode("treasury.terminalsale")
    const panel = useEntityPanelRoute({ create: false })

    const [pageState, setPageState] = useServerPage([filters], DEFAULT_PAGE)
    const { page, sales, isLoading, isRefetching, isError, refetch } = useTerminalSales({
        ...filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })
    const summary = useTerminalSalesSummary(filters)

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
                <TerminalSalesSummaryCards summary={summary.summary} isLoading={summary.isLoading} isError={summary.isError} />
                <Collection.View
                    table={terminalSaleViews.table}
                    card={terminalSaleViews.card}
                    emptyTitle="Aún no hay ventas sincronizadas"
                    emptyDescription="Activa la sincronización en Tesorería → Configuración o usa «Sincronizar ahora»."
                    emptyAction={syncAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <TerminalSaleDrawer
                saleId={panel.selectedId}
                open={panel.open}
                onOpenChange={(open) => { if (!open) panel.close() }}
            />
            <TerminalSyncModal open={syncOpen} onOpenChange={setSyncOpen} />
        </div>
    )
}

interface SummaryCardsProps {
    summary: TerminalSalesSummary | undefined
    isLoading: boolean
    isError: boolean
}

/** Period totals (only COMPLETED sales add up; the rest are shown apart when present). */
function TerminalSalesSummaryCards({ summary, isLoading, isError }: SummaryCardsProps) {
    if (isError) return null
    const commission = summary ? -Math.abs(Number(summary.commission)) : 0
    const nonCompleted = summary?.non_completed
    return (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5" aria-label="Resumen del período">
            <StatCard variant="compact" accent="muted" label="Ventas" loading={isLoading} value={summary?.count ?? 0} />
            <StatCard variant="compact" accent="muted" label="Bruto" loading={isLoading} value={<MoneyDisplay amount={summary?.gross ?? 0} showColor={false} />} />
            <StatCard variant="compact" accent="muted" label="Comisión" loading={isLoading} value={<MoneyDisplay amount={commission} />} />
            <StatCard variant="compact" accent="success" label="Neto" loading={isLoading} value={<MoneyDisplay amount={summary?.net ?? 0} />} />
            {nonCompleted && nonCompleted.count > 0 && (
                <StatCard
                    variant="compact"
                    accent="warning"
                    label="No completadas"
                    value={<MoneyDisplay amount={nonCompleted.total} showColor={false} />}
                    subtext={`${nonCompleted.count} ${nonCompleted.count === 1 ? "venta" : "ventas"} fuera de los totales`}
                />
            )}
        </div>
    )
}

export default TerminalSalesClientView
