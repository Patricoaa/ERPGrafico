"use client"

import React, { useState, lazy, Suspense, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BaseModal, DataTableView, AutoEntityCard, FormFooter, CancelButton, ActionSlideButton } from '@/components/shared'
import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"

import { useTerminalBatches } from "@/features/treasury"
import type { TerminalBatch } from "@/features/treasury/types"
import { UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { SkeletonShell } from "@/components/shared"
import { terminalBatchUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { terminalBatchFields } from "../terminalBatchFields"

// Lazy load feature components
const LazyTerminalBatchSelectionModal = lazy(() => import("./TerminalBatchSelectionModal"))
const MonthlyInvoiceModal = lazy(() => import("./MonthlyInvoiceModal"))

interface TerminalBatchesClientViewProps {
    createAction?: React.ReactNode
}

export function TerminalBatchesClientView({
    createAction
}: TerminalBatchesClientViewProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(terminalBatchUnifiedSearchDef)
    const { batches, isLoading, refetch } = useTerminalBatches(search.filters)
    const filteredBatches = search.filterFn(batches)
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



    const columns = useMemo<ColumnDef<TerminalBatch>[]>(() => {
        return [
            ...terminalBatchFields.toColumns(),
        ]
    }, [])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.terminalbatch"
                    columns={columns}
                    data={filteredBatches}
                    isLoading={isLoading}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={terminalBatchUnifiedSearchDef}
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
                        placeholder="Buscar liquidación..."
                    />}
                    unifiedSearchConfig={terminalBatchUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "treasury",
                        title: "Aún no hay liquidaciones",
                        description: "Las liquidaciones de terminales de pago aparecerán aquí.",
                    }}
                    renderCard={(batch: TerminalBatch) => (
                        <AutoEntityCard 
                            key={batch.id}
                            data={batch}
                            fields={terminalBatchFields}

                            entityLabel="treasury.terminalbatch"
                            onClick={() => {
                                const params = new URLSearchParams(searchParams.toString())
                                params.set('modal', 'batch')
                                router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false })
                            }}
                        />
                    )}
                />
            </div>

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

