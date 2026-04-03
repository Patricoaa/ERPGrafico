"use client"

import React, { useState, useEffect } from "react"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Trash2, Pencil } from "lucide-react"
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

interface AccountsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function AccountsClientView({ externalOpen, onExternalOpenChange }: AccountsClientViewProps) {
    const { accounts, refetch, deleteAccount } = useAccounts()
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsFormOpen(false)
        onExternalOpenChange?.(false)
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

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
                <DataTableColumnHeader column={column} title="Código" />
            ),
            cell: ({ row }) => <DataCell.Code>{row.original.code}</DataCell.Code>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.original.name}</DataCell.Text>,
        },
        {
            accessorKey: "account_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => <DataCell.Badge variant="secondary" className="text-[10px]">{row.original.account_type_display}</DataCell.Badge>,
        },
        {
            accessorKey: "debit_total",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Debe" /></div>
            ),
            cell: ({ row }) => (
                <div className="text-right">
                    <MoneyDisplay 
                        amount={parseFloat(row.getValue("debit_total") || "0")} 
                        showColor={false}
                        className="text-muted-foreground font-normal"
                    />
                </div>
            ),
        },
        {
            accessorKey: "credit_total",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Haber" /></div>
            ),
            cell: ({ row }) => (
                <div className="text-right">
                    <MoneyDisplay 
                        amount={parseFloat(row.getValue("credit_total") || "0")} 
                        showColor={false}
                        className="text-muted-foreground font-normal"
                    />
                </div>
            ),
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Saldo" /></div>
            ),
            cell: ({ row }) => (
                <div className="text-right">
                    <MoneyDisplay 
                        amount={parseFloat(row.getValue("balance") || "0")} 
                        className="font-bold"
                    />
                </div>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const account = row.original
                return (
                    <div className="flex justify-end items-center gap-1">
                        {account.is_selectable && (
                            <LedgerModal
                                accountId={account.id}
                                accountName={account.name}
                                accountCode={account.code}
                            />
                        )}
                        <AccountForm
                            accounts={accounts}
                            initialData={account as any}
                            onSuccess={refetch}
                            triggerText={<Pencil className="h-4 w-4" />}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            title="Eliminar"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(account.id)}
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
                defaultPageSize={50}
            />

            <AccountForm 
                accounts={accounts} 
                onSuccess={refetch} 
                open={isFormOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsFormOpen(true)
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
