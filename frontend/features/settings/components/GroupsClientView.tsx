"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEffect, useMemo, useState } from "react"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { GroupDrawer } from "@/features/users"
import { groupUnifiedSearchDef } from "@/features/settings/unifiedSearchDef"
import { useGroups } from "../hooks"
import type { Group } from "../api/types"
import { groupEntity, groupViews } from "../entity-view/group.entity"
import { groupActions, type GroupActionsCtx } from "./groupActions"

interface GroupsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function GroupsClientView({ externalOpen, onExternalOpenChange, createAction }: GroupsClientViewProps) {
    const { groups, loading, isError, refetch, fetchGroups, deleteGroup } = useGroups()
    const search = useUnifiedSearch(groupUnifiedSearchDef)
    const { filterFn } = search
    const { view, onViewChange } = useCollectionViewMode("settings.group")
    const rows = useMemo(() => filterFn(groups), [filterFn, groups])
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        groupEntity,
        { rows, isLoading: loading, error: isError && groups.length === 0, refetch, isFiltered: search.isFiltered },
        { defaultSort: groupViews.table.defaultSort },
    )
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingGroup, setEditingGroup] = useState<Group | null>(null)

    useEffect(() => {
        if (externalOpen) {
            requestAnimationFrame(() => {
                setShowCreateModal(true)
            })
        }
    }, [externalOpen])

    const closeCreate = () => {
        setShowCreateModal(false)
        onExternalOpenChange?.(false)
    }

    const handleDelete = async () => {
        if (!deleteId) return
        await deleteGroup(deleteId)
        setDeleteId(null)
    }

    const groupActionsCtx: GroupActionsCtx = {
        onEdit: (group) => setEditingGroup(group),
        onDelete: (id) => setDeleteId(id),
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                // Edit in the local drawer (no ?selected route for groups).
                onOpen={(group) => groupActionsCtx.onEdit(group)}
                actions={groupActions.forCollection(groupActionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={groupUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar grupo..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={groupViews.table}
                    card={groupViews.card}
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="settings.group" id={null} open={showCreateModal} onClose={closeCreate}>
                {(open) => (
                    <GroupDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) closeCreate() }}
                        onSuccess={() => {
                            closeCreate()
                            fetchGroups()
                        }}
                    />
                )}
            </EntityPanelTab>

            <EntityPanelTab label="settings.group" id={editingGroup?.id ?? null} open={!!editingGroup} onClose={() => setEditingGroup(null)}>
                {(open) => (
                    <GroupDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) setEditingGroup(null) }}
                        initialData={editingGroup || undefined}
                        onSuccess={() => {
                            setEditingGroup(null)
                            fetchGroups()
                        }}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                onConfirm={handleDelete}
                title="¿Está seguro?"
                description="Esta acción eliminará el grupo permanentemente. Los usuarios asignados a este grupo dejarán de pertenecer a él, pero no serán eliminados."
                variant="destructive"
                confirmText="Eliminar"
            />
        </div>
    )
}
