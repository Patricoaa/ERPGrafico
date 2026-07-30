"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
    Plus,
    AlertCircle,
    MoveHorizontal,
    PieChart as PieChartIcon,
    Wallet,
    Gauge,
    TrendingUp
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { usePartners } from "@/features/contacts"
import type { Partner } from "@/features/contacts"
import { formatCurrency } from "@/lib/money"
import {
    SkeletonShell,
    DataTableView,
    DataCell,
    UnifiedSearchBar,
    useUnifiedSearch,
    AutoEntityCard,
    StatCard,
} from "@/components/shared"
import type { AnalyticsPanelConfig, UnifiedSearchConfig } from "@/components/shared"
import { usePartnerAnalyticsData } from "@/features/settings/hooks/usePartnerAnalyticsData"
import { usePartnerEvolutionData } from "@/features/settings/hooks/usePartnerEvolutionData"
import type { Granularity } from "@/lib/analytics-helpers"
import { partnerFields } from '../../partnerFields'
import { partnerActions, type PartnerActionsCtx } from './partnerActions'
import {
    SubscriptionMovementModal,
    EquityTransferModal,
    DividendPaymentModal
} from "@/features/settings/components/partners/EquityMovementModals"
import { PartnerContributionWizard } from "@/features/settings/components/partners/PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "@/features/settings/components/partners/PartnerWithdrawalWizard"
import { AddPartnerModal } from "@/features/settings/components/partners/AddPartnerModal"
import { InitialCapitalModal } from "@/features/settings/components/InitialCapitalModal"
import { MobilizeEarningsWizard } from "@/features/settings/components/partners/MobilizeEarningsWizard"
import { PartnerLedgerDrawer } from "@/features/settings/components/partners/PartnerLedgerDrawer"
import { type ColumnDef } from "@tanstack/react-table"

const partnerUnifiedSearchDef: UnifiedSearchConfig = {
    searchFields: [
        {
            key: 'name',
            label: 'Nombre / ID Fiscal',
            serverParam: 'search',
            clientKey: ['name', 'tax_id'],
        },
    ],
    filters: [
        {
            type: 'toggle',
            key: 'has_pending_capital',
            label: 'Con Capital Pendiente',
            serverParam: 'has_pending_capital',
        },
        {
            type: 'toggle',
            key: 'has_earnings',
            label: 'Con Utilidades',
            serverParam: 'has_earnings',
        },
        {
            type: 'toggle',
            key: 'has_dividends',
            label: 'Con Dividendos por Pagar',
            serverParam: 'has_dividends',
        },
        {
            type: 'toggle',
            key: 'has_withdrawals',
            label: 'Con Retiros Provisorios',
            serverParam: 'has_withdrawals',
        },
    ],
}

interface PartnersClientViewProps {
    initialAddPartnerOpen?: boolean
    createAction?: React.ReactNode
}

