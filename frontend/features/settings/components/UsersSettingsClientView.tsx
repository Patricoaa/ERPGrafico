"use client"

import {useState, useMemo} from "react"

import { DataTableView, ToolbarCreateButton, AutoEntityCard, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { type ColumnDef } from "@tanstack/react-table"
import { DataCell } from '@/components/shared'
import { FadeIn } from "@/components/shared"
import { userActions, type UserActionsCtx } from './userActions'
import { userFields } from '../userFields'

import { UserDrawer } from "@/features/users"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { GroupsClientView } from "@/features/settings/components/GroupsClientView"

import { type AppUser } from "@/types/entities"

interface UsersSettingsClientViewProps {
    activeTab: string
}

import { useUsers } from "@/features/users"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function UsersSettingsClientView({ activeTab }: UsersSettingsClientViewProps) {
    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Nombre / Email / Usuario', serverParam: 'search' },
        ],
        filters: [
            { key: 'role', label: 'Rol', type: 'single', serverParam: 'role', options: [
                { label: 'Admin', value: 'ADMIN' },
                { label: 'Gerente', value: 'MANAGER' },
                { label: 'Operador', value: 'OPERATOR' },
                { label: 'Lectura', value: 'READ_ONLY' },
            ]},
        ],
    }), [])
    const search = useUnifiedSearch(config)
    const isFiltered = search.isFiltered
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 20 })
    const { page, users, isLoading, refetch } = useUsers({
        ...search.filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    } as Parameters<typeof useUsers>[0])
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<AppUser>({
        endpoint: '/core/users'
    })

    const isUserModalOpen = !!selectedFromUrl
    const userToEdit = selectedFromUrl ?? null

    const actionsCtx: UserActionsCtx = {
        onEdit: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    const columns: ColumnDef<AppUser>[] = useMemo(() => [
        ...userFields.toColumns(),
        {
            id: "contact",
            header: "Contacto",
            cell: ({ row }) => {
                const contactId = row.original.contact
                const fullName = `${row.original.first_name || ''} ${row.original.last_name || ''}`.trim()
                const displayName = fullName || row.original.username

                if (!contactId) return <div className="text-muted-foreground text-sm font-bold text-center">{displayName}</div>

                return <DataCell.ContactLink contactId={contactId}>{displayName}</DataCell.ContactLink>
            },
        },
        userActions.auto(actionsCtx)
    ], [refetch])

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
                        <div className="flex-1 min-h-0">
                            <DataTableView
                                entityLabel="core.user"
                                columns={columns}
                                data={users}
                                variant="embedded"
                                isLoading={isLoading}
                                unifiedSearch={<UnifiedSearchBar
                                    config={config}
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
                                    placeholder="Buscar usuario por nombre, email o username..."
                                />}
                                showReset={isFiltered}
                                onReset={search.clearAll}
                                isFiltered={isFiltered}
                                createAction={usersCreateAction}
                                manualPagination
                                pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
                                rowCount={page?.count ?? 0}
                                pagination={pageState}
                                onPaginationChange={setPageState as unknown as (updater: ((prev: typeof pageState) => typeof pageState) | typeof pageState) => void}
                                renderCard={(user: AppUser) => (
                                        <AutoEntityCard 
                                            key={user.id} 
                                            data={user}
                                            fields={userFields}

                                            entityLabel="settings.user"
                                            onClick={() => actionsCtx.onEdit(user.id)}
                                            actions={userActions.render(user, actionsCtx)}
                                        />
                                )}
                            />
                        </div>
                            <UserDrawer
                                open={isUserModalOpen}
                                onOpenChange={(open) => {
                                    if (!open) {
                                        clearSelection()
                                    }
                                }}
                                initialData={userToEdit || undefined}
                                onSuccess={() => {
                                    refetch()
                                    clearSelection()
                                }}
                            />
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
