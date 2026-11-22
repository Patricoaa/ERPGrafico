"use client"
import { formatCurrency } from "@/lib/money"

import React, { useMemo } from "react"
import {
    CheckCircle2,
    AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DeclarationWizard } from "@/features/tax/components/DeclarationWizard"

import { useServerDate } from "@/hooks/useServerDate"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { taxDeclarationActions, type TaxDeclarationActionsCtx } from './taxDeclarationActions'
import { taxPeriodEntity, taxPeriodViews } from '../entity-view/taxPeriod.entity'

import { type TaxPeriod } from "../types"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { Metric, MetricStrip, SkeletonShell, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useTaxPeriods } from "../hooks/useTaxQueries"

interface TaxDeclarationsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function TaxDeclarationsClientView({ externalOpen, onExternalOpenChange, createAction }: TaxDeclarationsClientViewProps) {
    // Declarar, pagar y cerrar F29 viven en el wizard unificado: cada período lo abre en su pestaña (ADR-0152);
    // esta pestaña de página solo atiende el botón externo (nueva declaración).
    const { openEntity } = useGlobalModals()
    useDeepLinkEntity("tax.taxperiod", { actions: [null] })
    const declarationPanel = useCreatePanelRoute({ resolved: false, external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const { taxPeriods: periodsData, isLoading: isLoadingPeriods, isError: isPeriodsError, refetch: refetchPeriods } = useTaxPeriods()

    const periods = ((periodsData as { results?: TaxPeriod[] })?.results ?? []) as TaxPeriod[]
    const isLoading = isLoadingPeriods

    const handleCloseModal = () => {
        declarationPanel.close()
    }

    const handleOpenWizard = (period: TaxPeriod) => openEntity("tax.taxperiod", period.id, period)

    const { serverDate } = useServerDate()

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'month_display', label: 'Período', serverParam: 'month_display', clientKey: ['month_display', 'year'] },
        ],
    }), [])
    const search = useUnifiedSearch(config)
    const filteredPeriods = useMemo(() => search.filterFn(periods), [search.filterFn, periods])

    const latestPeriod = periods.length > 0 ? periods[0] : null
    const currentPeriodDisplay = latestPeriod
        ? `${latestPeriod.month_display} ${latestPeriod.year}`.toUpperCase()
        : (serverDate
            ? format(serverDate, "MMMM yyyy", { locale: es }).toUpperCase()
            : format(new Date(), "MMMM yyyy", { locale: es }).toUpperCase())
    const isLatestClosed = latestPeriod?.status === 'CLOSED'
    const currentVatToPay = latestPeriod?.declaration_summary?.vat_to_pay || 0

    const taxDeclarationActionsCtx: TaxDeclarationActionsCtx = {
        onOpenF29: handleOpenWizard,
    }

    const { view, onViewChange } = useCollectionViewMode("tax.taxperiod", "card")
    const collection = useEntityCollection(
        taxPeriodEntity,
        // Client-filtered: gate `error` on the unfiltered length, so a filter that matches nothing
        // reads as "no results" rather than "error" (component-entity-view.md §10.2).
        { rows: filteredPeriods, isLoading, error: isPeriodsError && periods.length === 0, refetch: refetchPeriods, isFiltered: search.isFiltered },
        { pagination: { mode: "none" } },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="mb-6 shrink-0">
                <SkeletonShell isLoading={isLoading} ariaLabel="Cargando períodos tributarios">
                    <MetricStrip label="Resumen tributario">
                        <Metric
                            label="Período Actual"
                            value={currentPeriodDisplay}
                            lead={isLatestClosed ? CheckCircle2 : AlertCircle}
                            tone={isLatestClosed ? "success" : "warning"}
                            context={isLatestClosed ? "Período cerrado" : "Pendiente de declaración"}
                        />
                        <Metric
                            label="IVA por Pagar (Estimado)"
                            value={formatCurrency(currentVatToPay)}
                            context={`Basado en ${latestPeriod?.declaration_summary ? 'declaración registrada' : 'información disponible'}`}
                        />
                        <Metric label="Último Remanente" value={null} context="Información no disponible" />
                    </MetricStrip>
                </SkeletonShell>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
                <Collection.Root
                    collection={collection}
                    view={view}
                    onViewChange={onViewChange}
                    onOpen={(period) => { if (period.status === 'OPEN') handleOpenWizard(period) }}
                    actions={taxDeclarationActions.forCollection(taxDeclarationActionsCtx)}
                >
                    <Collection.Toolbar action={createAction}>
                        <UnifiedSearchBar config={config} {...bindUnifiedSearch(search)} placeholder="Buscar período..." />
                    </Collection.Toolbar>
                    <Collection.View
                        table={taxPeriodViews.table}
                        card={taxPeriodViews.card}
                        emptyTitle="No se encontraron períodos"
                        onResetFilters={search.clearAll}
                    />
                </Collection.Root>
            </div>
            <EntityPanelTab label="tax.taxperiod" {...declarationPanel.tab}>
                {(open) => (
                    <DeclarationWizard
                        isOpen={open}
                        onOpenChange={(open) => {
                            if (open) return
                            // The wizard stays open while the user registers/pays; refresh on leaving it.
                            refetchPeriods()
                            handleCloseModal()
                        }}
                        onSuccess={() => {
                            refetchPeriods()
                            handleCloseModal()
                        }}
                        existingPeriods={periods}
                    />
                )}
            </EntityPanelTab>

        </div>
    )
}
