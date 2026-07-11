"use client"
import { formatCurrency } from "@/lib/money"

import React, { useEffect, useState, useCallback, useMemo } from "react"
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

import { partnersApi } from "@/features/contacts"
import { type Partner } from "@/features/contacts"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    CardSkeleton,
    SkeletonShell,
        DataTable,
    Chip,
    UnifiedSearchBar,
    useUnifiedSearch
} from "@/components/shared"
import type { AnalyticsPanelConfig, UnifiedSearchConfig } from "@/components/shared"
import { usePartnerAnalyticsData } from "@/features/settings/hooks/usePartnerAnalyticsData"
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
}

export function EquityCompositionTab({
    initialAddPartnerOpen = false,
    createAction
}: {
    initialAddPartnerOpen?: boolean,
    createAction?: React.ReactNode
}) {
    const search = useUnifiedSearch(partnerUnifiedSearchDef)
    const [loading, setLoading] = useState(true)
    const [partners, setPartners] = useState<Partner[]>([])
    const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
    const [isTransferOpen, setIsTransferOpen] = useState(false)
    const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false)
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const clearModalParam = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (params.has('modal')) {
            params.delete('modal')
            const query = params.toString()
            router.replace(query ? `?${query}` : pathname, { scroll: false })
        }
    }, [searchParams, router, pathname])

    // Custom action modals
    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
    const [isDividendOpen, setIsDividendOpen] = useState(false)
    const [isMobilizeOpen, setIsMobilizeOpen] = useState(false)
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | undefined>(undefined)

    // Modal pre-filling state
    const [subModalParams, setSubModalParams] = useState({
        partnerId: undefined as string | undefined,
        amount: undefined as string | undefined
    })

    const fetchData = async () => {
        setLoading(true)
        try {
            const pData = await partnersApi.getPartners()
            setPartners(pData)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar datos societarios")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const initialFetch = async () => {
            try {
                const pData = await partnersApi.getPartners()
                setPartners(pData)
            } catch (error) {
                console.error(error)
                toast.error("Error al cargar datos societarios")
            } finally {
                setLoading(false)
            }
        }
        initialFetch()
    }, [])

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

    const analyticsData = usePartnerAnalyticsData(partners)

    const analyticsPanel: AnalyticsPanelConfig = useMemo(() => ({
        screen: {
            entityName: "Composición Societaria",
            tabs: [
                {
                    value: "composicion",
                    label: "Composición",
                    icon: PieChartIcon,
                    columns: [
                        {
                            id: "col-single",
                            sections: [
                                {
                                    id: "kpi-patrimonio",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Patrimonio Neto",
                                            value: formatCurrency(analyticsData.totalNetEquity),
                                            icon: TrendingUp,
                                            accent: "primary",
                                            variant: "fill",
                                            subtext: "Valor Libro de la Compañía",
                                        },
                                    },
                                },
                                {
                                    id: "kpi-socios",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Socios",
                                            value: analyticsData.partnerCount.toString(),
                                            icon: PieChartIcon,
                                            accent: "info",
                                            variant: "minimal",
                                            subtext: "Total activos",
                                        },
                                    },
                                },
                                {
                                    id: "chart-equity",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Distribución Patrimonial",
                                            variant: "chart",
                                            chart: {
                                                type: "pie-chart",
                                                data: analyticsData.equityDistribution,
                                                showLegend: true,
                                                valueFormat: "currency",
                                            },
                                        },
                                    },
                                },
                                {
                                    id: "chart-capital",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Capital Enterado vs Pendiente",
                                            variant: "chart",
                                            chart: {
                                                type: "bar-chart",
                                                data: analyticsData.capitalComparison,
                                                keys: ["paid", "pending"],
                                                indexBy: "name",
                                                showLegend: true,
                                                axisBottomLegend: "Socio",
                                                axisLeftLegend: "Monto ($)",
                                            },
                                        },
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
                            id: "col-single",
                            sections: [
                                {
                                    id: "kpi-earnings",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Utilidades Acumuladas",
                                            value: formatCurrency(analyticsData.totalEarnings),
                                            icon: TrendingUp,
                                            accent: "success",
                                            variant: "minimal",
                                            subtext: "Resultados retenidos",
                                        },
                                    },
                                },
                                {
                                    id: "kpi-dividends",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Dividendos por Pagar",
                                            value: formatCurrency(analyticsData.totalDividendsPayable),
                                            icon: Wallet,
                                            accent: "warning",
                                            variant: "minimal",
                                            subtext: "Obligaciones pendientes",
                                        },
                                    },
                                },
                                {
                                    id: "chart-balances",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Composición de Saldos por Socio",
                                            variant: "chart",
                                            chart: {
                                                type: "bar-chart",
                                                data: analyticsData.balanceComposition,
                                                keys: ["equity", "earnings", "pending", "withdrawals"],
                                                indexBy: "name",
                                                showLegend: true,
                                                axisBottomLegend: "Socio",
                                                axisLeftLegend: "Monto ($)",
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    value: "metricas",
                    label: "Métricas",
                    icon: Gauge,
                    columns: [
                        {
                            id: "col-single",
                            sections: [
                                {
                                    id: "kpi-top",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Mayor Patrimonio",
                                            value: analyticsData.partnerRanking[0]?.name ?? "—",
                                            icon: TrendingUp,
                                            accent: "primary",
                                            variant: "minimal",
                                            subtext: analyticsData.partnerRanking[0]
                                                ? `${formatCurrency(analyticsData.partnerRanking[0].netEquity)}`
                                                : "Sin datos",
                                        },
                                    },
                                },
                                {
                                    id: "kpi-bottom",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Menor Patrimonio",
                                            value: analyticsData.partnerRanking.length > 0
                                                ? analyticsData.partnerRanking[analyticsData.partnerRanking.length - 1].name
                                                : "—",
                                            icon: Gauge,
                                            accent: "muted",
                                            variant: "minimal",
                                            subtext: analyticsData.partnerRanking.length > 0
                                                ? `${formatCurrency(analyticsData.partnerRanking[analyticsData.partnerRanking.length - 1].netEquity)}`
                                                : "Sin datos",
                                        },
                                    },
                                },
                                {
                                    id: "kpi-pending",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Capital Pendiente Total",
                                            value: formatCurrency(analyticsData.totalPending),
                                            icon: AlertCircle,
                                            accent: "warning",
                                            variant: "minimal",
                                            subtext: `${analyticsData.partnerCount} socios`,
                                        },
                                    },
                                },
                                {
                                    id: "kpi-withdrawals",
                                    content: {
                                        type: "stat-card",
                                        config: {
                                            label: "Retiros Provisorios",
                                            value: formatCurrency(analyticsData.totalWithdrawals),
                                            icon: Wallet,
                                            accent: "destructive",
                                            variant: "minimal",
                                            subtext: "Saldos provisorios",
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    }), [analyticsData])

    if (loading) {
        return (
            <div className="space-y-6">
                <CardSkeleton count={4} variant="grid" />
                <SkeletonShell isLoading ariaLabel="Cargando..." />
            </div>
        )
    }

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
            header: "Socio",
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 py-1 max-w-[220px]">
                    <span className="font-black text-[12px] tracking-tight uppercase leading-none">{row.original.name}</span>
                    <span className="text-[9px] font-mono opacity-50">{row.original.tax_id}</span>

                    {Number(row.original.partner_excess_capital) > 0 && (
                        <div className="mt-1.5 p-1.5 bg-warning/10 border border-warning/20 rounded-sm flex items-center gap-2 overflow-hidden ring-1 ring-warning/10">
                            <div className="flex items-center gap-1.5 text-[9px] text-warning font-black uppercase tracking-tighter">
                                <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                                Exceso: +{formatCurrency(row.original.partner_excess_capital)}
                            </div>
                        </div>
                    )}
                </div>
            )
        },
        {
            accessorKey: "partner_equity_percentage",
            header: () => <div className="text-right">Part. %</div>,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="text-right">
                    <Chip size="xs" intent="primary">
                        {row.getValue("partner_equity_percentage")}%
                    </Chip>
                </div>
            )
        },
        {
            accessorKey: "partner_total_contributions",
            header: () => <div className="text-right whitespace-nowrap">C. Suscrito</div>,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[11px] font-bold opacity-80">
                    {formatCurrency(row.getValue("partner_total_contributions"))}
                </div>
            )
        },
        {
            accessorKey: "partner_total_paid_in",
            header: () => <div className="text-right whitespace-nowrap">C. Enterado</div>,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[11px] font-black text-success">
                    {formatCurrency(row.getValue("partner_total_paid_in"))}
                </div>
            )
        },
        {
            accessorKey: "partner_pending_capital",
            header: () => <div className="text-right">Pendiente</div>,
            enableHiding: false,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_pending_capital"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-warning' : 'text-muted-foreground/30'
                    )}>
                        {formatCurrency(val)}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_provisional_withdrawals_balance",
            header: () => <div className="text-right whitespace-nowrap">R. Provisorios</div>,
            enableHiding: false,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_provisional_withdrawals_balance"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-destructive' : 'text-muted-foreground/30'
                    )}>
                        {val > 0 ? `(${formatCurrency(val)})` : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_earnings_balance",
            header: () => <div className="text-right whitespace-nowrap text-success">Utilidades</div>,
            enableHiding: false,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_earnings_balance"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-success' : 'text-muted-foreground/30'
                    )}>
                        {val > 0 ? formatCurrency(val) : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_dividends_payable_balance",
            header: () => <div className="text-right whitespace-nowrap text-warning">D. por Pagar</div>,
            enableHiding: false,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_dividends_payable_balance"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-warning' : 'text-muted-foreground/30'
                    )}>
                        {val > 0 ? formatCurrency(val) : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_net_equity",
            header: () => <div className="text-right whitespace-nowrap text-primary">Patrimonio</div>,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[12px] font-black text-primary bg-primary/5 px-2 py-1 relative ring-1 ring-primary/10">
                    {formatCurrency(row.getValue("partner_net_equity"))}
                </div>
            )
        },
        partnerActions.column(partnerActionsCtx)
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                columns={columns}
                data={search.filterFn(partners)}
                isLoading={loading}
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
            />
            </div>


            {/* Modals remain the same */}
            <SubscriptionMovementModal
                open={isSubscriptionOpen}
                onOpenChange={(open) => {
                    setIsSubscriptionOpen(open)
                    if (!open) setSubModalParams({ partnerId: undefined, amount: undefined })
                }}
                onSuccess={fetchData}
                initialPartnerId={subModalParams.partnerId}
                initialAmount={subModalParams.amount}
            />
            <EquityTransferModal
                open={isTransferOpen}
                onOpenChange={setIsTransferOpen}
                onSuccess={fetchData}
            />
            <PartnerContributionWizard
                open={isContributionOpen}
                onOpenChange={setIsContributionOpen}
                onSuccess={fetchData}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <PartnerWithdrawalWizard
                open={isWithdrawalOpen}
                onOpenChange={setIsWithdrawalOpen}
                onSuccess={fetchData}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <MobilizeEarningsWizard
                open={isMobilizeOpen}
                onOpenChange={setIsMobilizeOpen}
                onSuccess={fetchData}
                initialPartnerId={selectedPartnerId}
            />
            <DividendPaymentModal
                open={isDividendOpen}
                onOpenChange={setIsDividendOpen}
                onSuccess={fetchData}
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
                onSuccess={fetchData}
            />
            <InitialCapitalModal
                open={isInitialSetupOpen}
                onOpenChange={setIsInitialSetupOpen}
                onSuccess={() => {
                    fetchData()
                }}
            />
        </div>
    )
}
