"use client"

import React, { useState, lazy, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BaseModal, FormFooter, CancelButton, ActionSlideButton } from '@/components/shared'
import { Plus } from "lucide-react"

import { useTerminalBatches } from "@/features/treasury"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { SkeletonShell } from "@/components/shared"
import { terminalBatchUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { terminalBatchEntity, terminalBatchViews } from "../entity-view/terminalBatch.entity"

// Lazy load feature components
const LazyTerminalBatchSelectionModal = lazy(() => import("./TerminalBatchSelectionModal"))
const MonthlyInvoiceModal = lazy(() => import("./MonthlyInvoiceModal"))

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const TERMINAL_BATCH_GROUPS: Record<string, FieldId<typeof terminalBatchEntity.fields>> = { date: "salesDate", status: "status" }

interface TerminalBatchesClientViewProps {
    createAction?: React.ReactNode
}

export function TerminalBatchesClientView({
    createAction
}: TerminalBatchesClientViewProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(terminalBatchUnifiedSearchDef)
    const { batches, isLoading, isRefetching, isError, refetch } = useTerminalBatches(search.filters)
    const filteredBatches = search.filterFn(batches)
    const { view, onViewChange } = useCollectionViewMode("treasury.terminalbatch")
    const openCreate = searchParams.get('modal') === 'batch'
    const openInvoice = searchParams.get('modal') === 'invoice'

    const clearModalParam = useCallback(() => {
        const searchParams = new URLSearchParams(window.location.search)
        if (searchParams.has('modal')) {
            searchParams.delete('modal')
            const query = searchParams.toString()
            router.replace(query ? `?${query}` : window.location.pathname, { scroll: false })
        }
    }, [router])

    const handleOpenBatch = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('modal', 'batch')
        router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false })
    }, [router, searchParams])

    const groupBy = search.groupBy ? TERMINAL_BATCH_GROUPS[search.groupBy] ?? null : null

    // Client-filtered (search.filterFn): gate `error` on the unfiltered length, so a filter that
    // matches nothing reads as "no results", not "error".
    const collection = useEntityCollection(
        terminalBatchEntity,
        { rows: filteredBatches, isLoading, isRefetching, error: isError && batches.length === 0, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={handleOpenBatch}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={terminalBatchUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar liquidación..." />
                </Collection.Toolbar>
                <Collection.View
                    table={terminalBatchViews.table}
                    card={terminalBatchViews.card}
                    emptyTitle="Aún no hay liquidaciones"
                    emptyDescription="Las liquidaciones de terminales de pago aparecerán aquí."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

             <SkeletonShell isLoading={isLoading} ariaLabel="Cargando modal de lote de terminal">
                 <Suspense fallback={<div />}>
                     <TerminalBatchModal
                     open={openCreate}
                     onOpenChange={(open: boolean) => {
                         if (!open) clearModalParam()
                     }}
                     onSuccess={() => {
                         clearModalParam()
                         refetch()
                     }}
                 />
                 </Suspense>
             </SkeletonShell>

             <SkeletonShell isLoading={isLoading} ariaLabel="Cargando modal de factura mensual">
                 <Suspense fallback={<div />}>
                     <MonthlyInvoiceModal
                     open={openInvoice}
                     onOpenChange={(open: boolean) => {
                         if (!open) clearModalParam()
                     }}
                 />
                 </Suspense>
             </SkeletonShell>
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
                    <span>Registrar Liquidación de Terminal de Cobro</span>
                </div>
            }
            description="Ingrese los datos de la liquidación diaria informada por el proveedor del terminal de cobro."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton type="submit" form="terminal-batch-form" loading={footerState.isCreating} disabled={footerState.isCreating || !footerState.isValid || !footerState.providerId || !footerState.depositMethodId}>
                                Registrar Liquidación
                            </ActionSlideButton>
                        </>
                    }
                />
            }
         >
            <SkeletonShell isLoading={false} ariaLabel="Cargando formulario de lote de terminal">
                <Suspense fallback={<div />}>
                    <LazyTerminalBatchSelectionModal onSuccess={onSuccess} onCancel={() => onOpenChange(false)} onFooterStateChange={setFooterState} />
                </Suspense>
            </SkeletonShell>
        </BaseModal>
    )
}

export default TerminalBatchesClientView

