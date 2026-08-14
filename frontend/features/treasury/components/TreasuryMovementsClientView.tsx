"use client"

import { Button } from "@/components/ui/button"
import React, { useState, useEffect, lazy, Suspense, useMemo } from "react"
import { DataTableView, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch, StatCard, KPIWrapper, KPIValue } from '@/components/shared'
import type { AnalyticsPanelConfig, Granularity } from "@/components/shared"
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Scale, Ban, TrendingUp, Landmark, CreditCard, ListFilter } from "lucide-react"

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { useTreasuryMovementAnalytics } from "@/features/treasury/hooks/useTreasuryMovementAnalytics"
import { treasuryMovementsUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { toast } from "sonner"
import type { TreasuryMovement } from "@/features/treasury/types"
import { movementFields } from "@/features/treasury/movementFields"
import { chartColor } from "@/lib/chart-colors"

// Lazy load heavy components
import { CashMovementDrawer } from "@/features/treasury/components/CashMovementDrawer"
const CashMovementModal = lazy(() => import("./CashMovementModal"))

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
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, movements, totalCount, isLoading, refetch } = useTreasuryMovements({
        ...(allFilters as TreasuryMovementFilters),
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 5000 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const [openModal, setOpenModal] = useState(false)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<TreasuryMovement>({
        endpoint: '/treasury/movements'
    })

    const detailsOpen = !!selectedFromUrl
    const selectedMovementId = selectedFromUrl?.id ?? null

    // T-105: cancelAnimationFrame cleanup prevents setState on unmounted component
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setOpenModal(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    const handleViewDetails = React.useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

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

    const columns = React.useMemo<ColumnDef<TreasuryMovement>[]>(() => [
        ...movementFields.toColumns(),
        treasuryMovementActions.auto(actionsCtx)
    ], [openEntity, handleViewDetails])

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

    const analyticsPanel = useMemo<AnalyticsPanelConfig>(() => {
        const hasFlowData = analyticsData.flowLineChart.some(series => series.data.some(d => d.y > 0))
        const directions = analyticsData.analytics?.direction_distribution ?? []
        const inRow = directions.find(d => d.id === "IN")
        const outRow = directions.find(d => d.id === "OUT")
        const inCount = inRow?.count ?? 0
        const outCount = outRow?.count ?? 0
        const inValue = inRow ? parseFloat(inRow.amount) : 0
        const outValue = outRow ? parseFloat(outRow.amount) : 0
        const ingresoColor = chartColor(0)
        const egresoColor = chartColor(1)
        const hasAccounts = analyticsData.accountBar.length > 0
        const hasMethods = analyticsData.paymentMethodPie.length > 0
        const hasTypes = analyticsData.typePie.length > 0

        return {
            screen: {
                entityName: "Tesorería",
                activeTab: analyticsActiveTab,
                onTabChange: setAnalyticsActiveTab,
                granularity,
                onGranularityChange: setGranularity,
                tabs: [
                    {
                        value: "flujo",
                        label: "Flujo",
                        icon: TrendingUp,
                        columns: [
                            {
                                id: "col-evolution",
                                weight: 3,
                                sections: [
                                    {
                                        id: "kpi-row",
                                        fillRemaining: false,
                                        content: {
                                            type: 'custom',
                                            render: (
                                                <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                                                    <KPIWrapper tooltip="Número de transacciones de ingreso en el período: cobros, ventas y abonos de línea de crédito.">
                                                        <StatCard
                                                            label="Cantidad de Ingresos"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: ingresoColor }}>
                                                                <ArrowDownToLine className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={inCount} />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                    <KPIWrapper tooltip="Valor total de los fondos que ingresaron en el período.">
                                                        <StatCard
                                                            label="Valor Total de Ingresos"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: ingresoColor }}>
                                                                <ArrowDownToLine className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={inValue} isCurrency />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                    <KPIWrapper tooltip="Número de transacciones de egreso en el período: pagos, gastos y disposiciones de línea de crédito.">
                                                        <StatCard
                                                            label="Cantidad de Egresos"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: egresoColor }}>
                                                                <ArrowUpFromLine className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={outCount} />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                    <KPIWrapper tooltip="Valor total de los fondos que salieron en el período.">
                                                        <StatCard
                                                            label="Valor Total de Egresos"
                                                            className="h-full rounded-sm"
                                                        >
                                                            <div className="flex items-center gap-2" style={{ color: egresoColor }}>
                                                                <ArrowUpFromLine className="h-5 w-5" />
                                                                <span className="text-3xl font-black tracking-tighter">
                                                                    <KPIValue current={outValue} isCurrency />
                                                                </span>
                                                            </div>
                                                        </StatCard>
                                                    </KPIWrapper>
                                                </div>
                                            ),
                                        },
                                    },
                                    {
                                        id: "flow-evolution",
                                        content: hasFlowData ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Evolución del Flujo',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'line-chart',
                                                    preset: 'card',
                                                    data: analyticsData.flowLineChart,
                                                    showLegend: true,
                                                    enableArea: true,
                                                    valueFormat: ',.1f',
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin movimientos en el período</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "cuentas",
                        label: "Cuentas",
                        icon: Landmark,
                        columns: [
                            {
                                id: "col-accounts",
                                weight: 2,
                                sections: [
                                    {
                                        id: 'accounts-bar',
                                        content: hasAccounts ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Movimientos por Cuenta',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'bar-chart',
                                                    preset: 'card',
                                                    data: analyticsData.accountBar,
                                                    keys: ['ingresos', 'egresos'],
                                                    indexBy: 'cuenta',
                                                    valueFormat: '$,.0f',
                                                    showLegend: true,
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cuentas</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "metodos",
                        label: "Métodos de Pago",
                        icon: CreditCard,
                        columns: [
                            {
                                id: "col-methods",
                                weight: 1,
                                sections: [
                                    {
                                        id: 'methods-pie',
                                        content: hasMethods ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Transacciones por Método de Pago',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'pie-chart',
                                                    preset: 'card',
                                                    data: analyticsData.paymentMethodPie,
                                                    valueFormat: 'number',
                                                    enableLabels: true,
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de métodos de pago</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        value: "tipos",
                        label: "Tipos",
                        icon: ListFilter,
                        columns: [
                            {
                                id: "col-types",
                                weight: 1,
                                sections: [
                                    {
                                        id: 'types-pie',
                                        content: hasTypes ? {
                                            type: 'stat-card',
                                            config: {
                                                label: 'Transacciones por Tipo',
                                                variant: 'chart',
                                                chart: {
                                                    type: 'pie-chart',
                                                    preset: 'card',
                                                    data: analyticsData.typePie,
                                                    valueFormat: 'number',
                                                    enableLabels: true,
                                                },
                                            },
                                        } : {
                                            type: 'custom',
                                            render: (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de tipos</p>
                                            ),
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        }
    }, [analyticsActiveTab, granularity, analyticsData])

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

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.treasurymovement"
                    columns={columns}
                    data={movements}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={treasuryMovementsUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered || isAccountFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
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
                    />}
                    unifiedSearchConfig={treasuryMovementsUnifiedSearchDef}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered || isAccountFiltered}
                    onReset={handleReset}
                    createAction={createAction}
                    isFiltered={search.isFiltered || isAccountFiltered}
                    analyticsPanel={analyticsPanel}
                    emptyState={{
                        context: "treasury",
                        title: "Aún no hay movimientos de caja",
                        description: "Los ingresos y egresos de fondos que registres aparecerán aquí.",
                    }}
                    renderCard={(m) => {
                        const type = m.movement_type
                        const isWriteOff = m.payment_method === 'WRITE_OFF'

                        const Icon = isWriteOff
                            ? Ban
                            : type === 'INBOUND'
                                ? ArrowDownToLine
                                : type === 'OUTBOUND'
                                    ? ArrowUpFromLine
                                    : type === 'TRANSFER'
                                        ? ArrowLeftRight
                                        : Scale

                        const iconStyle = isWriteOff
                            ? "text-muted-foreground/50 bg-muted/50"
                            : type === 'INBOUND'
                                ? "text-success bg-success/10"
                                : type === 'OUTBOUND'
                                    ? "text-destructive bg-destructive/10"
                                    : "text-warning bg-warning/10"

                        return (
                            <AutoEntityCard 
                                key={m.id} 
                                data={m}
                                fields={movementFields}
                                entityLabel="treasury.cashmovement"
                                onClick={() => handleViewDetails(m.id)}
                                icon={Icon}
                                iconClassName={iconStyle}
                                actions={treasuryMovementActions.render(m, { onDetail: (id) => handleViewDetails(id) })}

                            />
                        )
                    }}
                    cardSkeleton={{ showBody: false }}
                />
            </div>

            {selectedMovementId && (
                <CashMovementDrawer
                    id={selectedMovementId}
                    open={detailsOpen}
                    onOpenChange={(open) => {
                        if (!open) clearSelection()
                    }}
                />
            )}
        </div>
    )
}

export default TreasuryMovementsClientView
