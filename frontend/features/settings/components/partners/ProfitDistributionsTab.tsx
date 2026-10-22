"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { ActionConfirmModal } from '@/components/shared'
import { profitDistributionActions, type ProfitDistributionActionsCtx } from './profitDistributionActions'

import { partnersApi } from "@/features/contacts"
import { type ProfitDistribution } from "@/features/contacts"
import { toast } from "sonner"
import { CreateDistributionFlow } from "./CreateDistributionFlow"
import { MassPaymentModal } from "./MassPaymentWizard"
import { ProfitDistributionDrawer } from "@/features/settings/components/ProfitDistributionDrawer"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { profitDistributionEntity, profitDistributionViews } from "../../entity-view/profitDistribution.entity"

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
    // Unified state to prevent fragmented updates
    const [state, setState] = useState({
        distributions: [] as ProfitDistribution[],
        loading: true,
        isFlowOpen: false,
        isMassPaymentOpen: false,
        selectedResolution: undefined as ProfitDistribution | undefined,
        viewingDist: undefined as ProfitDistribution | undefined
    })
    const [confirmExecute, setConfirmExecute] = useState<ProfitDistribution | null>(null)

    const isMounted = useRef(false)

    const fetchDistributions = React.useCallback(async () => {
        if (!isMounted.current) return
        setState(prev => ({ ...prev, loading: true }))

        try {
            const data = await partnersApi.getProfitDistributions()
            if (isMounted.current) {
                setState(prev => ({
                    ...prev,
                    distributions: data,
                    loading: false
                }))
            }
        } catch (error) {
            console.error(error)
            if (isMounted.current) {
                setState(prev => ({ ...prev, loading: false }))
            }
        }
    }, [])

    useEffect(() => {
        isMounted.current = true
        setTimeout(() => fetchDistributions(), 0)
        return () => { isMounted.current = false }
    }, [fetchDistributions])

    // Effect to handle modal opening from URL/props
    useEffect(() => {
        if (initialFlowOpen) {
            setTimeout(() => {
                setState(prev => ({
                    ...prev,
                    selectedResolution: undefined,
                    isFlowOpen: initialFlowOpen
                }))
            }, 0)
        }
    }, [initialFlowOpen])

    const closeFlow = () => {
        setState(prev => ({
            ...prev,
            isFlowOpen: false
        }))
        clearModalParam()
        fetchDistributions()
    }

    const handleExecute = (resolution: ProfitDistribution) => setConfirmExecute(resolution)

    const actionsCtx: ProfitDistributionActionsCtx = {
        onViewDetail: (dist) => setState(prev => ({ ...prev, viewingDist: dist })),
        onRetake: (dist) => setState(prev => ({ ...prev, selectedResolution: dist, isFlowOpen: true })),
        onExecute: handleExecute,
        onPayDividends: (dist) => setState(prev => ({ ...prev, selectedResolution: dist, isMassPaymentOpen: true })),
    }

    const onConfirmExecute = async () => {
        if (!confirmExecute) return
        setState(prev => ({ ...prev, loading: true }))
        try {
            await partnersApi.executeProfitDistribution(confirmExecute.id)
            toast.success("Distribución ejecutada exitosamente.")
            fetchDistributions()
        } catch (error: unknown) {
            console.error(error)
            const errResponse = error as unknown as { response?: { data?: { detail?: string } } }
            const detail = errResponse.response?.data?.detail || (error instanceof Error ? error.message : "Error al ejecutar la resolución")
            toast.error(detail)
            throw error
        } finally {
            setState(prev => ({ ...prev, loading: false }))
        }
    }

    const collection = useEntityCollection(
        profitDistributionEntity,
        { rows: state.distributions, isLoading: state.loading },
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
            {state.isFlowOpen && (
                <CreateDistributionFlow
                    open={state.isFlowOpen}
                    onOpenChange={closeFlow}
                    onSuccess={fetchDistributions}
                    initialResolution={state.selectedResolution}
                />
            )}

            {state.isMassPaymentOpen && (
                <MassPaymentModal
                    open={state.isMassPaymentOpen}
                    onOpenChange={(v) => setState(prev => ({ ...prev, isMassPaymentOpen: v }))}
                    resolution={state.selectedResolution as ProfitDistribution}
                    onSuccess={fetchDistributions}
                />
            )}

            {state.viewingDist && (
                <ProfitDistributionDrawer
                    id={state.viewingDist.id}
                    open={!!state.viewingDist}
                    onOpenChange={() => setState(prev => ({ ...prev, viewingDist: undefined }))}
                />
            )}

            <ActionConfirmModal
                open={!!confirmExecute}
                onOpenChange={(open) => { if (!open) setConfirmExecute(null) }}
                onConfirm={onConfirmExecute}
                title="Ejecutar Distribución"
                description={confirmExecute ? `¿Está seguro de ejecutar la resolución del año ${confirmExecute.fiscal_year}? Esto generará los asientos contables finales y las transacciones de los socios.` : ""}
                variant="warning"
                confirmText="Ejecutar"
            />
        </div>
    )
}