export function PartnersClientView({
    initialAddPartnerOpen = false,
    createAction
}: PartnersClientViewProps) {
    const search = useUnifiedSearch(partnerUnifiedSearchDef)
    const { data: partners = [], isLoading, isFetching, refetch, error } = usePartners()
    const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
    const [isTransferOpen, setIsTransferOpen] = useState(false)
    const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false)
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false)
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("composicion")
    const [granularity, setGranularity] = useState<Granularity>("month")

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const clearModalParam = React.useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (params.has('modal')) {
            params.delete('modal')
            const query = params.toString()
            router.replace(query ? `?${query}` : pathname, { scroll: false })
        }
    }, [searchParams, router, pathname])

    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
    const [isDividendOpen, setIsDividendOpen] = useState(false)
    const [isMobilizeOpen, setIsMobilizeOpen] = useState(false)
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | undefined>(undefined)

    const [subModalParams, setSubModalParams] = useState({
        partnerId: undefined as string | undefined,
        amount: undefined as string | undefined
    })

    useEffect(() => {
        if (initialAddPartnerOpen) {
            setTimeout(() => setIsAddPartnerOpen(true), 0)
        }
    }, [initialAddPartnerOpen])

    const ledgerParam = searchParams.get("ledger")
    const { selectedPartnerName, partnerIdForLedger, isLedgerOpen } = React.useMemo(() => {
        if (ledgerParam) {
            const pId = parseInt(ledgerParam, 10)
            const partner = partners.find(p => p.id === pId)
            return {
                partnerIdForLedger: pId,
                selectedPartnerName: partner?.name || "",
                isLedgerOpen: true
            }
        }
        return {
            partnerIdForLedger: undefined as number | undefined,
            selectedPartnerName: "",
            isLedgerOpen: false
        }
    }, [ledgerParam, partners])

    const analyticsData = usePartnerAnalyticsData(partners, granularity)
    const evolutionData = usePartnerEvolutionData(24, granularity)

    const equityEvolutionChart = useMemo(() => evolutionData.periods.length > 0 ? [{
        id: "Patrimonio Neto",
        data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.net_equity) })),
    }] : [], [evolutionData.periods])

    const compositionEvolutionChart = useMemo(() => evolutionData.periods.length > 0 ? [
        { id: "Aportes", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_contributions) })) },
        { id: "Retiros", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_withdrawals) })) },
        { id: "Utilidades", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_earnings) })) },
        { id: "Dividendos", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_dividends) })) },
    ] : [], [evolutionData.periods])



    const filteredPartners = useMemo(() => {
        let result = search.filterFn(partners)
        if (search.filters.has_pending_capital) {
            result = result.filter(p => parseFloat(p.partner_pending_capital) > 0)
        }
        if (search.filters.has_earnings) {
            result = result.filter(p => parseFloat(p.partner_earnings_balance) > 0)
        }
        if (search.filters.has_dividends) {
            result = result.filter(p => parseFloat(p.partner_dividends_payable_balance) > 0)
        }
        if (search.filters.has_withdrawals) {
            result = result.filter(p => parseFloat(p.partner_provisional_withdrawals_balance) > 0)
        }
        return result
    }, [partners, search])

    const totalNetEquity = useMemo(() =>
        (Array.isArray(partners) ? partners : [])
            .reduce((s, p) => s + Number(p.partner_net_equity || 0), 0),
    [partners])

    const partnersWithPct = useMemo(() =>
        filteredPartners.map(p => ({
            ...p,
            partner_equity_percentage: totalNetEquity > 0
                ? String(Math.round(Number(p.partner_net_equity) / totalNetEquity * 10000) / 100)
                : "0",
        })),
    [filteredPartners, totalNetEquity])

    const analyticsPanel: AnalyticsPanelConfig = useMemo(() => ({
        screen: {
            entityName: "Composición Societaria",
            activeTab: analyticsActiveTab,
            onTabChange: setAnalyticsActiveTab,
            granularity,
            onGranularityChange: setGranularity,
            tabs: [
                {
                    value: "composicion",
                    label: "Composición",
                    icon: PieChartIcon,
                    columns: [
                        {
                            id: "col-kpis",
                            weight: 1,
                            sections: [
                                {
                                    id: "neto-kpi",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Patrimonio Neto",
                                            value: formatCurrency(analyticsData.totalNetEquity),
                                            icon: TrendingUp,
                                            accent: "primary",
                                            valueSize: "xl",
                                            subtext: "Valor Libro de la Compañía",
                                        },
                                    },
                                },
                                {
                                    id: "socios-kpi",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Socios",
                                            value: analyticsData.partnerCount.toString(),
                                            icon: PieChartIcon,
                                            accent: "info",
                                            valueSize: "xl",
                                            subtext: "Total activos",
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-evolution",
                            weight: 1,
                            sections: [
                                {
                                    id: "evolution-chart",
                                    content: evolutionData.periods.length > 0 ? {
                                        type: "stat-card",
                                        config: {
                                            label: "Evolución del Patrimonio Neto",
                                            variant: "chart",
                                            chart: {
                                                type: "line-chart",
                                                preset: "card",
                                                data: equityEvolutionChart,
                                                enableArea: true,
                                                valueFormat: "currency",
                                            },
                                        },
                                    } : {
                                        type: "custom",
                                        render: evolutionData.isLoading ? (
                                            <div className="h-full flex items-center justify-center">
                                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos históricos de evolución</p>
                                        ),
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    value: "socios",
                    label: "Socios",
                    icon: Gauge,
                    columns: [
                        {
                            id: "col-dist",
                            weight: 1,
                            sections: [
                                {
                                    id: "dist-pie",
                                    content: analyticsData.equityDistribution.length > 0 ? {
                                        type: "stat-card",
                                        config: {
                                            label: "Distribución Patrimonial",
                                            variant: "chart",
                                            chart: {
                                                type: "pie-chart",
                                                preset: "card",
                                                data: analyticsData.equityDistribution,
                                                valueFormat: "currency",
                                                innerRadius: 0.6,
                                                enableArcLinkLabels: false,
                                                arcLabel: (d: { id: string; value: number }) => {
                                                    const total = analyticsData.equityDistribution.reduce((s, item) => s + item.value, 0)
                                                    return total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "0%"
                                                },
                                            },
                                        },
                                    } : {
                                        type: "custom",
                                        render: <div className="flex items-center justify-center h-full min-h-32 border border-dashed border-muted-foreground/20 rounded-sm">
                                            <p className="text-sm text-muted-foreground italic">Sin datos de distribución</p>
                                        </div>,
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-capital",
                            weight: 1,
                            sections: [
                                {
                                    id: "capital-bar",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Capital Enterado vs Pendiente",
                                            variant: "chart",
                                            chart: {
                                                type: "bar-chart",
                                                preset: "card",
                                                data: analyticsData.capitalComparison,
                                                keys: ["paid", "pending"],
                                                indexBy: "name",
                                                valueFormat: "$,.0f",
                                                borderRadius: 6,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-composition",
                            sections: [
                                {
                                    id: "composition-line",
                                    content: evolutionData.periods.length > 0 ? {
                                        type: "stat-card",
                                        config: {
                                            label: "Composición Patrimonial",
                                            variant: "chart",
                                            chart: {
                                                type: "line-chart",
                                                preset: "card",
                                                data: compositionEvolutionChart,
                                                enableArea: true,
                                                valueFormat: "currency",
                                            },
                                        },
                                    } : {
                                        type: "custom",
                                        render: evolutionData.isLoading ? (
                                            <div className="h-full flex items-center justify-center">
                                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos históricos de evolución</p>
                                        ),
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    value: "saldos",
                    label: "Saldos",
                    icon: Wallet,
                    columns: [
                        {
                            id: "col-kpis",
                            sections: [
                                {
                                    id: "retiros-kpi",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Retiros Provisorios Totales",
                                            value: formatCurrency(analyticsData.totalWithdrawals),
                                            icon: Wallet,
                                            accent: "destructive",
                                            valueSize: "xl",
                                            subtext: "Saldos provisorios",
                                        },
                                    },
                                },
                                {
                                    id: "utilidades-kpi",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Utilidades Acumuladas",
                                            value: formatCurrency(analyticsData.totalEarnings),
                                            icon: TrendingUp,
                                            accent: "success",
                                            valueSize: "xl",
                                            subtext: "Resultados retenidos",
                                        },
                                    },
                                },
                                {
                                    id: "dividendos-kpi",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Dividendos por Pagar",
                                            value: formatCurrency(analyticsData.totalDividendsPayable),
                                            icon: Wallet,
                                            accent: "warning",
                                            valueSize: "xl",
                                            subtext: "Obligaciones pendientes",
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "col-balance",
                            weight: 1,
                            sections: [
                                {
                                    id: "balance-bar",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Composición de Saldos por Socio",
                                            variant: "chart",
                                            chart: {
                                                type: "bar-chart",
                                                preset: "card",
                                                data: analyticsData.balanceComposition.map(b => ({
                                                    name: b.name,
                                                    patrimonio: b.equity,
                                                    utilidades: b.earnings,
                                                    pendiente: b.pending,
                                                    retiros: b.withdrawals,
                                                })),
                                                keys: ["patrimonio", "utilidades", "pendiente", "retiros"],
                                                indexBy: "name",
                                                valueFormat: "$,.0f",
                                                borderRadius: 6,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    }), [analyticsData, analyticsActiveTab, equityEvolutionChart, compositionEvolutionChart, granularity, evolutionData])

    const hasPartners = partners.length > 0

    const partnerActionsCtx: PartnerActionsCtx = {
        onFormalizeExcessCapital: (id, amount) => {
            setSubModalParams({ partnerId: id.toString(), amount: amount.toString() })
            setIsSubscriptionOpen(true)
        },
        onPayDividends: (id) => { setSelectedPartnerId(id); setIsDividendOpen(true) },
        onDistributeEarnings: (id) => { setSelectedPartnerId(id); setIsMobilizeOpen(true) },
        onViewLedger: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("ledger", id.toString())
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    const columns: ColumnDef<Partner>[] = [
        {
            accessorKey: "name",
            header: () => <div className="text-center">Socio</div>,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 py-1 items-center">
                    <DataCell.ContactLink contactId={row.original.id}>
                        {row.original.name}
                    </DataCell.ContactLink>
                    {Number(row.original.partner_excess_capital) > 0 && (
                        <div className="mt-1.5 p-1.5 bg-warning/10 border border-warning/20 rounded-sm flex items-center gap-2 overflow-hidden ring-1 ring-warning/10">
                            <div className="flex items-center gap-1.5 text-[9px] text-warning font-black uppercase tracking-tighter">
                                <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                                Exceso: +{formatCurrency(row.original.partner_excess_capital)}
                            </div>
                        </div>
                    )}
                </div>
            ),
            meta: { title: "Socio" },
        },
        ...partnerFields.toColumns(),
        partnerActions.auto(partnerActionsCtx)
    ]

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando composición societaria">
            <div className="flex-1 min-h-0 flex flex-col">
                {error && (
                    <div className="mx-4 mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        Error al cargar socios: {error.message}
                    </div>
                )}
                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="settings.partner"
                        columns={columns}
                        data={partnersWithPct}
                        isRefetching={isFetching}
                        variant="embedded"
                        createAction={createAction}
                        analyticsPanel={analyticsPanel}
                        unifiedSearch={<UnifiedSearchBar
                            config={partnerUnifiedSearchDef}
                            chips={search.chips}
                            isFiltered={search.isFiltered}
                            inputValue={search.inputValue}
                            onInputChange={search.setInputValue}
                            onApply={search.applyFilter}
                            onRemove={search.removeFilter}
                            onClearAll={search.clearAll}
                            groupBy={search.groupBy}
                            onGroupBySelect={search.setGroupBy}
                            paramValues={search.paramValues}
                            placeholder="Buscar socio por nombre o ID fiscal..."
                        />}
                        showReset={search.isFiltered}
                        onReset={search.clearAll}
                        toolbarActions={
                            !hasPartners
                                ? [{ key: 'initial-setup', label: 'Configuración Inicial', icon: Plus, onClick: () => setIsInitialSetupOpen(true), intent: 'primary' }]
                                : [
                                    { key: 'new-subscription', label: 'Nueva Suscripción', icon: Plus, onClick: () => setIsSubscriptionOpen(true), intent: 'primary' },
                                    { key: 'transfer', label: 'Transferencia', icon: MoveHorizontal, onClick: () => setIsTransferOpen(true), intent: 'primary' },
                                ]
                        }
                        renderCard={(partner) => (
                            <AutoEntityCard 
                                key={partner.id}
                                data={partner}
                                fields={partnerFields}
                                entityLabel="settings.partner"
                                actions={partnerActions.render(partner, partnerActionsCtx)}

                            />
                        )}
                    />
                </div>

            <SubscriptionMovementModal
                open={isSubscriptionOpen}
                onOpenChange={(open) => {
                    setIsSubscriptionOpen(open)
                    if (!open) setSubModalParams({ partnerId: undefined, amount: undefined })
                }}
                onSuccess={() => refetch()}
                initialPartnerId={subModalParams.partnerId}
                initialAmount={subModalParams.amount}
            />
            <EquityTransferModal
                open={isTransferOpen}
                onOpenChange={setIsTransferOpen}
                onSuccess={() => refetch()}
            />
            <PartnerContributionWizard
                open={isContributionOpen}
                onOpenChange={setIsContributionOpen}
                onSuccess={() => refetch()}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <PartnerWithdrawalWizard
                open={isWithdrawalOpen}
                onOpenChange={setIsWithdrawalOpen}
                onSuccess={() => refetch()}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <MobilizeEarningsWizard
                open={isMobilizeOpen}
                onOpenChange={setIsMobilizeOpen}
                onSuccess={() => refetch()}
                initialPartnerId={selectedPartnerId}
            />
            <DividendPaymentModal
                open={isDividendOpen}
                onOpenChange={setIsDividendOpen}
                onSuccess={() => refetch()}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <PartnerLedgerDrawer
                open={isLedgerOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete("ledger")
                        router.push(`${pathname}?${params.toString()}`, { scroll: false })
                    }
                }}
                partnerId={partnerIdForLedger ?? selectedPartnerId}
                partnerName={selectedPartnerName}
            />
            <AddPartnerModal
                open={isAddPartnerOpen}
                onOpenChange={(open) => {
                    setIsAddPartnerOpen(open)
                    if (!open) clearModalParam()
                }}
                onSuccess={() => refetch()}
            />
            <InitialCapitalModal
                open={isInitialSetupOpen}
                onOpenChange={setIsInitialSetupOpen}
                onSuccess={() => refetch()}
            />
            </div>
        </SkeletonShell>
    )
}
