"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
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
    const { openSelected } = useEntityRouteActions()
    const { openEntity } = useGlobalModals()
    // ADR-0152: ver un asiento abre su propia pestaña; editar sigue en el panel de página (`?selected`).
    useDeepLinkEntity("accounting.journalentry", { actions: ["view"] })

    // ?selected=<id> (sin action) → form de edición (panel de página)
    const editPanel = useEntityPanelRoute<JournalEntry>({
        endpoint: '/accounting/entries',
        actions: [null],
        external: { open: externalOpen, onOpenChange: onExternalOpenChange },
    })
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
        onView: (id) => openEntity("accounting.journalentry", id),
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

            </div>
        </div>
    )
}
