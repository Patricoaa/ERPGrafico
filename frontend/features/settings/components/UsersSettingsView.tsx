"use client"

import {useState, useEffect, useMemo} from "react"

import { DataTableView, SmartSearchBar, ToolbarCreateButton, SegmentationBar, EntityCard, useSegmentation, useSmartSearch } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { FadeIn, Chip } from "@/components/shared"
import { userActions, type UserActionsCtx } from './userActions'

import { Users } from "lucide-react"
import { UserDrawer } from "@/features/users/components/UserDrawer"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { GroupsClientView } from "@/features/settings/components/GroupsClientView"

import { type AppUser } from "@/types/entities"
import { userSearchDef } from "@/features/users/searchDef"
import { userSegDef } from "@/features/users/segmentationDef"

interface UsersSettingsViewProps {
    activeTab: string
}

import { useUsers } from "@/features/users/hooks/useUsers"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function UsersSettingsView({ activeTab }: UsersSettingsViewProps) {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(userSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(userSegDef)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = { ...textFilters, ...segFilters }
    const { users, isLoading, refetch } = useUsers(allFilters)
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<AppUser>({
        endpoint: '/core/users'
    })

    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    const [userToEdit, setUserToEdit] = useState<AppUser | null>(null)

    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setUserToEdit(selectedFromUrl)
                setIsUserModalOpen(true)
            })
        }
    }, [selectedFromUrl])

    const actionsCtx: UserActionsCtx = {
        onEdit: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    const columns: ColumnDef<AppUser>[] = useMemo(() => [
        {
            accessorKey: "username",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Usuario" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("username")}</DataCell.Text>,
        },
        {
            accessorKey: "email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email" />
            ),
        },
        {
            id: "contact",
            header: "Contacto",
            cell: ({ row }) => {
                const contactId = row.original.contact
                const fullName = `${row.original.first_name || ''} ${row.original.last_name || ''}`.trim()
                const displayName = fullName || row.original.username

                if (!contactId) return <div className="text-muted-foreground text-[13px] font-bold text-center">{displayName}</div>

                return <DataCell.ContactLink contactId={contactId}>{displayName}</DataCell.ContactLink>
            },
        },
        {
            accessorKey: "groups",
            id: "role",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Rol" />
            ),
            cell: ({ row }) => {
                const groups = (row.original.groups || []).map(g => typeof g === 'string' ? g : g.name)
                const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const systemRole = groups.find(g => roles.includes(g))

                if (!systemRole) return null

                const roleIntent: Record<string, 'primary' | 'warning' | 'info' | 'neutral'> = {
                    ADMIN: 'primary',
                    MANAGER: 'warning',
                    OPERATOR: 'info',
                    READ_ONLY: 'neutral',
                }

                return (
                    <DataCell.Chip intent={roleIntent[systemRole] || 'neutral'}>
                        {systemRole}
                    </DataCell.Chip>
                )
            },
        },
        {
            accessorKey: "groups",
            id: "functional_groups",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Grupos" />
            ),
            cell: ({ row }) => {
                const groups = (row.original.groups || []).map(g => typeof g === 'string' ? g : g.name)
                const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const functionalGroups = groups.filter(g => !roles.includes(g))

                if (functionalGroups.length === 0) return null

                return (
                    <div className="flex flex-wrap gap-1">
                        {functionalGroups.map(g => (
                            <Chip key={g} size="xs" intent="neutral" icon={Users}>
                                {g}
                            </Chip>
                        ))}
                    </div>
                )
            },
        },
        {
            accessorKey: "is_active",
            header: "Estado",
            cell: ({ row }) => (
                <DataCell.Status status={row.original.is_active ? "active" : "inactive"} />
            ),
        },
        userActions.column(actionsCtx)
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
        <div className="pt-4 h-full flex flex-col overflow-y-auto">
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
                                smartSearch={<SmartSearchBar searchDef={userSearchDef} placeholder="Buscar usuario por nombre, email o username..." className="w-full" />}
                                segmentation={<SegmentationBar def={userSegDef} />}
                                showReset={isFiltered}
                                onReset={() => { clearText(); clearSeg() }}
                                isFiltered={isFiltered}
                                createAction={usersCreateAction}
                                renderCard={(user: AppUser) => {
                                    const groups = (user.groups || []).map(g => typeof g === 'string' ? g : g.name)
                                    const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                                    const systemRole = groups.find(g => roles.includes(g))
                                    return (
                                        <EntityCard key={user.id}>
                                            <EntityCard.Header
                                                title={user.username}
                                                subtitle={user.email}
                                                trailing={<DataCell.Status status={user.is_active ? "active" : "inactive"} />}
                                            />
                                            <EntityCard.Body>
                                                <EntityCard.Field label="Nombre" value={`${user.first_name || ''} ${user.last_name || ''}`.trim() || '—'} />
                                                {systemRole && <EntityCard.Field label="Rol" value={systemRole} />}
                                            </EntityCard.Body>
                                        </EntityCard>
                                    )
                                }}
                            />
                        </div>
                        {isUserModalOpen && (
                            <UserDrawer
                                open={isUserModalOpen}
                                onOpenChange={(open) => {
                                    setIsUserModalOpen(open)
                                    if (!open) {
                                        setUserToEdit(null)
                                        clearSelection()
                                    }
                                }}
                                initialData={userToEdit || undefined}
                                onSuccess={() => {
                                    refetch()
                                    setIsUserModalOpen(false)
                                    setUserToEdit(null)
                                    clearSelection()
                                }}
                            />
                        )}
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
