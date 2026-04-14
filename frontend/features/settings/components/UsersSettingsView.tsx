"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Plus, Edit, Loader2, ChevronLeft, Users, UserPlus } from "lucide-react"
import { UserForm } from "@/features/users/components/UserForm"
import { GroupForm } from "@/features/users/components/GroupForm"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { GroupManagement } from "@/features/settings/components/GroupManagement"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

interface UsersSettingsViewProps {
    activeTab: string
    onActionsChange?: (actions: React.ReactNode) => void
}

export function UsersSettingsView({ activeTab, onActionsChange }: UsersSettingsViewProps) {
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<any[]>([])
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)

    const fetchUsers = async () => {
        try {
            const res = await api.get('/core/users/')
            setUsers(res.data.results || res.data)
        } catch (error) {
            toast.error("Error al cargar usuarios")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const columns: ColumnDef<any>[] = [
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
                const groups = row.getValue("role") as string[]
                const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const systemRole = groups?.find(g => roles.includes(g))

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
                const groups = row.getValue("functional_groups") as string[]
                const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
                const functionalGroups = groups?.filter(g => !roles.includes(g)) || []

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
        createActionsColumn<any>({
            renderActions: (user) => (
                <UserForm
                    initialData={user}
                    onSuccess={fetchUsers}
                    trigger={
                        <div>
                            <DataCell.Action icon={Edit} title="Editar" />
                        </div>
                    }
                />
            )
        })
    ]

    useEffect(() => {
        const getHeaderActions = () => {
            switch (activeTab) {
                case "users":
                    return (
                        <UserForm
                            onSuccess={fetchUsers}
                            trigger={
                                <PageHeaderButton
                                    icon={Plus}
                                    circular
                                    title="Nuevo Usuario"
                                />
                            }
                        />
                    )
                case "groups":
                    return (
                        <PageHeaderButton
                            onClick={() => setIsGroupModalOpen(true)}
                            icon={Plus}
                            circular
                            title="Nuevo Grupo"
                        />
                    )
                default:
                    return null
            }
        }

        onActionsChange?.(getHeaderActions())
    }, [activeTab, isGroupModalOpen, onActionsChange])

    return (
        <div className="pt-4">
            <Tabs value={activeTab} className="space-y-4">
                <TabsContent value="users" className="mt-0 outline-none space-y-4">
                    <DataTable
                        columns={columns}
                        data={users}
                        isLoading={loading}
                        cardMode
                        globalFilterFields={["username", "email", "first_name", "last_name"]}
                        searchPlaceholder="Buscar usuario por nombre, email o username..."
                        useAdvancedFilter={true}
                        facetedFilters={[
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
                        ]}
                    />
                </TabsContent>

                <TabsContent value="groups" className="mt-0 outline-none">
                    <GroupManagement externalOpen={isGroupModalOpen} onExternalOpenChange={setIsGroupModalOpen} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
