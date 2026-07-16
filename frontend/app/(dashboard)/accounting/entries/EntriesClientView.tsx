"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"

import { JournalEntryDrawer, usePostJournalEntry, useReverseJournalEntry, useDeleteJournalEntry } from "@/features/accounting"

import { DataTableView, AutoEntityCard } from '@/components/shared'
import { FileEdit, RotateCcw, FileText } from "lucide-react"
import { journalEntryActions, type JournalEntryActionsCtx } from './journalEntryActions'
import { journalEntryFields } from './journalEntryFields'

import { useRouter, usePathname, useSearchParams } from "next/navigation"
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
    const [viewingTransaction, setViewingTransaction] = useState<{ type: 'journal_entry', id: number | string } | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)

    // Guard for async operations
    const isMounted = useRef(true)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl } = useSelectedEntity<JournalEntry>({
        endpoint: '/accounting/entries'
    })
    const { detailId, openSelected, openDetail, clearActions } = useEntityRouteActions()

    // ?selected=<id> → abre el form de edición
    useEffect(() => {
        if (!selectedFromUrl) return
        requestAnimationFrame(() => {
            setEditingEntry(selectedFromUrl)
            setIsFormOpen(true)
            setViewingTransaction(null)
        })
    }, [selectedFromUrl])

    // ?detail=<id> → abre el visor de transacción (read-only)
    useEffect(() => {
        if (!detailId) return
        requestAnimationFrame(() => {
            setViewingTransaction({ type: 'journal_entry', id: Number(detailId) })
            setIsFormOpen(false)
            setEditingEntry(null)
        })
    }, [detailId])

    const clearSelection = () => {
        clearActions()
    }

    // Initialize/Cleanup mount guard
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    // Synchronize external modal trigger (guard against repeated opens)
    const didOpenExternal = useRef(false)
    useEffect(() => {
        if (externalOpen && !didOpenExternal.current) {
            didOpenExternal.current = true
            setIsFormOpen(true)
        }
        if (!externalOpen) {
            didOpenExternal.current = false
        }
    }, [externalOpen])

    const handleFormOpenChange = (open: boolean) => {
        setIsFormOpen(open)
        if (!open) {
            setEditingEntry(null)
            onExternalOpenChange?.(false)
            // Clean all action params + modal so URL doesn't stay ?modal=new forever
            const params = new URLSearchParams(searchParams.toString())
            let changed = false
            for (const p of ['selected', 'detail', 'hub', 'modal'] as const) {
                if (params.has(p)) { params.delete(p); changed = true }
            }
            if (changed) {
                const query = params.toString()
                router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
            }
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
        onDetail: (id) => openDetail(id),
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
                    onRowClick={(m) => openDetail(m.id)}
                    renderCard={(m) => {
                        const Icon = m.is_manual ? FileEdit : m.reversal_of ? RotateCcw : FileText
                        const iconStyle = m.is_manual
                            ? "text-info bg-info/10"
                            : m.reversal_of
                                ? "text-warning bg-warning/10"
                                : "text-success bg-success/10"
                        return (
                            <AutoEntityCard
                                key={m.id}
                                data={m}
                                fields={journalEntryFields}
                                icon={Icon}
                                iconClassName={iconStyle}
                                actions={journalEntryActions.render(m, journalEntryActionsCtx)}
                                defaultAction={(e) => { e.stopPropagation(); openDetail(m.id) }}
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
                                setViewingTransaction(null)
                                clearSelection()
                            }
                        }}
                    />
                )}
            </div>
        </div>
    )
}
