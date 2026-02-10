"use client"

import React, { useEffect, useState } from "react"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Search, Plus, Book, Trash2, Pencil } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { toast } from "sonner"

import { AccountForm } from "@/components/forms/AccountForm"
import { DataManagement } from "@/components/shared/DataManagement"

import { LedgerModal } from "@/components/shared/LedgerModal"
import { PageHeader } from "@/components/shared/PageHeader"

interface Account {
    id: number
    code: string
    name: string
    account_type: string
    account_type_display: string
    parent: number | null
    debit_total: string
    credit_total: string
    balance: string
    is_selectable: boolean
}

const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/')
            const data = response.data.results || response.data
            // Sorting is already done by backend (ordering = ['code']), 
            // but we can ensure it here or re-sort if grouping changes order
            setAccounts(data)
        } catch (error) {
            console.error("Failed to fetch accounts", error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar esta cuenta?")) return

        try {
            await api.delete(`/accounting/accounts/${id}/`)
            toast.success("Cuenta eliminada correctamente")
            fetchAccounts()
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || "Error al eliminar la cuenta"
            toast.error(errorMsg)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    // Group accounts by type for display
    const groupedAccounts = typeOrder.map(type => ({
        type,
        label: accounts.find(a => a.account_type === type)?.account_type_display || type,
        items: accounts.filter(a => a.account_type === type)
    })).filter(g => g.items.length > 0)

    const columns: ColumnDef<Account>[] = [
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código" />
            ),
            cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("code")}</span>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "account_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => <span className="text-xs text-muted-foreground uppercase font-semibold">{row.original.account_type_display}</span>,
        },
        {
            accessorKey: "debit_total",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Debe" /></div>
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("debit_total"))
                return <div className="text-right text-muted-foreground">{val !== 0 ? val.toLocaleString() : '-'}</div>
            },
        },
        {
            accessorKey: "credit_total",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Haber" /></div>
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("credit_total"))
                return <div className="text-right text-muted-foreground">{val !== 0 ? val.toLocaleString() : '-'}</div>
            },
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <div className="text-right"><DataTableColumnHeader column={column} title="Saldo" /></div>
            ),
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("balance"))
                return <div className="text-right font-bold">${val.toLocaleString()}</div>
            },
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
                            onSuccess={fetchAccounts}
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
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Plan de Cuentas"
                description="Administra la estructura de cuentas contables y su jerarquía."
                titleActions={
                    <AccountForm accounts={accounts} onSuccess={fetchAccounts} triggerVariant="circular" />
                }
            >
                <DataManagement
                    endpoint="/accounting/accounts/"
                    onImportSuccess={fetchAccounts}
                    exportFilename="plan-de-cuentas.csv"
                    templateData={[
                        { code: '1.1.01', name: 'Nombre de Cuenta', account_type: 'ASSET' }
                    ]}
                />
            </PageHeader>
            <DataTable
                columns={columns}
                data={accounts}
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
        </div>
    )
}
