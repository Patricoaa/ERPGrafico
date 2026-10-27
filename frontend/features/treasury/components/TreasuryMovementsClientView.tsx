"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { Button } from "@/components/ui/button"
import React, { useState, useEffect, lazy, Suspense, useMemo } from "react"
import { AnalyticsPanelContent, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from '@/components/shared'
import type { Granularity } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage, GROUP_ROW_LIMIT, type FieldId } from "@/components/entity-view"

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { useTreasuryMovementAnalytics } from "@/features/treasury/hooks/useTreasuryMovementAnalytics"
import { treasuryMovementsUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { toast } from "sonner"
import type { TreasuryMovement } from "@/features/treasury/types"
import { treasuryMovementEntity, treasuryMovementViews } from "@/features/treasury/entity-view/treasuryMovement.entity"
import { buildTreasuryMovementAnalyticsScreen } from "./treasuryMovementAnalyticsScreen"

// Lazy load heavy components
import { CashMovementDrawer } from "@/features/treasury/components/CashMovementDrawer"
const CashMovementModal = lazy(() => import("./CashMovementModal"))

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const MOVEMENT_GROUPS: Record<string, FieldId<typeof treasuryMovementEntity.fields>> = { date: "date", movement_type: "movementType", payment_method: "paymentMethod" }
const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

interface TreasuryMovementsClientViewProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export function TreasuryMovementsClientView({ externalOpen, createAction }: TreasuryMovementsClientViewProps) {
    const { openEntity } = useGlobalModalActions()
    const search = useUnifiedSearch(treasuryMovementsUnifiedSearchDef)
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const treasuryAccountFromUrl = searchParams.get('treasury_account')
    const isAccountFiltered = Boolean(treasuryAccountFromUrl)
    const allFilters = {
        ...search.filters,
        ...(treasuryAccountFromUrl ? { treasury_account: treasuryAccountFromUrl } : {}),
    }
    const groupBy = search.groupBy ? MOVEMENT_GROUPS[search.groupBy] ?? null : null
    const [pageState, setPageState] = useServerPage([allFilters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("treasury.treasurymovement")
    const { movements, totalCount, isLoading, isRefetching, isError, refetch } = useTreasuryMovements({
        ...(allFilters as TreasuryMovementFilters),
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

    const panel = useEntityPanelRoute<TreasuryMovement>({ endpoint: '/treasury/movements', create: false })

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

    const handleClearAccountFilter = React.useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('treasury_account')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleReset = React.useCallback(() => {
        search.clearAll()
        handleClearAccountFilter()
    }, [search.clearAll, handleClearAccountFilter])

    const actionsCtx: TreasuryMovementActionsCtx = { onDetail: handleViewDetails }

    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("flujo")
    const [granularity, setGranularity] = useState<Granularity>("month")

    const analyticsData = useTreasuryMovementAnalytics({
        months: 12,
        granularity,
        treasury_account: treasuryAccountFromUrl,
        movement_type: search.filters.movement_type ?? null,
        payment_method: search.filters.payment_method ?? null,
        amount_min: search.filters.amount_min ?? null,
        amount_max: search.filters.amount_max ?? null,
        date_from: search.filters.date_from ?? null,
        date_to: search.filters.date_to ?? null,
    })

    const analyticsScreen = useMemo(
        () => buildTreasuryMovementAnalyticsScreen(analyticsData, { activeTab: analyticsActiveTab, onTabChange: setAnalyticsActiveTab, granularity, onGranularityChange: setGranularity }),
        [analyticsData, analyticsActiveTab, granularity],
    )

    const collection = useEntityCollection(
        treasuryMovementEntity,
        { rows: movements, rowCount: totalCount, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered || isAccountFiltered },
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
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(m) => handleViewDetails(m.id)}
                actions={treasuryMovementActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={treasuryMovementsUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        isFiltered={search.isFiltered || isAccountFiltered}
                        placeholder="Buscar movimiento..."
                        prefix={isAccountFiltered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-info/10 text-info border border-info/20 text-3xs font-bold uppercase tracking-wider font-mono shrink-0">
                                Cta. #{treasuryAccountFromUrl}
                                <Button
                                     variant="ghost"
                                     onClick={handleClearAccountFilter}
                                     className="ml-0.5 hover:text-info/80 h-auto w-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none text-current"
                                 >
                                     ×
                                 </Button>
                            </span>
                        ) : undefined}
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={treasuryMovementViews.table}
                    card={treasuryMovementViews.card}
                    emptyTitle="Aún no hay movimientos de caja"
                    emptyDescription="Los ingresos y egresos de fondos que registres aparecerán aquí."
                    emptyAction={createAction}
                    onResetFilters={handleReset}
                />
                <Collection.Analytics>
                    <AnalyticsPanelContent {...analyticsScreen} />
                </Collection.Analytics>
            </Collection.Root>

            <EntityPanelTab label="treasury.treasurymovement" {...panel.tab}>
                {(open) => panel.selectedId && (
                    <CashMovementDrawer
                        id={panel.selectedId}
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                    />
                )}
            </EntityPanelTab>
        </div>
    )
}

export default TreasuryMovementsClientView
