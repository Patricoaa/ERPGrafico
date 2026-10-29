"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import React, { useEffect } from "react"

import { JournalEntryDrawer, usePostJournalEntry, useReverseJournalEntry, useDeleteJournalEntry } from "@/features/accounting"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage, GROUP_ROW_LIMIT, type FieldId } from "@/components/entity-view"
import { journalEntryActions, type JournalEntryActionsCtx } from './journalEntryActions'

import { useJournalEntries, type JournalEntry, journalEntryEntity, journalEntryViews } from "@/features/accounting"
import { useAccountingAccounts } from "@/features/accounting"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { journalEntryUnifiedSearchDef } from "@/features/accounting"
import { toast } from "sonner"
import type { JournalEntryInitialData } from '@/types/forms'

interface EntriesPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const ENTRY_GROUPS: Record<string, FieldId<typeof journalEntryEntity.fields>> = { status: "status", is_manual: "origin" }
const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

export default function EntriesPage({ externalOpen, onExternalOpenChange, createAction }: EntriesPageProps) {
    const search = useUnifiedSearch(journalEntryUnifiedSearchDef)
    const groupBy = search.groupBy ? ENTRY_GROUPS[search.groupBy] ?? null : null
    const [pageState, setPageState] = useServerPage([search.filters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("accounting.journalentry")

    const { page, entries, isLoading, isRefetching, isError, refetch } = useJournalEntries({
        ...search.filters,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    } as unknown as Parameters<typeof useJournalEntries>[0])

    const totalCount = page?.count ?? 0
    const isTruncated = !!groupBy && totalCount > GROUP_ROW_LIMIT

    useEffect(() => {
        if (isTruncated) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isTruncated, totalCount])

    const { accounts } = useAccountingAccounts({ filters: { is_leaf: true } })
    const { openSelected, openView } = useEntityRouteActions()

    // ?selected=<id> (sin action) → form de edición; ?selected=<id>&action=view → visor read-only
    const editPanel = useEntityPanelRoute<JournalEntry>({
        endpoint: '/accounting/entries',
        actions: [null],
        external: { open: externalOpen, onOpenChange: onExternalOpenChange },
    })
    const viewPanel = useEntityPanelRoute({ actions: ['view'], create: false })
    const editingEntry = editPanel.entity

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

    const collection = useEntityCollection(
        journalEntryEntity,
        { rows: entries, rowCount: totalCount, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="pt-2 flex-1 min-h-0 flex flex-col">
                <Collection.Root
                    collection={collection}
                    view={view}
                    onViewChange={onViewChange}
                    onOpen={(entry) => openView(entry.id)}
                    actions={journalEntryActions.forCollection(journalEntryActionsCtx)}
                >
                    <Collection.Toolbar action={createAction}>
                        <UnifiedSearchBar config={journalEntryUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar asientos..." />
                    </Collection.Toolbar>
                    <Collection.View
                        table={journalEntryViews.table}
                        card={journalEntryViews.card}
                        emptyTitle="Aún no hay asientos contables"
                        emptyDescription="Los asientos se registran al confirmar operaciones o puedes crear uno manualmente."
                        emptyAction={createAction}
                        onResetFilters={search.clearAll}
                    />
                </Collection.Root>

                <EntityPanelTab label="accounting.journalentry" {...editPanel.tab}>
                    {(open) => (
                        <JournalEntryDrawer
                            accounts={accounts as unknown as Record<string, unknown>[]}
                            initialData={editingEntry as unknown as JournalEntryInitialData | undefined}
                            onSuccess={() => {
                                refetch()
                                editPanel.close()
                            }}
                            open={open}
                            onOpenChange={(open) => { if (!open) editPanel.close() }}
                        />
                    )}
                </EntityPanelTab>

                <EntityPanelTab label="accounting.journalentry" {...viewPanel.tab}>
                    {(open) => viewPanel.selectedId && (
                        <JournalEntryDrawer
                            journalEntryId={viewPanel.selectedId}
                            mode="view"
                            open={open}
                            onOpenChange={(open) => { if (!open) viewPanel.close() }}
                        />
                    )}
                </EntityPanelTab>
            </div>
        </div>
    )
}
