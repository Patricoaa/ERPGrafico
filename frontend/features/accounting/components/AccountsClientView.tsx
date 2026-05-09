"use client"

import React, { useState, useEffect, useRef } from "react"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Book, Trash2, Pencil, Plus } from "lucide-react"
import { IconButton } from "@/components/shared"

import { AccountForm } from "@/features/finance/components/AccountForm"
import { LedgerModal } from "@/features/accounting/components/LedgerModal"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { Account } from "@/features/accounting/types"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronRight, ChevronDown } from "lucide-react"
import { buildAccountTree } from "../utils/accountTree"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ActivitySidebar } from "@/features/audit/components"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

interface AccountsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function AccountsClientView({ externalOpen, onExternalOpenChange, createAction }: AccountsClientViewProps) {
    const { accounts: flatAccounts, refetch, deleteAccount } = useAccounts()
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [formParentId, setFormParentId] = useState<string | null>(null)

    // Guard for async operations during mount/unmount
    const isMounted = useRef(false)

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const accounts = React.useMemo(() => {
        if (flatAccounts.length > 0) {
            return buildAccountTree(flatAccounts)
        }
        return []
    }, [flatAccounts])

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Account>({
        endpoint: '/accounting/accounts'
    })

    // Open edit form if ?selected= is present (ADR-0020)
    useEffect(() => {
        if (selectedFromUrl && (!isFormOpen || editingAccount?.id !== selectedFromUrl.id)) {
            setEditingAccount(selectedFromUrl)
            setIsFormOpen(true)
        }
    }, [selectedFromUrl, isFormOpen, editingAccount])



    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingAccount(null)
        setFormParentId(null)
        onExternalOpenChange?.(false)
        clearSelection()
    }

    const handleAddAccount = (parentId?: string) => {
        setEditingAccount(null)
        setFormParentId(parentId || null)
        setIsFormOpen(true)
    }

    const handleEditAccount = (account: Account) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(account.id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    // Synchronize external modal trigger
    useEffect(() => {
        if (externalOpen && isMounted.current) {
            setIsFormOpen(true)
        }
    }, [externalOpen])

    const handleDelete = async (id: number) => {
        setDeleteTarget(id)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteAccount(deleteTarget)
        } catch (error) {
            console.error("Failed to delete account", error)
        } finally {
            setDeleteTarget(null)
        }
    }


    const columns: ColumnDef<Account>[] = React.useMemo(() => [
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código" className="justify-center" />
            ),
            cell: ({ row }) => {
                const canExpand = row.getCanExpand()
                const isExpanded = row.getIsExpanded()

                return (
                    <div
                        className="flex items-center w-full"
                        style={{ paddingLeft: `${row.depth * 1.5}rem` }}
                    >
                        <div className="flex items-center gap-2 flex-1 justify-center relative translate-x-[0.75rem]">
                            {canExpand ? (
                                <IconButton
                                    circular
                                    className="h-4 w-4 p-0 hover:bg-transparent absolute -left-6"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        row.toggleExpanded()
                                    }}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </IconButton>
                            ) : (
                                <div className="w-4 h-4 absolute -left-6" />
                            )}
                            <DataCell.Code>{row.original.code}</DataCell.Code>
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />
            ),
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text>{row.original.name}</DataCell.Text></div>,
        },
        {
            accessorKey: "account_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge
                        status={row.original.account_type}
                        label={row.original.account_type_display}
                    />
                </div>
            ),
        },
        {
            accessorKey: "debit_total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Debe" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={parseFloat(row.getValue("debit_total") || "0")}
                        className="text-muted-foreground font-normal"
                    />
                </div>
            ),
        },
        {
            accessorKey: "credit_total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Haber" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={parseFloat(row.getValue("credit_total") || "0")}
                        className="text-muted-foreground font-normal"
                    />
                </div>
            ),
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency
                        value={parseFloat(row.getValue("balance") || "0")}
                        className="font-bold"
                    />
                </div>
            ),
        },
        createActionsColumn<Account>({
            renderActions: (account) => (
                <>
                    {account.is_selectable && (
                        <LedgerModal
                            accountId={account.id}
                            accountName={account.name}
                            accountCode={account.code}
                            trigger={
                                <DataCell.Action
                                    icon={Book}
                                    title="Ver Libro Mayor"
                                    color="text-primary"
                                />
                            }
                        />
                    )}
                    <DataCell.Action
                        icon={Pencil}
                        title="Editar"
                        onClick={() => handleEditAccount(account)}
                    />
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-muted-foreground/30 hover:text-destructive"
                        onClick={() => handleDelete(account.id)}
                    />
                </>
            ),
        }),
    ], [])

    return (
        <div className="space-y-4">

            <DataTable
                columns={columns}
                data={accounts}
                cardMode
                globalFilterFields={["code", "name"]}
                searchPlaceholder="Buscar por código o nombre..."
                facetedFilters={[
                    {
                        column: "account_type",
                        title: "Tipo",
                        options: [
                            { label: "Activo", value: "ASSET" },
                            { label: "Pasivo", value: "LIABILITY" },
                            { label: "Patrimonio", value: "EQUITY" },
                            { label: "Ingreso", value: "INCOME" },
                            { label: "Gasto", value: "EXPENSE" },
                        ],
                    },
                ]}
                useAdvancedFilter={true}
                defaultPageSize={500}
                getSubRows={(row: Account & { children?: unknown[] }) => row.children as (Account & { children?: unknown[] })[] | undefined}
                autoExpand={true}
                rightAction={null}
                createAction={createAction}
            />

            <AccountForm
                accounts={flatAccounts as any}
                initialData={editingAccount as any}
                parentId={formParentId || undefined}
                auditSidebar={
                    editingAccount ? (
                        <ActivitySidebar entityId={editingAccount.id} entityType="account" />
                    ) : undefined
                }
                readonly={editingAccount ? !editingAccount.is_selectable : false}
                onSuccess={() => {
                    refetch()
                    handleCloseModal()
                }}
                open={isFormOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    }
                }}
            />

            <ActionConfirmModal
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                title="Eliminar Cuenta"
                variant="destructive"
                onConfirm={confirmDelete}
                confirmText="Eliminar"
                description="¿Está seguro de eliminar esta cuenta? Esta acción no se puede deshacer."
            />
        </div>
    )
}
