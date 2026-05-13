"use client"

import { useState, useEffect, useMemo, useCallback } from "react"


import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Edit } from "lucide-react"
import { UserForm } from "@/features/users/components/UserForm"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { GroupManagement } from "@/features/settings/components/GroupManagement"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { type AppUser } from "@/types/entities"
import { cn } from "@/lib/utils"

interface UsersSettingsViewProps {
    activeTab: string
}

import { useUsers } from "@/features/users/hooks/useUsers"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function UsersSettingsView({ activeTab }: UsersSettingsViewProps) {
    const { users, isLoading, refetch } = useUsers()
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
            const transformedUser = {
                ...selectedFromUrl,
                groups: selectedFromUrl.groups?.map(g => typeof g === 'string' ? g : g.name)
            }
            setUserToEdit(transformedUser)
            setIsUserModalOpen(true)
        }
    }, [selectedFromUrl])

    const columns: ColumnDef<AppUser>[] = useMemo(() => [
        {
            accessorKey: "username",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Usuario" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("username")}</div>,
        },
        {
            accessorKey: "email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email" />
            ),
        },
        {
            id: "fullName",
            header: "Nombre Completo",
            cell: ({ row }) => (
                <div>{`${row.original.first_name || ''} ${row.original.last_name || ''}`}</div>
            ),
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

                return systemRole ? (
                    <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border leading-none",
                        systemRole === 'ADMIN' ? "border-primary/30 text-primary bg-primary/5" : "border-muted-foreground/20 text-muted-foreground bg-muted/30"
                    )}>
                        {systemRole}
                    </span>
                ) : null
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

                return (
                    <div className="flex flex-wrap gap-1">
                        {functionalGroups.map(g => (
                            <span key={g} className="text-[9px] font-bold uppercase text-muted-foreground/60 px-1 py-0.5 rounded border border-muted-foreground/10 bg-muted/10 leading-none">
                                {g}
                            </span>
                        ))}
                    </div>
                )
            },
        },
        {
            accessorKey: "is_active",
            header: "Estado",
            cell: ({ row }) => (
                <StatusBadge
                    status={row.original.is_active ? "active" : "inactive"}
                />
            ),
        },
        createActionsColumn<AppUser>({
            renderActions: (user) => {
                return (
                    <DataCell.Action 
                        icon={Edit} 
                        title="Editar" 
                        onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(user.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }}
                    />
                )
            }
        })
    ], [refetch])

    const usersCreateAction = useMemo(() => (
        <UserForm
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

    const roleFilters = useMemo(() => [
        {
            column: "role",
            title: "Rol",
            options: [
                { label: "Admin", value: "ADMIN" },
                { label: "Gerente", value: "MANAGER" },
                { label: "Operador", value: "OPERATOR" },
                { label: "Lectura", value: "READ_ONLY" },
            ],
        },
    ], [])

    return (
        <div className="pt-4">
            <Tabs value={activeTab} className="space-y-4">
                <TabsContent value="users" className="mt-0 outline-none space-y-4">
                    <DataTable
                        columns={columns}
                        data={users}
                        variant="embedded"
                        isLoading={isLoading}
                        globalFilterFields={["username", "email", "first_name", "last_name"]}
                        searchPlaceholder="Buscar usuario por nombre, email o username..."
                        useAdvancedFilter={true}
                        facetedFilters={roleFilters}
                        createAction={usersCreateAction}
                    />
                    {isUserModalOpen && (
                        <UserForm
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

                <TabsContent value="groups" className="mt-0 outline-none">
                    <GroupManagement
                        externalOpen={isGroupModalOpen}
                        onExternalOpenChange={setIsGroupModalOpen}
                        createAction={groupsCreateAction}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
