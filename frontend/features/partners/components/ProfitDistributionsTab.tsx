"use client"

import React, { useState, useCallback } from "react"
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
    const { distributions, isLoading } = useProfitDistributions()
    const [flow, setFlow] = useState({
        isFlowOpen: false,
        isMassPaymentOpen: false,
        selectedResolution: undefined as ProfitDistribution | undefined,
        viewingDist: undefined as ProfitDistribution | undefined
    })
    const [actionRequest, setActionRequest] = useState<ProfitDistributionActionRequest | null>(null)

    // Apertura del flujo desde la URL (?modal=new-distribution)
    useOnOpen(initialFlowOpen, () => setFlow(prev => ({ ...prev, selectedResolution: undefined, isFlowOpen: true })))

    const closeFlow = () => {
        setFlow(prev => ({ ...prev, isFlowOpen: false }))
        clearModalParam()
    }

    const actionsCtx: ProfitDistributionActionsCtx = {
        onViewDetail: (dist) => setFlow(prev => ({ ...prev, viewingDist: dist })),
        onRetake: (dist) => setFlow(prev => ({ ...prev, selectedResolution: dist, isFlowOpen: true })),
        onExecute: (dist) => setActionRequest({ kind: 'execute', distribution: dist }),
        onDelete: (dist) => setActionRequest({ kind: 'delete', distribution: dist }),
        onPayDividends: (dist) => setFlow(prev => ({ ...prev, selectedResolution: dist, isMassPaymentOpen: true })),
    }

    const collection = useEntityCollection(
        profitDistributionEntity,
        { rows: distributions, isLoading },
        { pagination: { mode: "none" } }
    )

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <Collection.Root
                    collection={collection}
                    label="Distribuciones de utilidades"
                    actions={profitDistributionActions.forCollection(actionsCtx)}
                >
                    {createAction && (
                        <Collection.Toolbar action={createAction} />
                    )}
                    <Collection.View
                        table={profitDistributionViews.table}
                        emptyTitle="Sin distribuciones"
                        emptyDescription="No se han registrado distribuciones de utilidades."
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

            {flow.viewingDist && (
                <ProfitDistributionDrawer
                    id={flow.viewingDist.id}
                    open={!!flow.viewingDist}
                    onOpenChange={() => setFlow(prev => ({ ...prev, viewingDist: undefined }))}
                />
            )}

            <ProfitDistributionActionModal request={actionRequest} onClose={() => setActionRequest(null)} />
        </div>
    )
}
