"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
    Plus,
    MoveHorizontal,
    Wallet,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

import { usePartners, netEquityPercentages } from "@/features/contacts"
import { useOnOpen } from "../hooks"
import {
    AnalyticsPanelContent,
    UnifiedSearchBar,
    bindUnifiedSearch,
    useUnifiedSearch,
} from "@/components/shared"
import type { UnifiedSearchConfig } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { usePartnerAnalyticsData } from "../hooks/usePartnerAnalyticsData"
import { usePartnerEvolutionData } from "../hooks/usePartnerEvolutionData"
import type { Granularity } from "@/lib/analytics-helpers"
import { partnerEntity, partnerViews } from "../entity-view/partner.entity"
import { buildPartnerAnalyticsScreen } from "./partnerAnalyticsScreen"
import { partnerActions, type PartnerActionsCtx } from './partnerActions'
import { usePartnerActions } from "./PartnerActionModal"
import { PartnerDrawer } from "./PartnerDrawer"

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
    const { view, onViewChange } = useCollectionViewMode("contacts.partner")
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("composicion")
    const [granularity, setGranularity] = useState<Granularity>("month")

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { openSelected } = useEntityRouteActions()
    const clearModalParams = React.useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (!params.has('modal') && !params.has('contact')) return
        params.delete('modal')
        params.delete('contact')
        const query = params.toString()
        router.replace(query ? `?${query}` : pathname, { scroll: false })
    }, [searchParams, router, pathname])
    const { run, host } = usePartnerActions({ onClose: clearModalParams })

    // La ficha del socio es un panel de entidad (`?selected=id`); no necesita endpoint: carga por id.
    const panel = useEntityPanelRoute({ create: false })

    // Enlaces antiguos `?ledger=id` (libro auxiliar) → ficha del socio.
    const ledgerParam = searchParams.get("ledger")
    useEffect(() => {
        if (!ledgerParam) return
        const params = new URLSearchParams(searchParams.toString())
        params.delete("ledger")
        params.set("selected", ledgerParam)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [ledgerParam, searchParams, router, pathname])

    useOnOpen(initialAddPartnerOpen, () => run({ type: "add-partner", contactId: Number(searchParams.get("contact")) || undefined }))

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

    const actionsCtx: PartnerActionsCtx = { run, onOpen: openSelected }

    const toolbarActionButtons = !hasPartners
        ? (
            <Button size="sm" onClick={() => run({ type: "add-partner" })}>
                <Plus className="h-4 w-4 mr-1.5" />
                Añadir socio
            </Button>
        ) : (
            <>
                <Button size="sm" onClick={() => run({ type: "subscription" })}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Nueva Suscripción
                </Button>
                <Button variant="outline" size="sm" onClick={() => run({ type: "contribution" })}>
                    <Wallet className="h-4 w-4 mr-1.5" />
                    Registrar Aporte
                </Button>
                <Button variant="outline" size="sm" onClick={() => run({ type: "transfer" })}>
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
                onOpen={(partner) => openSelected(partner.id)}
                actions={partnerActions.forCollection(actionsCtx)}
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

            <EntityPanelTab label="contacts.partner" {...panel.tab}>
                {(open) => (
                    <PartnerDrawer
                        id={panel.selectedId}
                        open={open}
                        onOpenChange={(o) => { if (!o) panel.close() }}
                    />
                )}
            </EntityPanelTab>

            {host}
        </div>
    )
}
