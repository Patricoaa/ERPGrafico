"use client"

import React, { useState, useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { profitDistributionActions, type ProfitDistributionActionsCtx } from './profitDistributionActions'

import { type ProfitDistribution } from "@/features/contacts"
import { useProfitDistributions, useOnOpen } from "../hooks"
import { CreateDistributionWizard } from "./CreateDistributionWizard"
import { MassPaymentWizard } from "./MassPaymentWizard"
import { ProfitDistributionDrawer } from "./ProfitDistributionDrawer"
import { ProfitDistributionActionModal, type ProfitDistributionActionRequest } from "./ProfitDistributionActionModal"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { profitDistributionEntity, profitDistributionViews } from "../entity-view/profitDistribution.entity"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type UnifiedSearchConfig } from "@/components/shared"
import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

const distributionSearchConfig: UnifiedSearchConfig = {
    searchFields: [
        {
            key: 'search',
            label: 'Resolución',
            serverParam: 'search',
            clientKey: ['display_id', 'fiscal_year', 'acta_number', 'notes'],
        },
    ],
    filters: [
        {
            type: 'toggle',
            key: 'status_draft',
            label: 'Borradores',
            serverParam: 'status_draft',
        },
        {
            type: 'toggle',
            key: 'status_approved',
            label: 'Aprobadas',
            serverParam: 'status_approved',
        },
        {
            type: 'toggle',
            key: 'status_executed',
            label: 'Ejecutadas',
            serverParam: 'status_executed',
        },
    ],
}

interface ProfitDistributionsTabProps {
    /** Whether the new-distribution flow should open on mount (driven by URL ?modal=new-distribution) */
    initialFlowOpen?: boolean
    createAction?: React.ReactNode
}

export function ProfitDistributionsTab({ initialFlowOpen = false, createAction }: ProfitDistributionsTabProps) {
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
    const search = useUnifiedSearch(distributionSearchConfig)
    const { distributions, isLoading } = useProfitDistributions()
    const [flow, setFlow] = useState({
        isFlowOpen: false,
        isMassPaymentOpen: false,
        selectedResolution: undefined as ProfitDistribution | undefined,
    })
    const [actionRequest, setActionRequest] = useState<ProfitDistributionActionRequest | null>(null)

    // Panel de entidad (ADR-0101): `?selected=id` → workspace tab
    const { openSelected } = useEntityRouteActions()
    const panel = useEntityPanelRoute<ProfitDistribution>({ create: false })

    // Apertura del flujo desde la URL (?modal=new-distribution)
    useOnOpen(initialFlowOpen, () => setFlow(prev => ({ ...prev, selectedResolution: undefined, isFlowOpen: true })))

    const closeFlow = () => {
        setFlow(prev => ({ ...prev, isFlowOpen: false }))
        clearModalParam()
    }

    const actionsCtx: ProfitDistributionActionsCtx = {
        onViewDetail: (dist) => openSelected(dist.id),
        onRetake: (dist) => setFlow(prev => ({ ...prev, selectedResolution: dist, isFlowOpen: true })),
        onExecute: (dist) => setActionRequest({ kind: 'execute', distribution: dist }),
        onDelete: (dist) => setActionRequest({ kind: 'delete', distribution: dist }),
        onPayDividends: (dist) => setFlow(prev => ({ ...prev, selectedResolution: dist, isMassPaymentOpen: true })),
    }

    const filteredDistributions = useMemo(() => {
        let result = search.filterFn(distributions)
        if (search.filters.status_draft) {
            result = result.filter(d => d.status === 'DRAFT')
        }
        if (search.filters.status_approved) {
            result = result.filter(d => d.status === 'APPROVED')
        }
        if (search.filters.status_executed) {
            result = result.filter(d => d.status === 'EXECUTED')
        }
        return result
    }, [distributions, search])

    const collection = useEntityCollection(
        profitDistributionEntity,
        { rows: filteredDistributions, isLoading, isFiltered: search.isFiltered },
        { pagination: { mode: "none" } }
    )

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <Collection.Root
                    collection={collection}
                    label="Distribuciones de utilidades"
                    actions={profitDistributionActions.forCollection(actionsCtx)}
                    onOpen={(dist) => openSelected(dist.id)}
                >
                    <Collection.Toolbar action={createAction}>
                        <UnifiedSearchBar
                            config={distributionSearchConfig}
                            {...bindUnifiedSearch(search)}
                            placeholder="Buscar por año, folio de resolución o acta..."
                        />
                    </Collection.Toolbar>
                    <Collection.View
                        table={profitDistributionViews.table}
                        emptyTitle="Sin distribuciones"
                        emptyDescription="No se han registrado distribuciones de utilidades."
                        onResetFilters={search.clearAll}
                    />
                </Collection.Root>
            </div>

            {/* Modal Flows */}
            {flow.isFlowOpen && (
                <CreateDistributionWizard
                    open={flow.isFlowOpen}
                    onOpenChange={closeFlow}
                    initialResolution={flow.selectedResolution}
                />
            )}

            {flow.isMassPaymentOpen && (
                <MassPaymentWizard
                    open={flow.isMassPaymentOpen}
                    onOpenChange={(v) => setFlow(prev => ({ ...prev, isMassPaymentOpen: v }))}
                    resolution={flow.selectedResolution as ProfitDistribution}
                />
            )}

            {/* Drawer de detalle — workspace tab (ADR-0101) */}
            <EntityPanelTab label="contacts.profitdistributionresolution" {...panel.tab}>
                {(open) => (
                    <ProfitDistributionDrawer
                        id={panel.selectedId}
                        open={open}
                        onOpenChange={(o) => { if (!o) panel.close() }}
                    />
                )}
            </EntityPanelTab>

            <ProfitDistributionActionModal request={actionRequest} onClose={() => setActionRequest(null)} />
        </div>
    )
}
