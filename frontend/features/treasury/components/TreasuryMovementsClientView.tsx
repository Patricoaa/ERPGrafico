"use client"

import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import React, { useState, useEffect, lazy, Suspense, useMemo } from "react"
import { AnalyticsPanelContent } from '@/components/shared'
import type { Granularity } from "@/components/shared"
import { Collection, useCollectionAnalytics, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage, GROUP_ROW_LIMIT } from "@/components/entity-view"

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { useTreasuryMovementAnalytics } from "@/features/treasury/hooks/useTreasuryMovementAnalytics"
import { useBanks } from "@/features/treasury/hooks/useMasterData"
import { useTreasuryAccounts } from "@/features/treasury/hooks/useTreasuryAccounts"
import { toast } from "sonner"
import { treasuryMovementEntity, treasuryMovementViews } from "@/features/treasury/entity-view/treasuryMovement.entity"
import { buildTreasuryMovementAnalyticsScreen } from "./treasuryMovementAnalyticsScreen"

// Lazy load heavy components
const CashMovementModal = lazy(() => import("./CashMovementModal"))

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

interface TreasuryMovementsClientViewProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export function TreasuryMovementsClientView({ externalOpen, createAction }: TreasuryMovementsClientViewProps) {
    const { openEntity } = useGlobalModalActions()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // `?treasury_account=` (links from an account's ficha) is a regular filter chip with the account's name.
    const { accounts } = useTreasuryAccounts()
    const { banks } = useBanks()
    const filterOptions = useMemo(() => ({
        treasury_account: accounts.map((a) => ({ label: a.name, value: String(a.id) })),
        bank: banks.map((b) => ({ label: b.name, value: String(b.id) })),
    }), [accounts, banks])
    const query = useCollectionQuery(treasuryMovementEntity, { filterOptions })
    const { search, groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("treasury.treasurymovement")
    const { movements, totalCount, isLoading, isRefetching, isError, refetch } = useTreasuryMovements({
        ...(params as TreasuryMovementFilters),
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const isTruncated = !!groupBy && totalCount > GROUP_ROW_LIMIT

    useEffect(() => {
        if (isTruncated) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isTruncated, totalCount])

    const [openModal, setOpenModal] = useState(false)

    // ADR-0152: `?selected` solo es enlace profundo; abrir un movimiento es `openEntity`.
    useDeepLinkEntity("treasury.treasurymovement")

    // T-105: cancelAnimationFrame cleanup prevents setState on unmounted component
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setOpenModal(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    const handleViewDetails = React.useCallback((id: number) => {
        openEntity("treasury.treasurymovement", id)
    }, [openEntity])

    const actionsCtx: TreasuryMovementActionsCtx = { onDetail: handleViewDetails }

    const analyticsUi = useCollectionAnalytics("flujo")
    const [granularity, setGranularity] = useState<Granularity>("month")

    // ADR-0158 §5.7: the analytics follow the list's filters unless the scope is "all".
    const scoped: Record<string, string | undefined> = analyticsUi.scope === "all" ? {} : params
    const analyticsData = useTreasuryMovementAnalytics({
        months: 12,
        granularity,
        treasury_account: scoped.treasury_account ?? null,
        movement_type: scoped.movement_type ?? null,
        payment_method: scoped.payment_method ?? null,
        amount_min: scoped.amount_min ?? null,
        amount_max: scoped.amount_max ?? null,
        date_from: scoped.date_from ?? null,
        date_to: scoped.date_to ?? null,
    })

    const analyticsScreen = useMemo(
        () => buildTreasuryMovementAnalyticsScreen(analyticsData, { activeTab: analyticsUi.tab, onTabChange: analyticsUi.onTabChange, granularity, onGranularityChange: setGranularity }),
        [analyticsData, analyticsUi.tab, analyticsUi.onTabChange, granularity],
    )

    const collection = useEntityCollection(
        treasuryMovementEntity,
        { rows: movements, rowCount: totalCount, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<div />}>
                <CashMovementModal
                    open={openModal}
                    onOpenChange={(open: boolean) => {
                        setOpenModal(open)
                        if (!open) {
                            const params = new URLSearchParams(searchParams.toString())
                            params.delete('modal')
                            const query = params.toString()
                            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
                        }
                    }}
                    onSuccess={refetch}
                />
            </Suspense>

            <Collection.Root
                analytics={analyticsUi}
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                onOpen={(m) => handleViewDetails(m.id)}
                actions={treasuryMovementActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={treasuryMovementViews.table}
                    card={treasuryMovementViews.card}
                    emptyTitle="Aún no hay movimientos de caja"
                    emptyDescription="Los ingresos y egresos de fondos que registres aparecerán aquí."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
                <Collection.Analytics>
                    <AnalyticsPanelContent {...analyticsScreen} />
                </Collection.Analytics>
            </Collection.Root>

        </div>
    )
}

export default TreasuryMovementsClientView
