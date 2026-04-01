"use client"

import React, { useState } from "react"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Search, Plus, Book, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { AccountForm } from "@/components/forms/AccountForm"
import { DataManagement } from "@/components/shared/DataManagement"
import { LedgerModal } from "@/features/accounting/components/LedgerModal"
import { PageHeader } from "@/components/shared/PageHeader"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { Account } from "@/features/accounting/types"
import { DataCell } from "@/components/ui/data-table-cells"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import api from "@/lib/api"



const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

export function AccountsClientView() {
    const { accounts, refetch, deleteAccount } = useAccounts()
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

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

    const handleExport = async () => {
        const res = await api.get("/accounting/accounts/")
        const data = res.data.results || res.data
        if (!data || data.length === 0) {
            toast.error("No hay datos para exportar")
            return
        }
        const headers = Object.keys(data[0]).join(',')
        const csv = data.map((row: Record<string, unknown>) =>
            Object.values(row).map(val =>
                typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
            ).join(',')
        ).join('\n')
        const blob = new Blob([`${headers}\n${csv}`], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.setAttribute('download', 'plan-de-cuentas.csv')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("Datos exportados correctamente")
    }

    const handleImport = async (formData: FormData) => {
        await api.post("/accounting/accounts/bulk_import/", formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
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
                        amount={parseFloat(row.getValue("debit_total"))} 
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
                        amount={parseFloat(row.getValue("credit_total"))} 
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
                        amount={parseFloat(row.getValue("balance"))} 
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
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Plan de Cuentas"
                description="Administra la estructura de cuentas contables y su jerarquía."
                titleActions={
                    <AccountForm accounts={accounts} onSuccess={refetch} triggerVariant="circular" />
                }
            >
                <DataManagement
                    onExport={handleExport}
                    onImport={handleImport}
                    onImportSuccess={refetch}
                    exportFilename="plan-de-cuentas.csv"
                    templateData={[
                        { code: '1.1.01', name: 'Nombre de Cuenta', account_type: 'ASSET' }
                    ]}
                />
            </PageHeader>
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
