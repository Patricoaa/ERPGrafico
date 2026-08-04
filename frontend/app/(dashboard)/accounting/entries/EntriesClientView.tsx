"use client"

import React, { useEffect, useState, useMemo } from "react"

import { JournalEntryDrawer, usePostJournalEntry, useReverseJournalEntry, useDeleteJournalEntry } from "@/features/accounting"

import { DataTableView, AutoEntityCard } from '@/components/shared'
import { FileEdit, RotateCcw, FileText } from "lucide-react"
import { journalEntryActions, type JournalEntryActionsCtx } from './journalEntryActions'
import { journalEntryFields } from './journalEntryFields'

import { useJournalEntries, type JournalEntry } from "@/features/accounting"
import { useAccountingAccounts } from "@/features/accounting"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { journalEntryUnifiedSearchDef } from "@/features/accounting"
import { toast } from "sonner"
import type { JournalEntryInitialData } from '@/types/forms'

interface EntriesPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export default function EntriesPage({ externalOpen, onExternalOpenChange, createAction }: EntriesPageProps) {
    const search = useUnifiedSearch(journalEntryUnifiedSearchDef)
    const allFilters = { ...search.filters }
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 20 })
    const { page, entries, isLoading, refetch } = useJournalEntries({
        ...allFilters,
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 5000 : pageState.pageSize,
    } as unknown as Parameters<typeof useJournalEntries>[0])

    const totalCount = page?.count ?? 0
    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])
    const { accounts } = useAccountingAccounts({ filters: { is_leaf: true } })
    const { entity: selectedFromUrl } = useSelectedEntity<JournalEntry>({
        endpoint: '/accounting/entries'
    })
    const { selectedId, viewAction, openSelected, openView, clearActions } = useEntityRouteActions()

    // ?selected=<id>&action=view → abre el visor de transacción (read-only)
    const viewingTransaction = selectedId && viewAction === 'view'
        ? { type: 'journal_entry' as const, id: Number(selectedId) }
        : null

    // ?selected=<id> (sin action=view) → abre el form de edición
    const editingEntry = selectedFromUrl && viewAction !== 'view' ? selectedFromUrl : null
    const isFormOpen = (!!editingEntry) || !!externalOpen

    const clearSelection = () => {
        clearActions()
    }

    const handleFormOpenChange = (open: boolean) => {
        if (!open) {
            onExternalOpenChange?.(false)
            clearActions()
        }
    }

    const { postEntry } = usePostJournalEntry()
    const { deleteEntry } = useDeleteJournalEntry()
    const { reverseEntry } = useReverseJournalEntry()

    const handlePost = async (id: number) => {
        await postEntry(id)
        refetch()
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este asiento?")) return
        await deleteEntry(id)
        refetch()
    }

    const handleReverse = async (id: number) => {
        if (!confirm("¿Está seguro de reversar este asiento? Se creará un asiento de reversión.")) return
        await reverseEntry(id)
        refetch()
    }

    const journalEntryActionsCtx: JournalEntryActionsCtx = {
        onEdit: (id) => openSelected(id),
        onView: (id) => openView(id),
        onPublish: (id) => handlePost(id),
        onDelete: (id) => handleDelete(id),
        onReverse: (id) => handleReverse(id),
    }

    const columns = useMemo(() => [
        ...journalEntryFields.toColumns(),
        journalEntryActions.auto(journalEntryActionsCtx),
    ], [journalEntryActionsCtx])


    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="pt-2 flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={entries}
                    isLoading={isLoading}
                    entityLabel="accounting.journalentry"
                    variant="embedded"
                    className="table-header-compact"
                    unifiedSearch={<UnifiedSearchBar
                        config={journalEntryUnifiedSearchDef}
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
                        placeholder="Buscar asientos..."
                    />}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={page?.count ?? 0}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay asientos contables",
                        description: "Los asientos se registran al confirmar operaciones o puedes crear uno manualmente.",
                    }}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    onRowClick={(m) => openView(m.id)}
                    renderCard={(m) => {
                        const Icon = m.is_manual ? FileEdit : m.reversal_of ? RotateCcw : FileText
                        const iconStyle = m.is_manual
                            ? "text-info bg-info/10"
                            : m.reversal_of
                                ? "text-warning bg-warning/10"
                                : "text-success bg-success/10"
                        const totalDebit = m.items?.reduce((sum, item) => sum + (Number(item.debit) || 0), 0) || 0
                        return (
                            <AutoEntityCard
                                key={m.id}
                                data={{ ...m, total_debit: totalDebit }}
                                fields={journalEntryFields}
                                entityLabel="accounting.journalentry"
                                icon={Icon}
                                iconClassName={iconStyle}
                                actions={journalEntryActions.render(m, journalEntryActionsCtx)}
                                defaultAction={(e) => { e.stopPropagation(); openView(m.id) }}
                            />
                        )
                    }}
                    cardSkeleton={{ showBody: false }}
                />

                <JournalEntryDrawer
                    accounts={accounts as unknown as Record<string, unknown>[]}
                    initialData={editingEntry as unknown as JournalEntryInitialData | undefined}
                    onSuccess={() => {
                        refetch()
                        handleFormOpenChange(false)
                    }}
                    open={isFormOpen}
                    onOpenChange={handleFormOpenChange}
                />

                {viewingTransaction && (
                    <JournalEntryDrawer
                        journalEntryId={Number(viewingTransaction.id)}
                        mode="view"
                        open={!!viewingTransaction}
                        onOpenChange={(open) => {
                            if (!open) {
                                clearSelection()
                            }
                        }}
                    />
                )}
            </div>
        </div>
    )
}
