"use client"

import { EntityPanelTab } from "@/components/providers"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import React, { useState, lazy, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BaseModal, FormFooter, CancelButton, SubmitButton } from "@/components/shared"
import { Plus } from "lucide-react"

import { useTerminalBatches } from "@/features/treasury"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { SkeletonShell } from "@/components/shared"
import { terminalBatchEntity, terminalBatchViews } from "../entity-view/terminalBatch.entity"

// Lazy load feature components
const LazyTerminalBatchSelectionModal = lazy(() => import("./TerminalBatchSelectionModal"))
const MonthlyInvoiceModal = lazy(() => import("./MonthlyInvoiceModal"))

/** Search group keys → entity field ids (grouping uses the formatted cell text). */

interface TerminalBatchesClientViewProps {
    createAction?: React.ReactNode
}

export function TerminalBatchesClientView({
    createAction
}: TerminalBatchesClientViewProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const query = useCollectionQuery(terminalBatchEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { batches, isLoading, isRefetching, isError, refetch } = useTerminalBatches(query.params)
    const filteredBatches = search.filterFn(batches)
    const { view, onViewChange } = useCollectionViewMode("treasury.terminalbatch")
    const batchPanel = useCreatePanelRoute({ actions: [], createValue: 'batch' })
    const invoicePanel = useCreatePanelRoute({ actions: [], createValue: 'invoice' })

    const handleOpenBatch = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('modal', 'batch')
        router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false })
    }, [router, searchParams])


    // Client-filtered (search.filterFn): gate `error` on the unfiltered length, so a filter that
    // matches nothing reads as "no results", not "error".
    const collection = useEntityCollection(
        terminalBatchEntity,
        { rows: filteredBatches, isLoading, isRefetching, error: isError && batches.length === 0, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, sorting: query.sorting },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                onOpen={handleOpenBatch}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={terminalBatchViews.table}
                    card={terminalBatchViews.card}
                    emptyTitle="Aún no hay liquidaciones"
                    emptyDescription="Los lotes de terminal de cobro aparecerán aquí."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="treasury.terminalbatch" {...batchPanel.tab}>
                {(open) => (
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando modal de lote de terminal de cobro">
                        <Suspense fallback={<div />}>
                            <TerminalBatchModal
                                open={open}
                                onOpenChange={(open: boolean) => { if (!open) batchPanel.close() }}
                                onSuccess={() => {
                                    batchPanel.close()
                                    refetch()
                                }}
                            />
                        </Suspense>
                    </SkeletonShell>
                )}
            </EntityPanelTab>

            <EntityPanelTab label="treasury.terminalbatch" variant="invoice" display="Factura mensual" {...invoicePanel.tab}>
                {(open) => (
                    <SkeletonShell isLoading={isLoading} ariaLabel="Cargando modal de factura mensual">
                        <Suspense fallback={<div />}>
                            <MonthlyInvoiceModal
                                open={open}
                                onOpenChange={(open: boolean) => { if (!open) invoicePanel.close() }}
                            />
                        </Suspense>
                    </SkeletonShell>
                )}
            </EntityPanelTab>
        </div>
    )
}

function TerminalBatchModal({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    const [footerState, setFooterState] = useState({ isValid: false, isCreating: false, providerId: '', depositMethodId: '' })

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={
                <div className="flex items-center gap-3">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                    <span>Registrar lote de terminal de cobro</span>
                </div>
            }
            description="Ingrese los datos de la liquidación diaria informada por el proveedor del terminal de cobro."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <SubmitButton type="submit" form="terminal-batch-form" loading={footerState.isCreating} disabled={footerState.isCreating || !footerState.isValid || !footerState.providerId || !footerState.depositMethodId}>
                                Registrar Liquidación
                            </SubmitButton>
                        </>
                    }
                />
            }
         >
            <SkeletonShell isLoading={false} ariaLabel="Cargando formulario de lote de terminal de cobro">
                <Suspense fallback={<div />}>
                    <LazyTerminalBatchSelectionModal onSuccess={onSuccess} onCancel={() => onOpenChange(false)} onFooterStateChange={setFooterState} />
                </Suspense>
            </SkeletonShell>
        </BaseModal>
    )
}

export default TerminalBatchesClientView

