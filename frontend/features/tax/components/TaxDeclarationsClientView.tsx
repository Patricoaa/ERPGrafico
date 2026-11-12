"use client"
import { formatCurrency } from "@/lib/money"

import React, { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    CheckCircle2,
    AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DeclarationWizard } from "@/features/tax/components/DeclarationWizard"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useServerDate } from "@/hooks/useServerDate"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { taxDeclarationActions, type TaxDeclarationActionsCtx } from './taxDeclarationActions'
import { taxPeriodEntity, taxPeriodViews } from '../entity-view/taxPeriod.entity'

import { type TaxPeriod } from "../types"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { EntityPanelTab } from "@/components/providers"
import { SkeletonShell, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useTaxPeriods } from "../hooks/useTaxQueries"

interface TaxDeclarationsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function TaxDeclarationsClientView({ externalOpen, onExternalOpenChange, createAction }: TaxDeclarationsClientViewProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    // Declarar, pagar y cerrar F29 viven en el wizard unificado (`?selected` o botón externo).
    const declarationPanel = useEntityPanelRoute<TaxPeriod>({ endpoint: '/tax/periods', actions: [null], external: { open: externalOpen, onOpenChange: onExternalOpenChange } })
    const { taxPeriods: periodsData, isLoading: isLoadingPeriods, isError: isPeriodsError, refetch: refetchPeriods } = useTaxPeriods()

    const periods = ((periodsData as { results?: TaxPeriod[] })?.results ?? []) as TaxPeriod[]
    const isLoading = isLoadingPeriods

    const handleCloseModal = () => {
        declarationPanel.close()
    }

    const handleOpenWizard = (period: TaxPeriod) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(period.id))
        params.delete('action')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

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
        onPayment: handleOpenWizard,
        onWizard: handleOpenWizard,
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
                <SkeletonShell isLoading={isLoading} ariaLabel="Cargando períodos tributarios">
                    <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Período Actual</CardTitle>
                            <CardDescription className="text-2xl font-bold text-foreground">
                                {currentPeriodDisplay}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLatestClosed ? (
                                <div className="flex items-center gap-2 text-sm text-success font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Período Cerrado
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-warning font-medium">
                                    <AlertCircle className="h-4 w-4" />
                                    Pendiente de declaración
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">IVA por Pagar (Estimado)</CardTitle>
                            <CardDescription className="text-2xl font-bold text-foreground">
                                {formatCurrency(currentVatToPay)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground italic">
                                Basado en {latestPeriod?.declaration_summary ? 'declaración registrada' : 'información disponible'}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Último Remanente</CardTitle>
                            <CardDescription className="text-2xl font-bold text-foreground">
                                -
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground font-medium">
                                Información no disponible
                            </div>
                        </CardContent>
                    </Card>
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
                        periodId={declarationPanel.selectedId ?? undefined}
                        onSuccess={() => refetchPeriods()}
                        existingPeriods={periods}
                    />
                )}
            </EntityPanelTab>

        </div>
    )
}
