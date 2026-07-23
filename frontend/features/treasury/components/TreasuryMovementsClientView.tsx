"use client"

import { Button } from "@/components/ui/button"
import React, { useState, useEffect, lazy, Suspense } from "react"
import { DataTableView, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Scale, Ban } from "lucide-react"

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { treasuryMovementsUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { toast } from "sonner"
import type { TreasuryMovement } from "@/features/treasury/types"
import { movementFields } from "@/features/treasury/movementFields"

// Lazy load heavy components
import { CashMovementDrawer } from "@/features/treasury/components/CashMovementDrawer"
const CashMovementModal = lazy(() => import("./CashMovementModal"))

interface TreasuryMovementsClientViewProps {
    externalOpen?: boolean
    createAction?: React.ReactNode
}

export function TreasuryMovementsClientView({ externalOpen, createAction }: TreasuryMovementsClientViewProps) {
    const { openEntity } = useGlobalModalActions()
    const search = useUnifiedSearch(treasuryMovementsUnifiedSearchDef)
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const treasuryAccountFromUrl = searchParams.get('treasury_account')
    const isAccountFiltered = Boolean(treasuryAccountFromUrl)
    const allFilters = {
        ...search.filters,
        ...(treasuryAccountFromUrl ? { treasury_account: treasuryAccountFromUrl } : {}),
    }
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, movements, totalCount, isLoading, refetch } = useTreasuryMovements({
        ...(allFilters as TreasuryMovementFilters),
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 5000 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const [openModal, setOpenModal] = useState(false)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<TreasuryMovement>({
        endpoint: '/treasury/movements'
    })

    const detailsOpen = !!selectedFromUrl
    const selectedMovementId = selectedFromUrl?.id ?? null

    // T-105: cancelAnimationFrame cleanup prevents setState on unmounted component
    useEffect(() => {
        if (externalOpen) {
            const handle = requestAnimationFrame(() => setOpenModal(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [externalOpen])

    const handleViewDetails = React.useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleClearAccountFilter = React.useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('treasury_account')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleReset = React.useCallback(() => {
        search.clearAll()
        handleClearAccountFilter()
    }, [search.clearAll, handleClearAccountFilter])

    const actionsCtx: TreasuryMovementActionsCtx = { onDetail: handleViewDetails }

    const columns = React.useMemo<ColumnDef<TreasuryMovement>[]>(() => [
        ...movementFields.toColumns(),
        treasuryMovementActions.auto(actionsCtx)
    ], [openEntity, handleViewDetails])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Suspense fallback={<div />}>
                <CashMovementModal
                    open={openModal}
                    onOpenChange={(open: boolean) => {
                        setOpenModal(open)
                        if (!open) {
                            const params = new URLSearchParams(searchParams.toString())
                            params.delete('modal')
                            const query = params.toString()
                            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
                        }
                    }}
                    onSuccess={refetch}
                />
            </Suspense>

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="treasury.treasurymovement"
                    columns={columns}
                    data={movements}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={treasuryMovementsUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered || isAccountFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar movimiento..."
                        prefix={isAccountFiltered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-info/10 text-info border border-info/20 text-[10px] font-black uppercase tracking-wider font-mono shrink-0">
                                Cta. #{treasuryAccountFromUrl}
                                <Button
                                     variant="ghost"
                                     onClick={handleClearAccountFilter}
                                     className="ml-0.5 hover:text-info/80 h-auto w-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none text-current"
                                 >
                                     ×
                                 </Button>
                            </span>
                        ) : undefined}
                    />}
                    unifiedSearchConfig={treasuryMovementsUnifiedSearchDef}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered || isAccountFiltered}
                    onReset={handleReset}
                    createAction={createAction}
                    isFiltered={search.isFiltered || isAccountFiltered}
                    emptyState={{
                        context: "treasury",
                        title: "Aún no hay movimientos de caja",
                        description: "Los ingresos y egresos de fondos que registres aparecerán aquí.",
                    }}
                    renderCard={(m) => {
                        const type = m.movement_type
                        const isWriteOff = m.payment_method === 'WRITE_OFF'

                        const Icon = isWriteOff
                            ? Ban
                            : type === 'INBOUND'
                                ? ArrowDownToLine
                                : type === 'OUTBOUND'
                                    ? ArrowUpFromLine
                                    : type === 'TRANSFER'
                                        ? ArrowLeftRight
                                        : Scale

                        const iconStyle = isWriteOff
                            ? "text-muted-foreground/50 bg-muted/50"
                            : type === 'INBOUND'
                                ? "text-success bg-success/10"
                                : type === 'OUTBOUND'
                                    ? "text-destructive bg-destructive/10"
                                    : "text-warning bg-warning/10"

                        return (
                            <AutoEntityCard 
                                key={m.id} 
                                data={m}
                                fields={movementFields}
                                entityLabel="treasury.cashmovement"
                                onClick={() => handleViewDetails(m.id)}
                                icon={Icon}
                                iconClassName={iconStyle}
                                actions={treasuryMovementActions.render(m, { onDetail: (id) => handleViewDetails(id) })}

                            />
                        )
                    }}
                    cardSkeleton={{ showBody: false }}
                />
            </div>

            {selectedMovementId && (
                <CashMovementDrawer
                    id={selectedMovementId}
                    open={detailsOpen}
                    onOpenChange={(open) => {
                        if (!open) clearSelection()
                    }}
                />
            )}
        </div>
    )
}

export default TreasuryMovementsClientView
