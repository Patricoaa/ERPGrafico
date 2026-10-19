"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
    Plus,
    MoveHorizontal,
    Wallet,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

import { usePartners, netEquityPercentages } from "@/features/contacts"
import {
    AnalyticsPanelContent,
    UnifiedSearchBar,
    bindUnifiedSearch,
    useUnifiedSearch,
} from "@/components/shared"
import type { UnifiedSearchConfig } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { usePartnerAnalyticsData } from "@/features/settings/hooks/usePartnerAnalyticsData"
import { usePartnerEvolutionData } from "@/features/settings/hooks/usePartnerEvolutionData"
import type { Granularity } from "@/lib/analytics-helpers"
import { partnerEntity, partnerViews } from "@/features/settings/entity-view/partner.entity"
import { buildPartnerAnalyticsScreen } from "./partnerAnalyticsScreen"
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
    const { partners = [], isLoading, isFetching, refetch, error } = usePartners()
    const { view, onViewChange } = useCollectionViewMode("settings.partner")
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
    const [contributionTarget, setContributionTarget] = useState<{ partnerId?: number, amount?: string }>({})

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
    const analyticsScreen = useMemo(
        () => buildPartnerAnalyticsScreen(analyticsData, evolutionData, { activeTab: analyticsActiveTab, onTabChange: setAnalyticsActiveTab, granularity, onGranularityChange: setGranularity }),
        [analyticsData, evolutionData, analyticsActiveTab, granularity],
    )

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

    const equityPctById = useMemo(() => netEquityPercentages(partners), [partners])

    const partnersWithPct = useMemo(() =>
        filteredPartners.map(p => ({
            ...p,
            partner_equity_percentage: equityPctById[p.id] ?? "0",
        })),
    [filteredPartners, equityPctById])


    const hasPartners = partners.length > 0

    const partnerActionsCtx: PartnerActionsCtx = {
        onFormalizeExcessCapital: (id, amount) => {
            setSubModalParams({ partnerId: id.toString(), amount: amount.toString() })
            setIsSubscriptionOpen(true)
        },
        onRegisterContribution: (id, amount) => {
            setContributionTarget({ partnerId: id, amount: amount.toString() })
            setIsContributionOpen(true)
        },
        onPayDividends: (id) => { setSelectedPartnerId(id); setIsDividendOpen(true) },
        onDistributeEarnings: (id) => { setSelectedPartnerId(id); setIsMobilizeOpen(true) },
        onViewLedger: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("ledger", id.toString())
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    const toolbarActionButtons = !hasPartners
        ? (
            <Button size="sm" onClick={() => setIsInitialSetupOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Configuración Inicial
            </Button>
        ) : (
            <>
                <Button size="sm" onClick={() => setIsSubscriptionOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Nueva Suscripción
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setContributionTarget({}); setIsContributionOpen(true) }}>
                    <Wallet className="h-4 w-4 mr-1.5" />
                    Registrar Aporte
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsTransferOpen(true)}>
                    <MoveHorizontal className="h-4 w-4 mr-1.5" />
                    Transferencia
                </Button>
            </>
        )

    const partnerActionButtons = <>{createAction}{toolbarActionButtons}</>

    const collection = useEntityCollection(
        partnerEntity,
        // The core already favors cached rows over a failed background refetch (ADR-0087 — rows
        // win over `error` whenever rows.length > 0). This gate only covers the narrower case the
        // core can't see on its own: a client filter (search.filterFn + the 4 toggle filters) that
        // empties the *filtered* rows while the *unfiltered* list still has data — without it, that
        // combination would read as "error" instead of "no results for this filter".
        { rows: partnersWithPct, isLoading, isRefetching: isFetching, error: !!error && partners.length === 0, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "client", pageSize: 20 } },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                actions={partnerActions.forCollection(partnerActionsCtx)}
            >
                <Collection.Toolbar action={partnerActionButtons}>
                    <UnifiedSearchBar config={partnerUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar socio por nombre o ID fiscal..." />
                </Collection.Toolbar>
                <Collection.View
                    table={partnerViews.table}
                    card={partnerViews.card}
                    emptyTitle="Aún no hay socios"
                    emptyAction={partnerActionButtons}
                    onResetFilters={search.clearAll}
                />
                <Collection.Analytics>
                    <AnalyticsPanelContent {...analyticsScreen} />
                </Collection.Analytics>
            </Collection.Root>

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
                onOpenChange={(open) => {
                    setIsContributionOpen(open)
                    if (!open) setContributionTarget({})
                }}
                onSuccess={() => refetch()}
                initialPartnerId={contributionTarget.partnerId?.toString()}
                initialAmount={contributionTarget.amount}
                lockAmount={!!contributionTarget.amount}
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
    )
}
