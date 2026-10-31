"use client"

import { EntityPanelTab } from "@/components/providers"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useMemo, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { FadeIn, ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage } from "@/components/entity-view"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { UserDrawer, useUsers } from "@/features/users"
import { GroupsClientView } from "@/features/settings/components/GroupsClientView"
import type { UnifiedSearchConfig } from "@/types/unified-search"
import type { AppUser } from "@/types/entities"
import { userEntity, userViews } from "../entity-view/user.entity"
import { userActions, type UserActionsCtx } from "./userActions"

interface UsersSettingsClientViewProps {
    activeTab: string
}

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 20 }

export function UsersSettingsClientView({ activeTab }: UsersSettingsClientViewProps) {
    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Nombre / Email / Usuario', serverParam: 'search' },
        ],
        filters: [],
    }), [])
    const search = useUnifiedSearch(config)
    const isFiltered = search.isFiltered
    // A new filter starts again at the first page.
    const [pageState, setPageState] = useServerPage([search.filters], DEFAULT_PAGE)
    const { page, users, isLoading, isRefetching, isError, refetch } = useUsers({
        ...search.filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    } as Parameters<typeof useUsers>[0])
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const panel = useEntityPanelRoute<AppUser>({ endpoint: '/core/users', create: false })

    const actionsCtx: UserActionsCtx = {
        onEdit: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    const { view, onViewChange } = useCollectionViewMode("core.user")
    const collection = useEntityCollection(
        userEntity,
        { rows: users, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered },
        // No `sorting`: with server pagination the core disables sorting (the users endpoint has no ordering yet).
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )

    const usersCreateAction = useMemo(() => (
        <UserDrawer
            onSuccess={refetch}
            trigger={<ToolbarCreateButton label="Nuevo Usuario" />}
        />
    ), [refetch])

    const groupsCreateAction = useMemo(() => (
        <ToolbarCreateButton
            label="Nuevo Grupo"
            onClick={() => setIsGroupModalOpen(true)}
        />
    ), [])

    return (
        <div className="pt-4 flex-1 min-h-0 flex flex-col">
            <Tabs value={activeTab} className="h-full flex flex-col">
                <FadeIn key={activeTab} className="flex-1 min-h-0">
                    <TabsContent value="users" className="mt-0 outline-none space-y-4 h-full flex flex-col">
                        <Collection.Root
                            collection={collection}
                            view={view}
                            onViewChange={onViewChange}
                            onOpen={(user) => actionsCtx.onEdit(user.id)}
                            actions={userActions.forCollection(actionsCtx)}
                        >
                            <Collection.Toolbar action={usersCreateAction}>
                                <UnifiedSearchBar
                                    config={config}
                                    {...bindUnifiedSearch(search)}
                                    placeholder="Buscar usuario por nombre, email o username..."
                                />
                            </Collection.Toolbar>
                            <Collection.View
                                table={userViews.table}
                                card={userViews.card}
                                emptyAction={usersCreateAction}
                                onResetFilters={search.clearAll}
                            />
                        </Collection.Root>
                        <EntityPanelTab label="core.user" {...panel.tab}>
                            {(open) => (
                                <UserDrawer
                                    open={open}
                                    onOpenChange={(open) => { if (!open) panel.close() }}
                                    initialData={panel.entity || undefined}
                                    onSuccess={() => {
                                        refetch()
                                        panel.close()
                                    }}
                                />
                            )}
                        </EntityPanelTab>
                    </TabsContent>

                    <TabsContent value="groups" className="mt-0 outline-none flex-1 min-h-0">
                        <GroupsClientView
                            externalOpen={isGroupModalOpen}
                            onExternalOpenChange={setIsGroupModalOpen}
                            createAction={groupsCreateAction}
                        />
                    </TabsContent>
                </FadeIn>
            </Tabs>
        </div>
    )
}
