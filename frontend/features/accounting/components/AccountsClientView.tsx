"use client"

import React, { useState, useEffect, useRef } from "react"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Trash2, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { AccountForm } from "@/features/finance/components/AccountForm"
import { LedgerModal } from "@/features/accounting/components/LedgerModal"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { Account } from "@/features/accounting/types"
import { DataCell } from "@/components/ui/data-table-cells"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import api from "@/lib/api"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronRight, ChevronDown } from "lucide-react"
import { buildAccountTree } from "../utils/accountTree"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface AccountsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function AccountsClientView({ externalOpen, onExternalOpenChange }: AccountsClientViewProps) {
    const { accounts: flatAccounts, refetch, deleteAccount, isLoading } = useAccounts()
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

    const handleCloseModal = () => {
        setIsFormOpen(false)
        setEditingAccount(null)
        setFormParentId(null)
        onExternalOpenChange?.(false)
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleAddAccount = (parentId?: string) => {
        setEditingAccount(null)
        setFormParentId(parentId || null)
        setIsFormOpen(true)
    }

    const handleEditAccount = (account: Account) => {
        setEditingAccount(account)
        setFormParentId(null)
        setIsFormOpen(true)
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


    const columns: ColumnDef<Account>[] = [
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
                                <Button
                                    variant="ghost"
                                    size="icon"
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
                                </Button>
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
        {
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Acciones" className="justify-center" />
            ),
            cell: ({ row }) => {
                const account = row.original
                return (
                    <div className="flex justify-center items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        {account.is_selectable && (
                            <LedgerModal
                                accountId={account.id}
                                accountName={account.name}
                                accountCode={account.code}
                            />
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => handleAddAccount(account.id.toString())}
                            title="Añadir Sub-cuenta"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => handleEditAccount(account)}
                            title="Editar"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground/30 transition-colors"
                            onClick={() => handleDelete(account.id)}
                            title="Eliminar"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="space-y-4">

            <DataTable
                columns={columns}
                data={accounts}
                isLoading={isLoading}
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
                getSubRows={(row: any) => row.children}
                autoExpand={true}
                actionButton={
                    <Button 
                        onClick={() => handleAddAccount()}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-4 h-9 font-heading text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-primary/20"
                    >
                        Nueva Cuenta
                    </Button>
                }
            />

            <AccountForm 
                accounts={flatAccounts} 
                initialData={editingAccount as any}
                parentId={formParentId || undefined}
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
