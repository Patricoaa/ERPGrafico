"use client"

import React, { useState, useEffect } from "react"
import { DataTableView, AutoEntityCard, DataCell, DataTableColumnHeader, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowDown } from "lucide-react"
import { resolveTreasuryMovementIcon } from "@/lib/movement-icons"

import { treasuryMovementActions, type TreasuryMovementActionsCtx } from './treasuryMovementActions'
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTreasuryMovements, type TreasuryMovementFilters } from "@/features/treasury/hooks/useTreasuryMovements"
import { treasuryMovementsUnifiedSearchDef } from "@/features/treasury/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { toast } from "sonner"
import type { TreasuryMovement } from "@/features/treasury/types"
import { movementFields } from "@/features/treasury/movementFields"

import { CashMovementDrawer } from "@/features/treasury/components/CashMovementDrawer"

interface BankMovementsClientViewProps {
    bankId: number
}

export function BankMovementsClientView({ bankId }: BankMovementsClientViewProps) {
    const { openEntity } = useGlobalModalActions()
    const search = useUnifiedSearch(treasuryMovementsUnifiedSearchDef)
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const allFilters = {
        ...search.filters,
        bank: bankId,
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

    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<TreasuryMovement>({
        endpoint: '/treasury/movements'
    })

    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setSelectedMovementId(selectedFromUrl.id)
                setDetailsOpen(true)
            })
        }
    }, [selectedFromUrl])

    const handleViewDetails = React.useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleReset = React.useCallback(() => {
        search.clearAll()
    }, [search.clearAll])

    const actionsCtx: TreasuryMovementActionsCtx = { onDetail: handleViewDetails }

    const flowColumn: ColumnDef<TreasuryMovement> = {
        id: "flow",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Flujo" className="justify-center" />,
        cell: ({ row }) => {
            const m = row.original;
            const type = m.movement_type;

            let sourceData: { label: string, type: 'contact' | 'account' | 'text', id?: number, accountCode?: string } = { label: 'Particular', type: 'text' };
            let destData: { label: string, type: 'contact' | 'account' | 'text', id?: number, accountCode?: string } = { label: 'Particular', type: 'text' };

            if (type === 'TRANSFER' || type === 'ADJUSTMENT') {
                sourceData = {
                    label: m.from_account_name || 'Origen',
                    type: 'account',
                    id: m.from_account_account_id || undefined,
                    accountCode: m.from_account_code || ''
                };
                destData = {
                    label: m.to_account_name || 'Destino',
                    type: 'account',
                    id: m.to_account_account_id || undefined,
                    accountCode: m.to_account_code || ''
                };
            } else if (type === 'INBOUND') {
                sourceData = m.partner_id ? { label: m.partner_name || 'Particular', type: 'contact', id: m.partner_id } : { label: m.partner_name || 'Particular', type: 'text' };
                destData = {
                    label: m.to_account_name || 'Caja',
                    type: 'account',
                    id: m.to_account_account_id || undefined,
                    accountCode: m.to_account_code || ''
                };
            } else if (type === 'OUTBOUND') {
                sourceData = {
                    label: m.from_account_name || 'Caja',
                    type: 'account',
                    id: m.from_account_account_id || undefined,
                    accountCode: m.from_account_code || ''
                };
                destData = m.partner_id ? { label: m.partner_name || 'Particular', type: 'contact', id: m.partner_id } : { label: m.partner_name || 'Particular', type: 'text' };
            }

            const EntityLink = ({ data }: { data: typeof sourceData }) => {
                if (data.type === 'contact' && data.id) {
                    return (
                        <DataCell.ContactLink
                            contactId={data.id}
                        >
                            {data.label}
                        </DataCell.ContactLink>
                    );
                }
                if (data.type === 'account' && data.id) {
                    const accountId = m.movement_type === 'INBOUND' && data === destData ? m.to_account : (m.movement_type === 'OUTBOUND' && data === sourceData ? m.from_account : (m.movement_type === 'TRANSFER' || m.movement_type === 'ADJUSTMENT' ? (data === sourceData ? m.from_account : m.to_account) : null));
                    return (
                        <DataCell.Link
                            onClick={() => { if (accountId) openEntity('treasury.treasuryaccount', accountId) }}
                        >
                            {data.label}
                        </DataCell.Link>
                    );
                }
                return <DataCell.Text>{data.label}</DataCell.Text>;
            };

            return (
                <div className="flex flex-col items-center gap-0.5 py-1 w-full min-w-[120px]">
                    <EntityLink data={sourceData} />
                    <ArrowDown className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                    <EntityLink data={destData} />
                </div>
            );
        },
    }

    const columns = React.useMemo<ColumnDef<TreasuryMovement>[]>(() => [
        ...movementFields.toColumns(),
        flowColumn,
        treasuryMovementActions.auto(actionsCtx)
    ], [openEntity, handleViewDetails])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
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
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar movimiento..."
                    />}
                    unifiedSearchConfig={treasuryMovementsUnifiedSearchDef}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered}
                    onReset={handleReset}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "treasury",
                        title: "Aún no hay movimientos bancarios",
                        description: "Los movimientos registrados en las cuentas de este banco aparecerán aquí.",
                    }}
                    renderCard={(m) => {
                        const type = m.movement_type
                        const isTransferOrAdj = type === 'TRANSFER' || type === 'ADJUSTMENT'
                        const { icon, iconClassName } = resolveTreasuryMovementIcon(m)

                        let sourceLabel = m.partner_name || m.from_account_name || 'Origen'
                        let destLabel = m.to_account_name || m.partner_name || 'Destino'

                        if (type === 'INBOUND') {
                            sourceLabel = m.partner_name || 'Particular'
                            destLabel = m.to_account_name || 'Caja'
                        } else if (type === 'OUTBOUND') {
                            sourceLabel = m.from_account_name || 'Caja'
                            destLabel = m.partner_name || 'Particular'
                        } else if (isTransferOrAdj) {
                            sourceLabel = m.from_account_name || 'Origen'
                            destLabel = m.to_account_name || 'Destino'
                        }

                        const amount = typeof m.amount === 'string' ? parseFloat(m.amount) : m.amount

                        const sourceEntity = type === 'INBOUND'
                            ? (m.partner_id ? { label: sourceLabel, entityLabel: 'contacts.contact', id: m.partner_id } : undefined)
                            : (m.from_account ? { label: sourceLabel, entityLabel: 'treasury.treasuryaccount', id: m.from_account } : undefined)
                        const destEntity = type === 'OUTBOUND'
                            ? (m.partner_id ? { label: destLabel, entityLabel: 'contacts.contact', id: m.partner_id } : undefined)
                            : (m.to_account ? { label: destLabel, entityLabel: 'treasury.treasuryaccount', id: m.to_account } : undefined)

                        return (
                            <AutoEntityCard 
                                key={m.id} 
                                data={m}
                                fields={movementFields}
                                entityLabel="treasury.bankmovement"
                                title={m.display_id}
                                subtitle={m.payment_method_display}
                                onClick={() => handleViewDetails(m.id)}
                                icon={icon}
                                iconClassName={iconClassName}
                                actions={treasuryMovementActions.render(m, { onDetail: (id) => handleViewDetails(id) })}
                                variant="full"
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
                        setDetailsOpen(open)
                        if (!open) clearSelection()
                    }}
                />
            )}
        </div>
    )
}
